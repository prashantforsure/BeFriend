// prisma/seed.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create default personas
  await prisma.persona.createMany({
    data: [
      {
        name: 'Friend',
        description: 'A friendly companion to chat with',
        isDefault: true,
        isSystem: true,
        promptTemplate: 'You are a friendly AI companion...',
        voiceId: 'default-friend-voice',
      },
      {
        name: 'Girlfriend',
        description: 'A romantic companion',
        isSystem: true,
        promptTemplate: 'You are a romantic AI companion...',
        voiceId: 'default-girlfriend-voice',
      },
      // Add more personas
    ],
  });
  
  // Create default voice profiles
  await prisma.voiceProfile.createMany({
    data: [
      {
        name: 'Friendly Voice',
        provider: 'elevenlabs',
        providerVoiceId: 'default-friend-voice',
        isDefault: true,
        isSystem: true,
      },
      // Add more voices
    ],
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });