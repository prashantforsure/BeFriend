import axios from 'axios';
import { Message } from '@prisma/client';
import prisma from '@/lib/prisma';

const TOGETHER_API_URL = 'https://api.together.xyz/v1/completions';
const TOGETHER_API_KEY = process.env.TOGETHER_API_KEY;
const DEFAULT_MODEL = 'mistralai/Mistral-7B-Instruct-v0.2';
const MAX_TOKENS = 1000;
const TEMPERATURE = 0.7;
const MAX_MESSAGES_HISTORY = 10; 

// Error class
export class TogetherAIError extends Error {
  statusCode?: number;
  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'TogetherAIError';
    this.statusCode = statusCode;
  }
}

interface TogetherAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    text: string;
    index: number;
    logprobs: any;
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface GenerateOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string;
  includePersonaContext?: boolean;
  streamResponse?: boolean;
}

// Main service class
export class TogetherAIService {
  private apiKey: string;
  private apiUrl: string;
  
  constructor() {
    this.apiKey = TOGETHER_API_KEY || '';
    this.apiUrl = TOGETHER_API_URL;
    
    if (!this.apiKey) {
      console.warn('TogetherAI API key is not set. API calls will fail.');
    }
  }
  
  /**
   * Generate a response from TogetherAI
   */
  async generateResponse(
    userInput: string,
    personaId: string,
    conversationId: string,
    options: GenerateOptions = {}
  ): Promise<string> {
    try {
      // Get persona details from database
      const persona = await prisma.persona.findUnique({
        where: { id: personaId },
      });
      
      if (!persona) {
        throw new TogetherAIError('Persona not found', 404);
      }
      
      // Get conversation history only if conversationId is provided
      const conversationHistory = conversationId 
        ? await this.getConversationHistory(conversationId)
        : [];
      
      // Construct prompt with context
      const prompt = await this.constructPrompt(
        userInput,
        persona.promptTemplate,
        conversationHistory,
        options.includePersonaContext ?? true
      );
      
      // API request configuration
      const requestPayload = {
        model: options.model || DEFAULT_MODEL,
        prompt: prompt,
        max_tokens: options.maxTokens || MAX_TOKENS,
        temperature: options.temperature || TEMPERATURE,
        stream: options.streamResponse || false,
        stop: ["\nUser:", "\nHuman:", "<end>"],
      };
      
      // Make API request
      const response = await axios.post<TogetherAIResponse>(
        this.apiUrl,
        requestPayload,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 15000, // 15 seconds timeout
        }
      );
      
      // Extract and clean the response text
      const generatedText = this.cleanResponse(response.data.choices[0].text);
      
      // Save the assistant response to conversation history if conversationId is provided
      if (conversationId) {
        await this.saveMessageToHistory(conversationId, generatedText, 'assistant');
      }
      
      return generatedText;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const statusCode = error.response?.status || 500;
        const errorMessage = error.response?.data?.message || error.message;
        throw new TogetherAIError(`TogetherAI API error: ${errorMessage}`, statusCode);
      }
      
      throw new TogetherAIError(`Failed to generate response: ${(error as Error).message}`);
    }
  }
  
  /**
   * Construct a complete prompt with conversation history and context
   */
  private async constructPrompt(
    userInput: string,
    personaTemplate: string,
    conversationHistory: Message[],
    includePersonaContext: boolean
  ): Promise<string> {
    // Format conversation history into a string
    let historyText = '';
    
    if (conversationHistory.length > 0) {
      historyText = conversationHistory.map(msg => {
        const role = msg.role === 'user' ? 'User' : 'Assistant';
        return `\n${role}: ${msg.content}`;
      }).join('\n');
    }
    
    // Base prompt with system instructions and persona context
    let fullPrompt = '';
    
    if (includePersonaContext) {
      fullPrompt = `${personaTemplate}\n\nConversation history:${historyText}\n\nUser: ${userInput}\nAssistant:`;
    } else {
      fullPrompt = `Conversation history:${historyText}\n\nUser: ${userInput}\nAssistant:`;
    }
    
    return fullPrompt;
  }
  
  /**
   * Get the conversation history from the database
   */
  private async getConversationHistory(conversationId: string): Promise<Message[]> {
    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: MAX_MESSAGES_HISTORY,
    });
    
    // Return messages in chronological order
    return messages.reverse();
  }
  
  /**
   * Save a message to the conversation history
   */
  private async saveMessageToHistory(
    conversationId: string,
    content: string,
    role: 'user' | 'assistant'
  ): Promise<void> {
    await prisma.message.create({
      data: {
        conversationId,
        content,
        role,
      },
    });
    
    // Update the conversation's updatedAt timestamp
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });
  }
  
  /**
   * Clean up the response text to remove any unwanted artifacts
   */
  private cleanResponse(text: string): string {
    // Remove any trailing or leading whitespace
    let cleaned = text.trim();
    
    // Remove any common artifacts from LLM responses
    cleaned = cleaned.replace(/^Assistant:?\s*/i, '');
    
    // Remove any text after end markers if they exist
    const endMarkers = ['<end>', 'User:', 'Human:'];
    for (const marker of endMarkers) {
      const markerIndex = cleaned.indexOf(marker);
      if (markerIndex !== -1) {
        cleaned = cleaned.substring(0, markerIndex).trim();
      }
    }
    
    return cleaned;
  }

  /**
   * Get a list of available models from TogetherAI (for admin use)
   */
  async getAvailableModels(): Promise<string[]> {
    try {
      const response = await axios.get(
        'https://api.together.xyz/v1/models',
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
          },
        }
      );
      
      return response.data.data.map((model: any) => model.id);
    } catch (error) {
      throw new TogetherAIError(`Failed to fetch available models: ${(error as Error).message}`);
    }
  }
}

// Export a singleton instance
const togetherAIService = new TogetherAIService();
export default togetherAIService;
