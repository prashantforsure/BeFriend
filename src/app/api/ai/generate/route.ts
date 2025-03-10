import { NextRequest, NextResponse } from 'next/server';

import togetherAIService from '@/services/togetherai';
import prisma from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { transcribedText, personaId, conversationId } = body;

    if (!transcribedText || !personaId) {
      return NextResponse.json(
        { error: 'Missing required fields: transcribedText or personaId' },
        { status: 400 }
      );
    }

    // Get persona from database
    const persona = await prisma.persona.findUnique({
      where: { id: personaId },
    });

    if (!persona) {
      return NextResponse.json(
        { error: 'Persona not found' },
        { status: 404 }
      );
    }

    // If conversationId exists, save the user message first
    if (conversationId) {
      await prisma.message.create({
        data: {
          conversationId,
          content: transcribedText,
          role: 'user',
        },
      });
    }

    // Generate AI response using TogetherAI
    const responseText = await togetherAIService.generateResponse(
      transcribedText,
      personaId,
      conversationId || '', // Pass an empty string if not provided
      { includePersonaContext: persona.memoryEnabled }
    );

    return NextResponse.json({ response: responseText });
  } catch (error) {
    console.error('Error generating AI response:', error);
    return NextResponse.json(
      { error: 'Failed to generate AI response' },
      { status: 500 }
    );
  }
}
