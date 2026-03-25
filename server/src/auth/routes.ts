import { Router, Request, Response } from 'express';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import { authMiddleware } from './middleware';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const authRouter = Router();

// Google OAuth initiation
authRouter.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email'],
  session: false,
}));

// Google OAuth callback
authRouter.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/auth/failure' }),
  (req: Request, res: Response) => {
    const user = req.user as any;
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || 'dev-secret',
      { expiresIn: '7d' }
    );
    res.redirect(`${process.env.CLIENT_URL}/auth/callback?token=${token}`);
  }
);

// Dev login (for development without Google OAuth)
authRouter.post('/dev-login', async (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    res.status(403).json({ error: 'Dev login not available in production' });
    return;
  }

  const { name, email } = req.body;
  if (!name || !email) {
    res.status(400).json({ error: 'Name and email required' });
    return;
  }

  const user = await prisma.user.upsert({
    where: { email },
    update: { name },
    create: {
      googleId: `dev-${Date.now()}`,
      name,
      email,
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`,
    },
  });

  const token = jwt.sign(
    { userId: user.id },
    process.env.JWT_SECRET || 'dev-secret',
    { expiresIn: '7d' }
  );

  res.json({ token, user });
});

// Get current user
authRouter.get('/me', authMiddleware, async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      auctionResults: {
        include: { room: true },
        orderBy: { room: { createdAt: 'desc' } },
      },
    },
  });
  res.json({ user });
});

// Auth failure
authRouter.get('/failure', (_req: Request, res: Response) => {
  res.status(401).json({ error: 'Authentication failed' });
});
