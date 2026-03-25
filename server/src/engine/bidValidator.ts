import { prisma } from '../index';

interface SquadConstraints {
  maxSquad: number;
  overseasLimit: number;
  minWK: number;
  minBAT: number;
  minBOWL: number;
  minAR: number;
}

const DEFAULT_CONSTRAINTS: SquadConstraints = {
  maxSquad: 25,
  overseasLimit: 8,
  minWK: 1,
  minBAT: 5,
  minBOWL: 5,
  minAR: 2,
};

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

export async function validateBid(
  roomId: string,
  teamName: string,
  bidAmount: number,
  playerId: string,
  purse: number,
  withdrawnTeams: string[]
): Promise<ValidationResult> {
  // Check if team has withdrawn from this player
  if (withdrawnTeams.includes(teamName)) {
    return { valid: false, reason: 'Team has withdrawn from this player' };
  }

  // Check purse
  if (bidAmount > purse) {
    return { valid: false, reason: 'Insufficient purse' };
  }

  // Get current squad
  const squad = await prisma.teamSquad.findMany({
    where: { roomId, teamName },
    include: { player: true },
  });

  // Check squad size
  if (squad.length >= DEFAULT_CONSTRAINTS.maxSquad) {
    return { valid: false, reason: 'Squad is full' };
  }

  // Get player being bid on
  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player) {
    return { valid: false, reason: 'Player not found' };
  }

  // Check overseas limit
  if (player.isOverseas) {
    const overseasCount = squad.filter(s => s.player.isOverseas).length;
    if (overseasCount >= DEFAULT_CONSTRAINTS.overseasLimit) {
      return { valid: false, reason: 'Overseas player limit reached' };
    }
  }

  // Check if team can still fill minimum requirements with remaining budget
  const remainingPurse = purse - bidAmount;
  const remainingSlots = DEFAULT_CONSTRAINTS.maxSquad - squad.length - 1; // -1 for current player
  
  // Count current role distribution
  const roles = squad.reduce((acc, s) => {
    acc[s.player.role] = (acc[s.player.role] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Include the current player's role
  const currentRole = player.role;
  const rolesAfterBid = { ...roles };
  rolesAfterBid[currentRole] = (rolesAfterBid[currentRole] || 0) + 1;

  return { valid: true };
}

export function calculateTeamPurse(totalPurse: number, squadPrices: number[]): number {
  return totalPurse - squadPrices.reduce((sum, price) => sum + price, 0);
}
