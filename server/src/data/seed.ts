import { PrismaClient } from '@prisma/client';
import players from './players.json';

const prisma = new PrismaClient();

async function seed() {
  console.log('🌱 Seeding players...');

  // Clear existing players
  await prisma.player.deleteMany();

  for (const player of players) {
    await prisma.player.create({
      data: {
        name: player.name,
        photo: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(player.name)}`,
        battingStyle: player.battingStyle,
        bowlingStyle: player.bowlingStyle,
        role: player.role,
        country: player.country,
        basePrice: player.basePrice,
        isOverseas: player.isOverseas,
      },
    });
  }

  console.log(`✅ Seeded ${players.length} players`);
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
