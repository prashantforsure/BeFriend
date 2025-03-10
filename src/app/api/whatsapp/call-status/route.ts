import prisma from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';


export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    
    // Convert formData to object for easier handling
    const data: Record<string, string> = {};
    formData.forEach((value, key) => {
      data[key] = value.toString();
    });
    
    const { CallSid, CallStatus, CallDuration } = data;
    
    // Find the call log
    const callLog = await prisma.callLog.findFirst({
      where: { twilioCallSid: CallSid }
    });
    
    if (!callLog) {
      console.warn(`Call status update for unknown call SID: ${CallSid}`);
      return NextResponse.json({ received: true });
    }
    
    // Update call status
    const updateData: any = {
      status: CallStatus.toLowerCase() as any,
    };
    
    // Add end time and duration if call is completed
    if (CallStatus === 'completed') {
      const duration = parseInt(CallDuration || '0');
      updateData.endTime = new Date();
      updateData.duration = duration;
      
      // Also update the conversation endedAt time
      if (callLog.conversationId) {
        await prisma.conversation.update({
          where: { id: callLog.conversationId },
          data: { endedAt: new Date() }
        });
      }
    }
    
    // Update the call log
    await prisma.callLog.update({
      where: { id: callLog.id },
      data: updateData
    });
    
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing call status update:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}