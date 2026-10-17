import { passkey } from '@better-auth/passkey';
import { APIError, betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { nextCookies } from 'better-auth/next-js';

import { prisma } from './db';

const allowedEmails = (process.env.ALLOWED_EMAILS ?? '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

// Passkeys are tied to the site's domain; WebAuthn checks the page's origin against it.
const siteURL = process.env.BETTER_AUTH_URL ? new URL(process.env.BETTER_AUTH_URL) : null;

export const auth = betterAuth({
  appName: 'SetStack',
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    // No email service is configured, so there's no verification or reset email.
    // Sign-up is still limited by ALLOWED_EMAILS (see databaseHooks below).
    autoSignIn: true,
  },
  session: {
    // Stay signed in on the phone: 60-day sessions, refreshed daily while used.
    expiresIn: 60 * 60 * 24 * 60,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  rateLimit: {
    enabled: true,
    // Serverless instances don't share memory, so count requests in the database.
    storage: 'database',
  },
  user: {
    additionalFields: {
      defaultUnit: { type: 'string', required: false, defaultValue: 'lb', input: false },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          if (allowedEmails.length > 0 && !allowedEmails.includes(user.email.toLowerCase())) {
            throw new APIError('FORBIDDEN', { message: 'This account is not allowed to sign up.' });
          }
        },
      },
    },
  },
  plugins: [
    // Face ID / Touch ID sign-in. A passkey is added from Settings by a signed-in
    // user, so it never creates an account (ALLOWED_EMAILS still applies).
    passkey({
      rpName: 'SetStack',
      ...(siteURL && { rpID: siteURL.hostname, origin: siteURL.origin }),
    }),
    nextCookies(), // must stay last
  ],
});

export type AuthSession = typeof auth.$Infer.Session;
