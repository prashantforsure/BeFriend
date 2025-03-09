import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import { Readable } from 'stream';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import os from 'os';

// Interface definitions
interface TranscribeAudioParams {
  audioBuffer: Buffer;
  language?: string;
  prompt?: string;
}

interface TranscribeAudioStreamParams {
  audioStream: Readable;
  language?: string;
  prompt?: string;
}

interface TranscribeAudioUrlParams {
  audioUrl: string;
  language?: string;
  prompt?: string;
}

interface TranscriptionResponse {
  text: string;
  language?: string;
  segments?: Array<{
    id: number;
    start: number;
    end: number;
    text: string;
  }>;
  error?: string;
}

/**
 * Service for handling speech-to-text with Whisper API
 */
export const whisperService = {
  /**
   * Transcribe audio from a buffer
   */
  transcribeAudio: async ({ 
    audioBuffer, 
    language = 'en', 
    prompt = '' 
  }: TranscribeAudioParams): Promise<TranscriptionResponse> => {
    try {
      // Create FormData instance
      const formData = new FormData();
      
      // Create a temporary file to store the audio buffer
      const tempFilePath = path.join(os.tmpdir(), `whisper-audio-${uuidv4()}.wav`);
      fs.writeFileSync(tempFilePath, audioBuffer);
      
      // Add audio file to form data
      formData.append('file', fs.createReadStream(tempFilePath), {
        filename: 'audio.wav',
        contentType: 'audio/wav',
      });
      
      // Add other parameters
      formData.append('model', 'whisper-1');
      formData.append('language', language);
      
      if (prompt) {
        formData.append('prompt', prompt);
      }
      
      // Make API request to Whisper
      const response = await axios.post(
        'https://api.openai.com/v1/audio/transcriptions',
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          },
        }
      );
      
      // Clean up temporary file
      fs.unlinkSync(tempFilePath);
      
      return {
        text: response.data.text,
        language: response.data.language,
        segments: response.data.segments
      };
    } catch (error: any) {
      console.error('Error transcribing audio:', error);
      return {
        text: '',
        error: error?.response?.data?.error?.message || error.message
      };
    }
  },
  
  /**
   * Transcribe audio from a stream
   */
  transcribeAudioStream: async ({ 
    audioStream, 
    language = 'en', 
    prompt = '' 
  }: TranscribeAudioStreamParams): Promise<TranscriptionResponse> => {
    try {
      // Create a buffer from the stream
      const chunks: Buffer[] = [];
      
      // Handle stream data
      await new Promise<void>((resolve, reject) => {
        audioStream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        audioStream.on('error', (err) => reject(err));
        audioStream.on('end', () => resolve());
      });
      
      // Concatenate chunks into a single buffer
      const audioBuffer = Buffer.concat(chunks);
      
      // Use the transcribeAudio method
      return await whisperService.transcribeAudio({
        audioBuffer,
        language,
        prompt
      });
    } catch (error: any) {
      console.error('Error transcribing audio stream:', error);
      return {
        text: '',
        error: error.message
      };
    }
  },
  
  /**
   * Transcribe audio from a URL
   */
  transcribeAudioUrl: async ({ 
    audioUrl, 
    language = 'en', 
    prompt = '' 
  }: TranscribeAudioUrlParams): Promise<TranscriptionResponse> => {
    try {
      // Download the audio file
      const response = await axios.get(audioUrl, {
        responseType: 'arraybuffer'
      });
      
      // Convert to buffer
      const audioBuffer = Buffer.from(response.data);
      
      // Use the transcribeAudio method
      return await whisperService.transcribeAudio({
        audioBuffer,
        language,
        prompt
      });
    } catch (error: any) {
      console.error('Error transcribing audio from URL:', error);
      return {
        text: '',
        error: error.message
      };
    }
  },
  
  /**
   * Process real-time audio chunks for transcription (useful for streaming)
   */
  processRealTimeAudio: async (
    audioChunks: Buffer[],
    language: string = 'en'
  ): Promise<TranscriptionResponse> => {
    try {
      // Concatenate audio chunks into a single buffer
      const audioBuffer = Buffer.concat(audioChunks);
      
      // Use the transcribeAudio method with the concatenated buffer
      return await whisperService.transcribeAudio({
        audioBuffer,
        language
      });
    } catch (error: any) {
      console.error('Error processing real-time audio:', error);
      return {
        text: '',
        error: error.message
      };
    }
  },
  
  /**
   * Format audio data for optimal Whisper API processing
   */
  formatAudioForWhisper: (audioBuffer: Buffer): Buffer => {
    // In a production app, you might need to convert audio to a format
    // that Whisper API handles best (e.g., resample to 16kHz)
    // This is a placeholder for any audio format conversion logic
    return audioBuffer;
  }
};

export default whisperService;