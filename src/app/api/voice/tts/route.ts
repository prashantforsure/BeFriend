import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth/auth';
import prisma from '@/lib/prisma';
import elevenLabsService from '@/services/elevanlabs';

export const config = {
  runtime: 'edge',
};

/**
 * API Route for Text-to-Speech conversion
 * Endpoint: /api/voice/tts
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
      text, 
      conversationId,
      voiceId,
      outputFormat = 'mp3', // 'mp3', 'pcm', etc.
      returnType = 'stream', // 'stream', 'url', or 'base64'
    } = body;

    if (!text) {
      return NextResponse.json(
        { error: 'Text content is required' },
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
      include: {
        persona: true,
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Determine which voice to use
    let finalVoiceId = voiceId;
    
    // If no voiceId is provided, use the persona's voice
    if (!finalVoiceId && conversation.persona?.voiceId) {
      finalVoiceId = conversation.persona.voiceId;
    }
    
    // If still no voiceId, check user preferences
    if (!finalVoiceId) {
      const userPreferences = await prisma.userPreferences.findUnique({
        where: { userId: session.user.id },
      });
      
      if (userPreferences?.preferredVoiceId) {
        finalVoiceId = userPreferences.preferredVoiceId;
      }
    }
    
    // If still no voice ID, use default voice
    if (!finalVoiceId) {
      const defaultVoice = await prisma.voiceProfile.findFirst({
        where: { isDefault: true },
      });
      
      if (defaultVoice) {
        finalVoiceId = defaultVoice.id;
      } else {
        return NextResponse.json(
          { error: 'No voice specified and no default voice found' },
          { status: 400 }
        );
      }
    }
    
    // Get the voice profile from the database
    const voiceProfile = await prisma.voiceProfile.findUnique({
      where: { id: finalVoiceId },
    });
    
    if (!voiceProfile) {
      return NextResponse.json(
        { error: 'Voice profile not found' },
        { status: 404 }
      );
    }
    
    // Check if this is a premium voice and user has appropriate subscription
    if (voiceProfile.isPremium) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
      });
      
      if (user?.subscriptionTier === 'FREE') {
        return NextResponse.json(
          { error: 'This voice requires a premium subscription' },
          { status: 403 }
        );
      }
    }

    // Generate speech using ElevenLabs
    const speechResult = await elevenLabsService.generateSpeech({
      text,
      voiceId: voiceProfile.providerVoiceId, // Use the provider's voice ID
      outputFormat,
      returnType,
    });

    // Check for TTS errors
    if (speechResult.error) {
      console.error('TTS error:', speechResult.error);
      return NextResponse.json(
        { error: `Failed to generate speech: ${speechResult.error}` },
        { status: 500 }
      );
    }

    // Store the assistant message in the database
    const message = await prisma.message.create({
      data: {
        conversationId,
        content: text,
        role: 'assistant',
        audioUrl: speechResult.audioUrl || null,
        duration: speechResult.duration || null,
      },
    });

    // Return the appropriate response based on return type
    return NextResponse.json({
      messageId: message.id,
      ...speechResult,
    });
  } catch (error: any) {
    console.error('TTS API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process text-to-speech' },
      { status: 500 }
    );
  }
}

/**
 * API Route for Text-to-Speech health check
 * Endpoint: /api/voice/tts
 * Method: GET
 */
export async function GET() {
  return NextResponse.json({ status: 'TTS service is running' });
}