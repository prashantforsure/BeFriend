import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/whatsapp/webhook
 * - Receives incoming WhatsApp messages via Twilio's webhook.
 * - Detects the trigger message ("Hi") and, if detected, initiates a voice call.
 * - Logs the incoming request for analytics/troubleshooting.
 */
export async function POST(req: NextRequest) {
  try {
    // Attempt to parse JSON; if that fails, try parsing form-data.
    let body: any;
    try {
      body = await req.json();
    } catch (err) {
      const formData = await req.formData();
      body = {};
      formData.forEach((value, key) => {
        body[key] = value;
      });
    }

    console.log('Received WhatsApp webhook:', body);

    // Extract key fields from the payload.
    // Twilio usually sends message text in "Body" and sender's number in "From".
    const messageBody = body.Body || body.body || '';
    const from = body.From || body.from || '';
    // Optionally, if personaId is included in the payload.
    const personaId = body.personaId || null;

    // Check if the incoming message exactly matches the trigger ("Hi"), case-insensitive.
    if (messageBody.trim().toLowerCase() === 'hi') {
      // Prepare payload for initiating the voice call.
      const payload = {
        phoneNumber: from,
        personaId: personaId, // This can be null if not provided.
      };

      // Construct the full URL to the call endpoint.
      // Ensure BASE_URL is defined in your environment variables (fallback to localhost for development).
      const callEndpoint = `${process.env.BASE_URL || 'http://localhost:3000'}/api/whatsapp/call`;

      // Initiate the voice call by making a POST request to the /api/whatsapp/call endpoint.
      const callResponse = await fetch(callEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!callResponse.ok) {
        const errorText = await callResponse.text();
        console.error('Call endpoint error:', errorText);
        return NextResponse.json(
          { error: 'Failed to initiate voice call' },
          { status: 500 }
        );
      }

      console.log(`Voice call initiated for ${from}`);
      return NextResponse.json({ message: 'Trigger detected, voice call initiated' });
    }

    // If no trigger is detected, log and return a no-action message.
    console.log('No trigger detected for message:', messageBody);
    return NextResponse.json({ message: 'No trigger detected, no action taken' });
  } catch (error) {
    console.error('Error in WhatsApp webhook:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * GET /api/whatsapp/webhook
 * - Provides a basic response indicating that the webhook endpoint is active.
 */
export async function GET(req: NextRequest) {
  return NextResponse.json({ message: 'WhatsApp webhook endpoint is active.' });
}
