import axios from 'axios';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import prisma from '@/lib/prisma';


// Configuration
const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const DEFAULT_VOICE_ID = process.env.ELEVENLABS_DEFAULT_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL'; // Default voice
const TTS_ENDPOINT = 'text-to-speech';
const VOICES_ENDPOINT = 'voices';
const TMP_DIR = os.tmpdir();

// Error class
export class ElevenLabsError extends Error {
  statusCode?: number;
  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'ElevenLabsError';
    this.statusCode = statusCode;
  }
}

// Types
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

// Main service class
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
   * Convert text to speech and return the audio file path
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
      
      // Make API request
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
          timeout: 30000, // 30 second timeout
        }
      );
      
      // Return the audio buffer and content type
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
   * Convert text to speech and save to a temporary file
   */
  async textToSpeechFile(
    text: string, 
    options: TTSOptions = {}
  ): Promise<{ filePath: string, contentType: string }> {
    try {
      const { audioBuffer, contentType } = await this.textToSpeech(text, options);
      
      // Generate a unique filename
      const filename = `tts-${uuidv4()}.mp3`;
      const filePath = path.join(TMP_DIR, filename);
      
      // Write the buffer to a temporary file
      fs.writeFileSync(filePath, audioBuffer);
      
      return { filePath, contentType };
    } catch (error) {
      throw new ElevenLabsError(`Failed to save audio to file: ${(error as Error).message}`);
    }
  }
  
  /**
   * Get all available voices from ElevenLabs
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
   * Sync ElevenLabs voices with our database
   */
  async syncVoicesToDatabase(): Promise<void> {
    try {
      // Get all voices from ElevenLabs
      const voices = await this.getVoices();
      
      // For each voice, create or update in our database
      for (const voice of voices) {
        await prisma.voiceProfile.upsert({
          where: {
            // Use a composite unique constraint or search by provider + providerVoiceId
            // This is a simplified version - you'll need to adjust based on your schema
            id: voice.voice_id, // This assumes you're using the ElevenLabs IDs as your IDs
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
            id: voice.voice_id, // Use the ElevenLabs ID as our ID
            name: voice.name,
            provider: 'elevenlabs',
            providerVoiceId: voice.voice_id,
            gender: voice.gender || null,
            accent: voice.accent || null,
            previewUrl: voice.preview_url,
            isSystem: true,
            isDefault: false,
            isPremium: false, // You might want to determine this based on voice quality
          },
        });
      }
    } catch (error) {
      throw new ElevenLabsError(`Failed to sync voices to database: ${(error as Error).message}`);
    }
  }
  
  /**
   * Try to parse error message from buffer
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
   * Helper method to get a voice profile from the database
   */
  async getVoiceProfile(voiceId: string): Promise<any> {
    return prisma.voiceProfile.findUnique({
      where: { id: voiceId },
    });
  }
}

// Export a singleton instance
const elevenLabsService = new ElevenLabsService();
export default elevenLabsService;