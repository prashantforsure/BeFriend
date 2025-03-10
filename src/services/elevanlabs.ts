import axios from 'axios';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import prisma from '@/lib/prisma';

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const DEFAULT_VOICE_ID = process.env.ELEVENLABS_DEFAULT_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL';
const TTS_ENDPOINT = 'text-to-speech';
const VOICES_ENDPOINT = 'voices';
const TMP_DIR = os.tmpdir();

export class ElevenLabsError extends Error {
  statusCode?: number;
  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'ElevenLabsError';
    this.statusCode = statusCode;
  }
}

export interface TTSOptions {
  voiceId?: string;
  stability?: number; // 0 to 1
  similarityBoost?: number; // 0 to 1
  style?: number; // 0 to 1
  speakerBoost?: boolean;
  modelId?: string;
}

export interface Voice {
  voice_id: string;
  name: string;
  preview_url: string;
  gender?: string;
  accent?: string;
  description?: string;
  preview_url_wav?: string;
}

export class ElevenLabsService {
  private apiKey: string;
  private apiUrl: string;
  
  constructor() {
    this.apiKey = ELEVENLABS_API_KEY || '';
    this.apiUrl = ELEVENLABS_API_URL;
    
    if (!this.apiKey) {
      console.warn('ElevenLabs API key is not set. API calls will fail.');
    }
  }
  
  /**
   * Convert text to speech and return the audio buffer and content type.
   */
  async textToSpeech(
    text: string, 
    options: TTSOptions = {}
  ): Promise<{ audioBuffer: Buffer, contentType: string }> {
    try {
      const voiceId = options.voiceId || DEFAULT_VOICE_ID;
      
      // Default TTS parameters
      const ttsParams = {
        text: text,
        model_id: options.modelId || 'eleven_multilingual_v2',
        voice_settings: {
          stability: options.stability ?? 0.5,
          similarity_boost: options.similarityBoost ?? 0.75,
          style: options.style ?? 0.5,
          speaker_boost: options.speakerBoost ?? true,
        }
      };
      
      // Make API request to ElevenLabs TTS endpoint
      const response = await axios.post(
        `${this.apiUrl}/${TTS_ENDPOINT}/${voiceId}`,
        ttsParams,
        {
          headers: {
            'Accept': 'audio/mpeg',
            'xi-api-key': this.apiKey,
            'Content-Type': 'application/json',
          },
          responseType: 'arraybuffer',
          timeout: 30000, // 30-second timeout
        }
      );
      
      return {
        audioBuffer: Buffer.from(response.data),
        contentType: 'audio/mpeg'
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const statusCode = error.response?.status || 500;
        const errorMessage = error.response?.data 
          ? this.tryParseErrorMessage(error.response.data)
          : error.message;
        throw new ElevenLabsError(`ElevenLabs API error: ${errorMessage}`, statusCode);
      }
      throw new ElevenLabsError(`Failed to convert text to speech: ${(error as Error).message}`);
    }
  }
  
  /**
   * Convert text to speech and save to a temporary file.
   */
  async textToSpeechFile(
    text: string, 
    options: TTSOptions = {}
  ): Promise<{ filePath: string, contentType: string }> {
    try {
      const { audioBuffer, contentType } = await this.textToSpeech(text, options);
      
      // Generate a unique filename and temporary file path
      const filename = `tts-${uuidv4()}.mp3`;
      const filePath = path.join(TMP_DIR, filename);
      
      fs.writeFileSync(filePath, audioBuffer);
      
      return { filePath, contentType };
    } catch (error) {
      throw new ElevenLabsError(`Failed to save audio to file: ${(error as Error).message}`);
    }
  }
  
  /**
   * Generate speech using ElevenLabs and return result based on returnType.
   * Supports 'url' (using a temporary file) and 'base64' (or 'stream', treated as base64).
   */
  async generateSpeech(params: {
    text: string;
    voiceId: string;
    outputFormat: string;
    returnType: string;
  }): Promise<{ audioUrl?: string, audioBase64?: string, contentType: string, duration?: number, error?: string }> {
    try {
      if (params.returnType === 'url') {
        const { filePath, contentType } = await this.textToSpeechFile(params.text, { voiceId: params.voiceId });
        // For demonstration purposes, we return the local file path as the audioUrl.
        // In a production environment, you might upload this file to cloud storage and return its public URL.
        return { audioUrl: filePath, contentType };
      } else {
        // For 'base64' or 'stream', convert the audio buffer to a base64 string.
        const { audioBuffer, contentType } = await this.textToSpeech(params.text, { voiceId: params.voiceId });
        const audioBase64 = audioBuffer.toString('base64');
        return { audioBase64, contentType };
      }
    } catch (error) {
      if (error instanceof ElevenLabsError) {
        return { error: error.message, contentType: '' };
      }
      return { error: (error as Error).message, contentType: '' };
    }
  }
  
  /**
   * Get all available voices from ElevenLabs.
   */
  async getVoices(): Promise<Voice[]> {
    try {
      const response = await axios.get(
        `${this.apiUrl}/${VOICES_ENDPOINT}`,
        {
          headers: {
            'xi-api-key': this.apiKey,
            'Content-Type': 'application/json',
          },
        }
      );
      return response.data.voices;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const statusCode = error.response?.status || 500;
        const errorMessage = error.response?.data?.message || error.message;
        throw new ElevenLabsError(`ElevenLabs API error: ${errorMessage}`, statusCode);
      }
      throw new ElevenLabsError(`Failed to fetch voices: ${(error as Error).message}`);
    }
  }
  
  /**
   * Sync ElevenLabs voices with our database.
   */
  async syncVoicesToDatabase(): Promise<void> {
    try {
      const voices = await this.getVoices();
      for (const voice of voices) {
        await prisma.voiceProfile.upsert({
          where: {
            id: voice.voice_id,
          },
          update: {
            name: voice.name,
            provider: 'elevenlabs',
            providerVoiceId: voice.voice_id,
            gender: voice.gender || null,
            accent: voice.accent || null,
            previewUrl: voice.preview_url,
            isSystem: true,
            updatedAt: new Date(),
          },
          create: {
            id: voice.voice_id,
            name: voice.name,
            provider: 'elevenlabs',
            providerVoiceId: voice.voice_id,
            gender: voice.gender || null,
            accent: voice.accent || null,
            previewUrl: voice.preview_url,
            isSystem: true,
            isDefault: false,
            isPremium: false,
          },
        });
      }
    } catch (error) {
      throw new ElevenLabsError(`Failed to sync voices to database: ${(error as Error).message}`);
    }
  }
  
  /**
   * Try to parse an error message from response data.
   */
  private tryParseErrorMessage(data: any): string {
    try {
      if (Buffer.isBuffer(data)) {
        const textData = data.toString('utf8');
        const jsonData = JSON.parse(textData);
        return jsonData.detail?.message || jsonData.message || textData;
      }
      if (typeof data === 'object') {
        return data.detail?.message || data.message || JSON.stringify(data);
      }
      return String(data);
    } catch (err) {
      return 'Unknown error occurred';
    }
  }
  
  /**
   * Helper method to get a voice profile from the database.
   */
  async getVoiceProfile(voiceId: string): Promise<any> {
    return prisma.voiceProfile.findUnique({
      where: { id: voiceId },
    });
  }
}

const elevenLabsService = new ElevenLabsService();
export default elevenLabsService;
