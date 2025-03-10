import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import { URLSearchParams } from 'url';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth';
import prisma from '@/lib/prisma';


export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phoneNumber, personaId, conversationId } = body;
    
    // Validate request
    if (!phoneNumber) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    // Authenticate if coming from the web application
    const session = await getServerSession(authOptions);
    let userId: string | undefined = body.userId;
    
    // If no userId provided but we have a session, use the session user
    if (!userId && session?.user?.id) {
      userId = session.user.id as string;
    }
    
    // Validate user and check if they have enough call credits
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { callCredits: true },
      });
      
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      
      if (user.callCredits <= 0) {
        return NextResponse.json(
          { error: 'Insufficient call credits. Please purchase more credits.' },
          { status: 403 }
        );
      }
    }
    
    // Normalize phone number (ensure it has proper format)
    const normalizedPhoneNumber = phoneNumber.startsWith('+') 
      ? phoneNumber 
      : `+${phoneNumber}`;
    
    // Find or create conversation if not provided
    let conversationRecord: string | undefined = conversationId;
    if (!conversationRecord && userId && personaId) {
      const newConversation = await prisma.conversation.create({
        data: {
          userId,
          personaId,
          title: 'WhatsApp Call',
        },
      });
      conversationRecord = newConversation.id;
    }
    
    // Validate Twilio credentials
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!accountSid || !authToken) {
      throw new Error('Twilio credentials are not set in environment variables.');
    }
    
    // Initialize Twilio client
    const twilioClient = twilio(accountSid, authToken);
    
    // Prepare webhook base URL (fallback to host header)
    const webhookBaseUrl = process.env.WEBHOOK_BASE_URL || `https://${req.headers.get('host')}`;
    
    // Build webhook URL with conversation context
    const webhookParams = new URLSearchParams();
    if (personaId) webhookParams.append('personaId', personaId);
    if (conversationRecord) webhookParams.append('conversationId', conversationRecord);
    if (userId) webhookParams.append('userId', userId);
    
    const webhookUrl = `${webhookBaseUrl}/api/voice/stream?${webhookParams.toString()}`;
    
    // Initiate the call using Twilio's API
    const call = await twilioClient.calls.create({
      url: webhookUrl,
      to: `whatsapp:${normalizedPhoneNumber}`,
      from: `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`,
      statusCallback: `${webhookBaseUrl}/api/whatsapp/call-status`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      statusCallbackMethod: 'POST',
    });
    
    // Log the call in the database and deduct a call credit if a user is authenticated
    if (userId) {
      await prisma.callLog.create({
        data: {
          userId,
          conversationId: conversationRecord,
          twilioCallSid: call.sid,
          phoneNumber: normalizedPhoneNumber,
          direction: 'outbound',
          status: 'initiated',
          fromNumber: process.env.TWILIO_PHONE_NUMBER || '',
          toNumber: normalizedPhoneNumber,
        },
      });
      
      await prisma.user.update({
        where: { id: userId },
        data: { callCredits: { decrement: 1 } },
      });
    }
    
    return NextResponse.json({
      success: true, 
      message: 'WhatsApp call initiated',
      sid: call.sid,
      status: call.status,
    });
  } catch (error: any) {
    console.error('Error initiating WhatsApp call:', error);
    return NextResponse.json(
      { error: 'Failed to initiate WhatsApp call' },
      { status: 500 }
    );
  }
}
