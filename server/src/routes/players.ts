import { Router, Request, Response } from 'express';
import { AuthRequest } from '../auth/middleware';
import { prisma } from '../index';

export const playerRouter = Router();

// Get all players
playerRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const players = await prisma.player.findMany({
      orderBy: { basePrice: 'desc' },
    });
    res.json({ players });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch players' });
  }
});

// Get player by ID
playerRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const player = await prisma.player.findUnique({
      where: { id: req.params.id as string },
    });
    if (!player) {
      res.status(404).json({ error: 'Player not found' });
      return;
    }
    res.json({ player });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch player' });
  }
});
