import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { prisma } from '../index';
import { SOCKET_EVENTS, JoinRoomPayload, PlaceBidPayload, StartAuctionPayload, WithdrawPayload } from './events';
import { AuctionEngine } from '../engine/auctionEngine';

// Map roomId → AuctionEngine instance
const engines: Map<string, AuctionEngine> = new Map();

export function setupSocketHandlers(io: Server) {
  io.on('connection', (socket: Socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on(SOCKET_EVENTS.JOIN_ROOM, async (payload: JoinRoomPayload) => {
      try {
        const decoded = jwt.verify(
          payload.token,
          process.env.JWT_SECRET || 'dev-secret'
        ) as { userId: string };

        const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
        if (!user) {
          socket.emit(SOCKET_EVENTS.ERROR, { message: 'User not found' });
          return;
        }

        const room = await prisma.room.findUnique({
          where: { code: payload.roomCode.toUpperCase() },
          include: { participants: { include: { user: true } }, auctionState: true },
        });

        if (!room) {
          socket.emit(SOCKET_EVENTS.ERROR, { message: 'Room not found' });
          return;
        }

        // Store user info on socket
        (socket as any).userId = user.id;
        (socket as any).userName = user.name;
        (socket as any).roomId = room.id;
        (socket as any).roomCode = room.code;

        // Find participant to get team name
        const participant = room.participants.find(p => p.userId === user.id);
        if (participant) {
          (socket as any).teamName = participant.teamName;
        }

        socket.join(room.code);

        // Send room update to all in room
        io.to(room.code).emit(SOCKET_EVENTS.ROOM_UPDATE, {
          participants: room.participants,
          status: room.status,
        });

        // If auction is active, send current state
        if (room.auctionState && engines.has(room.id)) {
          const engine = engines.get(room.id)!;
          socket.emit(SOCKET_EVENTS.AUCTION_STATE, engine.getState());
        }
      } catch (error) {
        console.error('Join room error:', error);
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to join room' });
      }
    });

    socket.on(SOCKET_EVENTS.START_AUCTION, async (payload: StartAuctionPayload) => {
      try {
        const room = await prisma.room.findUnique({
          where: { id: payload.roomId },
          include: { participants: { include: { user: true } } },
        });

        if (!room) {
          socket.emit(SOCKET_EVENTS.ERROR, { message: 'Room not found' });
          return;
        }

        if (room.hostId !== (socket as any).userId) {
          socket.emit(SOCKET_EVENTS.ERROR, { message: 'Only host can start auction' });
          return;
        }

        // Check all participants have teams
        const unassigned = room.participants.filter(p => !p.teamName);
        if (unassigned.length > 0) {
          socket.emit(SOCKET_EVENTS.ERROR, { message: 'All participants must have teams assigned' });
          return;
        }

        // Get players — use host-selected players if available, otherwise all
        const selectedPlayers = await prisma.roomPlayer.findMany({
          where: { roomId: room.id },
          include: { player: true },
          orderBy: { player: { basePrice: 'desc' } },
        });

        const players = selectedPlayers.length > 0
          ? selectedPlayers.map(sp => sp.player)
          : await prisma.player.findMany({ orderBy: { basePrice: 'desc' } });

        if (players.length === 0) {
          socket.emit(SOCKET_EVENTS.ERROR, { message: 'No players selected. Run seed or select players first.' });
          return;
        }

        // Create auction state
        await prisma.auctionState.upsert({
          where: { roomId: room.id },
          create: { roomId: room.id, status: 'BIDDING' },
          update: { status: 'BIDDING', currentPlayerIdx: 0, currentPrice: 0, currentTeam: null, currentUserId: null, withdrawnTeams: [] },
        });

        await prisma.room.update({
          where: { id: room.id },
          data: { status: 'AUCTIONING' },
        });

        // Create engine instance
        const engine = new AuctionEngine(room, players, io);
        engines.set(room.id, engine);

        // Start the first player
        engine.startNextPlayer();

        io.to(room.code).emit(SOCKET_EVENTS.AUCTION_STATE, engine.getState());
      } catch (error) {
        console.error('Start auction error:', error);
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to start auction' });
      }
    });

    socket.on(SOCKET_EVENTS.PLACE_BID, async (payload: PlaceBidPayload) => {
      try {
        const engine = engines.get(payload.roomId);
        if (!engine) {
          socket.emit(SOCKET_EVENTS.ERROR, { message: 'Auction not active' });
          return;
        }

        const userId = (socket as any).userId;
        const teamName = (socket as any).teamName;

        if (!teamName) {
          socket.emit(SOCKET_EVENTS.ERROR, { message: 'No team assigned' });
          return;
        }

        await engine.placeBid(userId, teamName, payload.amount);
      } catch (error: any) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: error.message || 'Bid failed' });
      }
    });

    socket.on(SOCKET_EVENTS.WITHDRAW, async (payload: WithdrawPayload) => {
      try {
        const engine = engines.get(payload.roomId);
        if (!engine) {
          socket.emit(SOCKET_EVENTS.ERROR, { message: 'Auction not active' });
          return;
        }

        const teamName = (socket as any).teamName;
        if (!teamName) {
          socket.emit(SOCKET_EVENTS.ERROR, { message: 'No team assigned' });
          return;
        }

        engine.withdraw(teamName);
      } catch (error: any) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: error.message || 'Withdraw failed' });
      }
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
}

export { engines };
