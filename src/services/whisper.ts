import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import { Readable } from 'stream';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import os from 'os';

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

export const whisperService = {
  transcribeAudio: async ({ audioBuffer, language = 'en', prompt = '' }: TranscribeAudioParams): Promise<TranscriptionResponse> => {
    try {
      const formData = new FormData();
      const tempFilePath = path.join(os.tmpdir(), `whisper-audio-${uuidv4()}.wav`);
      fs.writeFileSync(tempFilePath, audioBuffer);
      formData.append('file', fs.createReadStream(tempFilePath), {
        filename: 'audio.wav',
        contentType: 'audio/wav',
      });
      formData.append('model', 'whisper-1');
      formData.append('language', language);
      if (prompt) {
        formData.append('prompt', prompt);
      }
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
      fs.unlinkSync(tempFilePath);
      return {
        text: response.data.text,
        language: response.data.language,
        segments: response.data.segments,
      };
    } catch (error: any) {
      console.error('Error transcribing audio:', error);
      return {
        text: '',
        error: error?.response?.data?.error?.message || error.message,
      };
    }
  },

  transcribeAudioStream: async ({ audioStream, language = 'en', prompt = '' }: TranscribeAudioStreamParams): Promise<TranscriptionResponse> => {
    try {
      const chunks: Buffer[] = [];
      await new Promise<void>((resolve, reject) => {
        audioStream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        audioStream.on('error', (err) => reject(err));
        audioStream.on('end', () => resolve());
      });
      const audioBuffer = Buffer.concat(chunks);
      return await whisperService.transcribeAudio({ audioBuffer, language, prompt });
    } catch (error: any) {
      console.error('Error transcribing audio stream:', error);
      return {
        text: '',
        error: error.message,
      };
    }
  },

  transcribeAudioUrl: async ({ audioUrl, language = 'en', prompt = '' }: TranscribeAudioUrlParams): Promise<TranscriptionResponse> => {
    try {
      const response = await axios.get(audioUrl, { responseType: 'arraybuffer' });
      const audioBuffer = Buffer.from(response.data);
      return await whisperService.transcribeAudio({ audioBuffer, language, prompt });
    } catch (error: any) {
      console.error('Error transcribing audio from URL:', error);
      return {
        text: '',
        error: error.message,
      };
    }
  },

  processRealTimeAudio: async (audioChunks: Buffer[], language: string = 'en'): Promise<TranscriptionResponse> => {
    try {
      const audioBuffer = Buffer.concat(audioChunks);
      return await whisperService.transcribeAudio({ audioBuffer, language });
    } catch (error: any) {
      console.error('Error processing real-time audio:', error);
      return {
        text: '',
        error: error.message,
      };
    }
  },

  formatAudioForWhisper: (audioBuffer: Buffer): Buffer => {
    return audioBuffer;
  },
};

export default whisperService;
