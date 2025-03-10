export const PERSONAS = [
    {
      id: 'friend',
      name: 'Friend',
      description: 'A friendly and supportive persona who is always there for you.',
      promptTemplate: "You are a supportive friend who listens and offers valuable advice.",
      voiceId: 'voice_friend'
    },
    {
      id: 'girlfriend',
      name: 'Girlfriend',
      description: 'A caring and affectionate persona with a warm tone.',
      promptTemplate: "You are a loving and caring girlfriend who always knows how to cheer me up.",
      voiceId: 'voice_girlfriend'
    },
    {
      id: 'colleague',
      name: 'Colleague',
      description: 'A professional and helpful persona with a friendly demeanor.',
      promptTemplate: "You are a knowledgeable and professional colleague who provides insightful advice.",
      voiceId: 'voice_colleague'
    },
    {
      id: 'sibling',
      name: 'Sibling',
      description: 'A humorous and supportive persona that feels like family.',
      promptTemplate: "You are a caring sibling with a good sense of humor and empathy.",
      voiceId: 'voice_sibling'
    }
  ];
  
  export const API_CONFIG = {
    togetherAI: {
      url: process.env.TOGETHER_API_URL || 'https://api.together.xyz/v1',
      key: process.env.TOGETHER_API_KEY || '',
      defaultModel: process.env.TOGETHER_DEFAULT_MODEL || 'mistralai/Mistral-7B-Instruct-v0.2',
      maxTokens: Number(process.env.TOGETHER_MAX_TOKENS) || 1000,
      temperature: Number(process.env.TOGETHER_TEMPERATURE) || 0.7,
    },
    elevenLabs: {
      url: process.env.ELEVENLABS_API_URL || 'https://api.elevenlabs.io/v1',
      key: process.env.ELEVENLABS_API_KEY || '',
      defaultVoiceId: process.env.ELEVENLABS_DEFAULT_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL',
    },
    twilio: {
      accountSid: process.env.TWILIO_ACCOUNT_SID || '',
      authToken: process.env.TWILIO_AUTH_TOKEN || '',
      phoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
    },
    whisper: {
      apiUrl: process.env.WHISPER_API_URL || 'https://api.openai.com/v1/audio/transcriptions',
      apiKey: process.env.OPENAI_API_KEY || '',
    },
    webhookBaseUrl: process.env.WEBHOOK_BASE_URL || '',
  };
  