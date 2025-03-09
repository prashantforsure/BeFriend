// /app/api/ai/persona/route.ts

import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    // Fetch all active personas, selecting only the fields needed for the UI
    const personas = await prisma.persona.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        description: true,
        imageUrl: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Return the list of personas as JSON
    return NextResponse.json({ personas });
  } catch (error: any) {
    console.error('Error fetching personas:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
