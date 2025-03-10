import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth';
import prisma from '@/lib/prisma';


export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    
    // Get query parameters
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    const category = url.searchParams.get('category');
    
    // If specific persona ID is requested
    if (id) {
      const persona = await prisma.persona.findUnique({
        where: { id },
        include: {
          voice: true, // Include voice profile details
        },
      });
      
      if (!persona) {
        return NextResponse.json(
          { error: 'Persona not found' },
          { status: 404 }
        );
      }
      
      // Check if premium persona is accessible to this user
      if (persona.isPremium && userId) {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { subscriptionTier: true },
        });
        
        if (user?.subscriptionTier === 'FREE') {
          return NextResponse.json(
            { error: 'Premium persona requires subscription' },
            { status: 403 }
          );
        }
      }
      
      return NextResponse.json(persona);
    }
    
    // Construct where clause for filtering
    const whereClause: any = {
      isActive: true,
    };
    
    // Filter by category if provided
    if (category) {
      whereClause.category = category;
    }
    
    // Get user subscription status if logged in
    let includeAllPersonas = false;
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { subscriptionTier: true },
      });
      
      // If premium/business user, include premium personas
      includeAllPersonas = user?.subscriptionTier !== 'FREE';
    }
    
    // Only show non-premium personas to free users
    if (!includeAllPersonas) {
      whereClause.isPremium = false;
    }
    
    const personas = await prisma.persona.findMany({
      where: whereClause,
      include: {
        voice: {
          select: {
            id: true,
            name: true,
            providerVoiceId: true,
            provider: true,
            gender: true,
          },
        },
      },
      orderBy: {
        isDefault: 'desc', // Default personas first
      },
    });
    
    return NextResponse.json(personas);
  } catch (error) {
    console.error('Error fetching personas:', error);
    return NextResponse.json(
      { error: 'Failed to fetch personas' },
      { status: 500 }
    );
  }
}