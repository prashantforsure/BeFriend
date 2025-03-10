import twilio from 'twilio';

interface WhatsAppCallParams {
  toPhoneNumber: string;
  userId: string;
  personaId: string;
  conversationId: string;
}

export async function initiateWhatsAppCall({
  toPhoneNumber,
  userId,
  personaId,
  conversationId
}: WhatsAppCallParams) {
  try {
    const twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    // Prepare TwiML for the call
    const webhookBaseUrl = process.env.WEBHOOK_BASE_URL || 'https://your-app-domain.com';
    
    // Build webhook URL with conversation context
    const webhookParams = new URLSearchParams();
    webhookParams.append('personaId', personaId);
    webhookParams.append('conversationId', conversationId);
    webhookParams.append('userId', userId);
    
    const webhookUrl = `${webhookBaseUrl}/api/voice/stream?${webhookParams.toString()}`;
    
    // Normalize the phone number
    const normalizedPhoneNumber = toPhoneNumber.startsWith('+') 
      ? toPhoneNumber 
      : `+${toPhoneNumber}`;
    
    // Format for WhatsApp
    const whatsappToNumber = `whatsapp:${normalizedPhoneNumber}`;
    const whatsappFromNumber = `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`;

    // Initiate the call
    const call = await twilioClient.calls.create({
      url: webhookUrl,
      to: whatsappToNumber,
      from: whatsappFromNumber,
      statusCallback: `${webhookBaseUrl}/api/whatsapp/call-status`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      statusCallbackMethod: 'POST'
    });
    
    return call;
  } catch (error) {
    console.error('Error in initiateWhatsAppCall service:', error);
    throw error;
  }
}