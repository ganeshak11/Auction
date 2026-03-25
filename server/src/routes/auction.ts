import { Router, Request, Response } from 'express';
import { prisma } from '../index';
import { calculateLeaderboard } from '../engine/leaderboard';

export const auctionRouter = Router();

// Get auction state
auctionRouter.get('/:roomId/state', async (req: Request, res: Response) => {
  try {
    const roomId = req.params.roomId as string;
    const room = await prisma.room.findFirst({
      where: { OR: [{ id: roomId }, { code: roomId.toUpperCase() }] },
      include: {
        auctionState: true,
        participants: { include: { user: true } },
        squads: { include: { player: true } },
      },
    });

    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    const players = await prisma.player.findMany({ orderBy: { basePrice: 'desc' } });
    const bids = await prisma.bid.findMany({
      where: { roomId: room.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Calculate purse for each team
    const teamPurses: Record<string, number> = {};
    for (const p of room.participants) {
      if (p.teamName) {
        const spent = room.squads
          .filter((s: any) => s.teamName === p.teamName)
          .reduce((sum: number, s: any) => sum + s.price, 0);
        teamPurses[p.teamName] = room.purse - spent;
      }
    }

    res.json({
      room,
      auctionState: room.auctionState,
      players,
      bids,
      teamPurses,
      squads: room.squads,
    });
  } catch (error) {
    console.error('Get auction state error:', error);
    res.status(500).json({ error: 'Failed to get auction state' });
  }
});

// Get results
auctionRouter.get('/:roomId/results', async (req: Request, res: Response) => {
  try {
    const roomId = req.params.roomId as string;
    const room = await prisma.room.findFirst({
      where: { OR: [{ id: roomId }, { code: roomId.toUpperCase() }] },
      include: {
        results: { include: { user: true }, orderBy: { rank: 'asc' } },
        squads: { include: { player: true } },
        participants: { include: { user: true } },
      },
    });

    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    // If results don't exist yet, calculate them
    if (room.results.length === 0 && room.status === 'COMPLETED') {
      const results = await calculateLeaderboard(room.id);
      res.json({ results, squads: room.squads });
      return;
    }

    res.json({ results: room.results, squads: room.squads });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get results' });
  }
});

// Export CSV
auctionRouter.get('/:roomId/export', async (req: Request, res: Response) => {
  try {
    const roomId = req.params.roomId as string;
    const room = await prisma.room.findFirst({
      where: { OR: [{ id: roomId }, { code: roomId.toUpperCase() }] },
      include: {
        squads: { include: { player: true } },
      },
    });

    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    let csv = 'Team,Player,Role,Country,Price (Cr)\n';
    const sortedSquads = room.squads.sort((a: any, b: any) => a.teamName.localeCompare(b.teamName));
    for (const squad of sortedSquads) {
      csv += `${squad.teamName},${squad.player.name},${squad.player.role},${squad.player.country},${squad.price}\n`;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=auction_${room.code}.csv`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: 'Failed to export results' });
  }
});
