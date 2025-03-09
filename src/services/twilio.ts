import { Twilio } from 'twilio';
import axios from 'axios';
import { CallStatus } from '@prisma/client';
import prisma from '@/lib/prisma';


// Initialize Twilio client with credentials from environment variables
const twilioClient = new Twilio(
  process.env.TWILIO_ACCOUNT_SID as string,
  process.env.TWILIO_AUTH_TOKEN as string
);

// Define base URL for webhooks
const BASE_URL = process.env.NODE_ENV === 'production' 
  ? process.env.PRODUCTION_URL 
  : 'https://localhost:3000';

// Types for service functions
interface SendWhatsAppMessageParams {
  to: string;
  body: string;
  mediaUrl?: string;
}

interface InitiateWhatsAppCallParams {
  to: string;
  userId: string;
  personaId: string;
  conversationId?: string;
}

interface CallStatusUpdateParams {
  callSid: string;
  status: CallStatus;
  duration?: number;
  errorMessage?: string;
}

/**
 * Service for interacting with Twilio API for WhatsApp messaging and calls
 */
export const twilioService = {
  /**
   * Send a WhatsApp message using Twilio
   */
  sendWhatsAppMessage: async ({ to, body, mediaUrl }: SendWhatsAppMessageParams) => {
    try {
      const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER;
      
      if (!fromNumber) {
        throw new Error('Twilio WhatsApp number not configured');
      }

      const messageParams: any = {
        from: `whatsapp:${fromNumber}`,
        to: `whatsapp:${to}`,
        body
      };

      // Add media URL if provided
      if (mediaUrl) {
        messageParams.mediaUrl = mediaUrl;
      }

      const message = await twilioClient.messages.create(messageParams);
      
      return message;
    } catch (error) {
      console.error('Failed to send WhatsApp message:', error);
      throw error;
    }
  },

  /**
   * Initiate a WhatsApp voice call via Twilio
   */
  initiateWhatsAppCall: async ({ to, userId, personaId, conversationId }: InitiateWhatsAppCallParams) => {
    try {
      const fromNumber = process.env.TWILIO_PHONE_NUMBER;
      
      if (!fromNumber) {
        throw new Error('Twilio phone number not configured');
      }

      // Create a new conversation if not provided
      let convoId = conversationId;
      if (!convoId) {
        const conversation = await prisma.conversation.create({
          data: {
            userId,
            personaId,
            title: `Call with ${new Date().toLocaleString()}`
          }
        });
        convoId = conversation.id;
      }

      // Create parameters for the call
      const callParams = {
        from: fromNumber,
        to: to,
        statusCallback: `${BASE_URL}/api/whatsapp/webhook/status`,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        statusCallbackMethod: 'POST',
        url: `${BASE_URL}/api/whatsapp/call/twiml?userId=${userId}&personaId=${personaId}&conversationId=${convoId}`,
        method: 'GET'
      };

      // Initiate the call
      const call = await twilioClient.calls.create(callParams);
      
      // Log the call in the database
      await prisma.callLog.create({
        data: {
          userId,
          conversationId: convoId,
          twilioCallSid: call.sid,
          phoneNumber: to,
          direction: 'outbound',
          status: 'initiated',
          fromNumber,
          toNumber: to
        }
      });

      return { call, conversationId: convoId };
    } catch (error) {
      console.error('Failed to initiate WhatsApp call:', error);
      throw error;
    }
  },

  /**
   * Generate TwiML response for voice calls
   */
  generateTwiML: (webhookUrl: string) => {
    return `
      <?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Connect>
          <Stream url="${webhookUrl}" />
        </Connect>
      </Response>
    `.trim();
  },

  /**
   * Update call status in the database
   */
  updateCallStatus: async ({ callSid, status, duration, errorMessage }: CallStatusUpdateParams) => {
    try {
      // Find the call log by Twilio Call SID
      const callLog = await prisma.callLog.findFirst({
        where: { twilioCallSid: callSid }
      });

      if (!callLog) {
        throw new Error(`Call log not found for SID: ${callSid}`);
      }

      // Update data based on status
      const updateData: any = { status };

      // If call is completed, add end time and duration
      if (status === 'completed' || status === 'failed') {
        updateData.endTime = new Date();
        
        if (duration) {
          updateData.duration = duration;
        }
        
        if (errorMessage) {
          updateData.errorMessage = errorMessage;
        }
      }

      // Update the call log
      const updatedCallLog = await prisma.callLog.update({
        where: { id: callLog.id },
        data: updateData
      });

      // If call completed, also update the related conversation's endedAt
      if (status === 'completed' && callLog.conversationId) {
        await prisma.conversation.update({
          where: { id: callLog.conversationId },
          data: { endedAt: new Date() }
        });
      }

      return updatedCallLog;
    } catch (error) {
      console.error('Failed to update call status:', error);
      throw error;
    }
  },

  /**
   * Validate that a request is genuinely from Twilio
   */
  validateTwilioRequest: (url: string, params: Record<string, string>, signature: string) => {
    try {
      const authToken = process.env.TWILIO_AUTH_TOKEN as string;
      const isValid = twilioClient.validateRequest(authToken, signature, url, params);
      return isValid;
    } catch (error) {
      console.error('Failed to validate Twilio request:', error);
      return false;
    }
  },

  /**
   * End an active call
   */
  endCall: async (callSid: string) => {
    try {
      const call = await twilioClient.calls(callSid).update({ status: 'completed' });
      return call;
    } catch (error) {
      console.error('Failed to end call:', error);
      throw error;
    }
  }
};

export default twilioService;