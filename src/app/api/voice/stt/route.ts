import { NextRequest, NextResponse } from 'next/server';
import { whisperService } from '@/services/whisper';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth';
import prisma from '@/lib/prisma';


export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb', // Set appropriate size limit for audio files
    },
  },
  runtime: 'edge',
};

/**
 * API Route for Speech-to-Text conversion
 * Endpoint: /api/voice/stt
 * Method: POST
 */
export async function POST(req: NextRequest) {
  try {
    // Get session for authenticated routes
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse the JSON body
    const body = await req.json();
    
    // Extract required parameters
    const { 
      audioData, 
      conversationId,
      language = 'en',
      format = 'base64', // 'base64' or 'url'
    } = body;

    if (!audioData) {
      return NextResponse.json(
        { error: 'Audio data is required' },
        { status: 400 }
      );
    }

    if (!conversationId) {
      return NextResponse.json(
        { error: 'Conversation ID is required' },
        { status: 400 }
      );
    }

    // Verify the conversation belongs to the user
    const conversation = await prisma.conversation.findUnique({
      where: {
        id: conversationId,
        userId: session.user.id,
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Process audio based on format
    let transcriptionResult;
    
    if (format === 'base64') {
      // Convert base64 to buffer
      const audioBuffer = Buffer.from(audioData, 'base64');
      transcriptionResult = await whisperService.transcribeAudio({
        audioBuffer,
        language,
      });
    } else if (format === 'url') {
      // Handle URL format
      transcriptionResult = await whisperService.transcribeAudioUrl({
        audioUrl: audioData,
        language,
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid format. Supported formats: base64, url' },
        { status: 400 }
      );
    }

    // Check for transcription errors
    if (transcriptionResult.error) {
      console.error('Transcription error:', transcriptionResult.error);
      return NextResponse.json(
        { error: `Failed to transcribe audio: ${transcriptionResult.error}` },
        { status: 500 }
      );
    }

    // Store the user message in the database
    await prisma.message.create({
      data: {
        conversationId,
        content: transcriptionResult.text,
        role: 'user',
      },
    });

    // Return the transcribed text
    return NextResponse.json({
      text: transcriptionResult.text,
      language: transcriptionResult.language || language,
      segments: transcriptionResult.segments,
    });
  } catch (error: any) {
    console.error('STT API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process speech-to-text' },
      { status: 500 }
    );
  }
}

/**
 * API Route for Speech-to-Text health check
 * Endpoint: /api/voice/stt
 * Method: GET
 */
export async function GET() {
  return NextResponse.json({ status: 'STT service is running' });
}