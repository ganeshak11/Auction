import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export function configurePassport() {
  const serverUrl = process.env.SERVER_URL || '';
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID || '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
        callbackURL: serverUrl ? `${serverUrl}/auth/google/callback` : '/auth/google/callback',
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const user = await prisma.user.upsert({
            where: { googleId: profile.id },
            update: {
              name: profile.displayName,
              avatar: profile.photos?.[0]?.value,
            },
            create: {
              googleId: profile.id,
              name: profile.displayName,
              email: profile.emails?.[0]?.value || '',
              avatar: profile.photos?.[0]?.value,
            },
          });
          done(null, user);
        } catch (error) {
          done(error as Error);
        }
      }
    )
  );
}
