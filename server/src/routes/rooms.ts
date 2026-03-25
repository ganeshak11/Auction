import { Router, Request, Response } from 'express';
import { prisma } from '../index';

export const roomRouter = Router();

const IPL_TEAMS = ['CSK', 'RCB', 'MI', 'KKR', 'SRH', 'RR', 'DC', 'PBKS', 'GT', 'LSG'];

function generateRoomCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Create room
roomRouter.post('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const {
      purse = 100,
      maxPlayers = 25,
      minPlayers = 15,
      overseasLimit = 8,
      timerDuration = 15,
      minBat = 3,
      minBowl = 3,
      minAr = 1,
      minWk = 1,
    } = req.body;

    let code = generateRoomCode();
    while (await prisma.room.findUnique({ where: { code } })) {
      code = generateRoomCode();
    }

    const room = await prisma.room.create({
      data: {
        code,
        hostId: userId,
        purse,
        maxPlayers,
        minPlayers,
        overseasLimit,
        timerDuration,
        minBat,
        minBowl,
        minAr,
        minWk,
        status: 'LOBBY',
        participants: {
          create: {
            userId: userId,
            isHost: true,
          },
        },
      },
      include: { participants: { include: { user: true } } },
    });

    res.json({ room });
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// Join room
roomRouter.post('/join', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { code } = req.body;
    if (!code) {
      res.status(400).json({ error: 'Room code required' });
      return;
    }

    const room = await prisma.room.findUnique({
      where: { code: code.toUpperCase() },
      include: { participants: true },
    });

    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    if (room.status === 'COMPLETED') {
      res.status(400).json({ error: 'Auction already completed' });
      return;
    }

    if (room.status === 'AUCTIONING') {
      res.status(400).json({ error: 'Auction already in progress' });
      return;
    }

    if (room.participants.length >= 10) {
      res.status(400).json({ error: 'Room is full' });
      return;
    }

    const existing = room.participants.find(p => p.userId === userId);
    if (existing) {
      const fullRoom = await prisma.room.findUnique({
        where: { id: room.id },
        include: { participants: { include: { user: true } } },
      });
      res.json({ room: fullRoom });
      return;
    }

    const updatedRoom = await prisma.room.update({
      where: { id: room.id },
      data: {
        participants: {
          create: {
            userId: userId,
            isHost: false,
          },
        },
      },
      include: { participants: { include: { user: true } } },
    });

    res.json({ room: updatedRoom });
  } catch (error) {
    console.error('Join room error:', error);
    res.status(500).json({ error: 'Failed to join room' });
  }
});

// Get room details
roomRouter.get('/:code', async (req: Request, res: Response) => {
  try {
    const code = req.params.code as string;
    const room = await prisma.room.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        participants: { include: { user: true } },
        squads: { include: { player: true } },
        auctionState: true,
        selectedPlayers: { include: { player: true } },
      },
    });

    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    res.json({ room });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get room' });
  }
});

// Assign teams randomly
roomRouter.post('/:code/assign-teams', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const code = req.params.code as string;
    const room = await prisma.room.findUnique({
      where: { code: code.toUpperCase() },
      include: { participants: true },
    });

    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    if (room.hostId !== userId) {
      res.status(403).json({ error: 'Only host can assign teams' });
      return;
    }

    const shuffledTeams = shuffleArray(IPL_TEAMS);

    for (let i = 0; i < room.participants.length; i++) {
      await prisma.roomParticipant.update({
        where: { id: room.participants[i].id },
        data: { teamName: shuffledTeams[i] },
      });
    }

    const updatedRoom = await prisma.room.findUnique({
      where: { id: room.id },
      include: { participants: { include: { user: true } } },
    });

    res.json({ room: updatedRoom });
  } catch (error) {
    res.status(500).json({ error: 'Failed to assign teams' });
  }
});

// Remove participant (host only)
roomRouter.delete('/:code/participants/:userId', async (req: Request, res: Response) => {
  try {
    const currentUserId = (req as any).user?.id;
    const code = req.params.code as string;
    const targetUserId = req.params.userId as string;

    const room = await prisma.room.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    if (room.hostId !== currentUserId) {
      res.status(403).json({ error: 'Only host can remove participants' });
      return;
    }

    await prisma.roomParticipant.deleteMany({
      where: { roomId: room.id, userId: targetUserId },
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove participant' });
  }
});

// Save selected players for a room (host only)
roomRouter.put('/:code/players', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const code = req.params.code as string;
    const { playerIds } = req.body;

    if (!Array.isArray(playerIds)) {
      res.status(400).json({ error: 'playerIds must be an array' });
      return;
    }

    const room = await prisma.room.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    if (room.hostId !== userId) {
      res.status(403).json({ error: 'Only host can select players' });
      return;
    }

    // Delete existing selections and insert new ones
    await prisma.roomPlayer.deleteMany({ where: { roomId: room.id } });

    if (playerIds.length > 0) {
      await prisma.roomPlayer.createMany({
        data: playerIds.map((playerId: string) => ({
          roomId: room.id,
          playerId,
        })),
      });
    }

    const selected = await prisma.roomPlayer.findMany({
      where: { roomId: room.id },
      include: { player: true },
    });

    res.json({ selectedPlayers: selected, count: selected.length });
  } catch (error) {
    console.error('Save selected players error:', error);
    res.status(500).json({ error: 'Failed to save player selection' });
  }
});

// Get selected players for a room
roomRouter.get('/:code/players', async (req: Request, res: Response) => {
  try {
    const code = req.params.code as string;
    const room = await prisma.room.findUnique({
      where: { code: code.toUpperCase() },
      include: { selectedPlayers: { include: { player: true } } },
    });

    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    res.json({ selectedPlayers: room.selectedPlayers });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get selected players' });
  }
});
