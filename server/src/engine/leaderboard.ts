import { prisma } from '../index';

interface LeaderboardMetrics {
  completeness: number;    // 0-30: squad size relative to max
  roleBalance: number;     // 0-25: coverage of all roles
  purseEfficiency: number; // 0-25: how well purse was utilized
  bidDiscipline: number;   // 0-20: avg bid proximity to base price
  total: number;
}

export async function calculateLeaderboard(roomId: string) {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: {
      participants: { include: { user: true } },
      squads: { include: { player: true } },
      bids: true,
    },
  });

  if (!room) throw new Error('Room not found');

  const results: Array<{
    teamName: string;
    userId: string;
    score: number;
    rank: number;
    metrics: LeaderboardMetrics;
  }> = [];

  for (const participant of room.participants) {
    if (!participant.teamName) continue;

    const teamSquad = room.squads.filter(s => s.teamName === participant.teamName);
    const teamBids = room.bids.filter(b => b.teamName === participant.teamName);

    const metrics = calculateMetrics(teamSquad, teamBids, room.purse, room.maxPlayers);

    results.push({
      teamName: participant.teamName,
      userId: participant.userId,
      score: metrics.total,
      rank: 0,
      metrics,
    });
  }

  // Sort by score descending and assign ranks
  results.sort((a, b) => b.score - a.score);
  results.forEach((r, i) => { r.rank = i + 1; });

  // Save to database
  for (const result of results) {
    await prisma.auctionResult.upsert({
      where: { roomId_teamName: { roomId, teamName: result.teamName } },
      update: {
        score: result.score,
        rank: result.rank,
        metrics: result.metrics as any,
      },
      create: {
        roomId,
        userId: result.userId,
        teamName: result.teamName,
        score: result.score,
        rank: result.rank,
        metrics: result.metrics as any,
      },
    });
  }

  return results;
}

function calculateMetrics(
  squad: Array<{ price: number; player: { role: string; basePrice: number; isOverseas: boolean } }>,
  bids: Array<{ amount: number }>,
  totalPurse: number,
  maxPlayers: number
): LeaderboardMetrics {
  // 1. Completeness (0-30): Based on squad size
  const completeness = Math.min(30, (squad.length / Math.min(maxPlayers, 15)) * 30);

  // 2. Role Balance (0-25): Coverage of required roles
  const roles: Record<string, number> = { BAT: 0, BOWL: 0, AR: 0, WK: 0 };
  for (const s of squad) {
    roles[s.player.role] = (roles[s.player.role] || 0) + 1;
  }

  let roleScore = 0;
  // WK: need at least 1
  if (roles.WK >= 1) roleScore += 5;
  // BAT: need at least 5
  roleScore += Math.min(7, (roles.BAT / 5) * 7);
  // BOWL: need at least 5
  roleScore += Math.min(7, (roles.BOWL / 5) * 7);
  // AR: need at least 2
  roleScore += Math.min(6, (roles.AR / 2) * 6);

  const roleBalance = Math.min(25, roleScore);

  // 3. Purse Efficiency (0-25): Using 60-90% of purse is optimal
  const totalSpent = squad.reduce((sum, s) => sum + s.price, 0);
  const utilization = totalSpent / totalPurse;

  let purseEfficiency: number;
  if (utilization >= 0.6 && utilization <= 0.9) {
    purseEfficiency = 25;
  } else if (utilization > 0.9) {
    purseEfficiency = Math.max(15, 25 - (utilization - 0.9) * 100);
  } else {
    purseEfficiency = Math.max(0, utilization / 0.6 * 25);
  }

  // 4. Bid Discipline (0-20): How close purchases are to base prices
  let disciplineScore = 20;
  if (squad.length > 0) {
    const avgMarkup = squad.reduce((sum, s) => {
      const markup = s.player.basePrice > 0 ? s.price / s.player.basePrice : 1;
      return sum + markup;
    }, 0) / squad.length;

    // Lower markup (closer to base) = higher discipline
    // 1.0x = 20pts, 2.0x = 15pts, 3.0x = 10pts, 5.0x+ = 5pts
    if (avgMarkup <= 1.5) disciplineScore = 20;
    else if (avgMarkup <= 2.5) disciplineScore = 15;
    else if (avgMarkup <= 4.0) disciplineScore = 10;
    else disciplineScore = 5;
  }

  const total = Math.round(completeness + roleBalance + purseEfficiency + disciplineScore);

  return {
    completeness: Math.round(completeness),
    roleBalance: Math.round(roleBalance),
    purseEfficiency: Math.round(purseEfficiency),
    bidDiscipline: disciplineScore,
    total: Math.min(100, total),
  };
}
