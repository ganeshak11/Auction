import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import passport from 'passport';
import { PrismaClient } from '@prisma/client';
import { configurePassport } from './auth/passport';
import { authRouter } from './auth/routes';
import { roomRouter } from './routes/rooms';
import { playerRouter } from './routes/players';
import { auctionRouter } from './routes/auction';
import { setupSocketHandlers } from './socket/handler';
import { authMiddleware } from './auth/middleware';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

export const prisma = new PrismaClient();

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(passport.initialize());

// Configure passport
configurePassport();

// Routes
app.use('/auth', authRouter);
app.use('/api/rooms', authMiddleware as any, roomRouter);
app.use('/api/players', authMiddleware as any, playerRouter);
app.use('/api/auction', authMiddleware as any, auctionRouter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Socket.io
setupSocketHandlers(io);

const PORT = parseInt(process.env.PORT || '3001', 10);

httpServer.listen(PORT, () => {
  console.log(`🏏 Auction server running on port ${PORT}`);
});

export { io };
