import { NextRequest, NextResponse } from 'next/server';
import { whisperService } from '@/services/whisper';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth';
import prisma from '@/lib/prisma';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
  runtime: 'edge',
};

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await req.json();
    const { audioData, conversationId, language = 'en', format = 'base64' } = body;
    if (!audioData) {
      return NextResponse.json({ error: 'Audio data is required' }, { status: 400 });
    }
    if (!conversationId) {
      return NextResponse.json({ error: 'Conversation ID is required' }, { status: 400 });
    }
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId, userId: session.user.id },
    });
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }
    let transcriptionResult;
    if (format === 'base64') {
      const audioBuffer = Buffer.from(audioData, 'base64');
      transcriptionResult = await whisperService.transcribeAudio({ audioBuffer, language });
    } else if (format === 'url') {
      transcriptionResult = await whisperService.transcribeAudioUrl({ audioUrl: audioData, language });
    } else {
      return NextResponse.json({ error: 'Invalid format. Supported formats: base64, url' }, { status: 400 });
    }
    if (transcriptionResult.error) {
      console.error('Transcription error:', transcriptionResult.error);
      return NextResponse.json({ error: `Failed to transcribe audio: ${transcriptionResult.error}` }, { status: 500 });
    }
    await prisma.message.create({
      data: { conversationId, content: transcriptionResult.text, role: 'user' },
    });
    return NextResponse.json({
      text: transcriptionResult.text,
      language: transcriptionResult.language || language,
      segments: transcriptionResult.segments,
    });
  } catch (error: any) {
    console.error('STT API error:', error);
    return NextResponse.json({ error: error.message || 'Failed to process speech-to-text' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'STT service is running' });
}
