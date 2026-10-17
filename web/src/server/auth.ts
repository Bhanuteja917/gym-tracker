
import { passkey } from '@better-auth/passkey';
import { APIError, betterAuth, type BetterAuthOptions } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { nextCookies } from 'better-auth/next-js';
import { importPKCS8, SignJWT } from 'jose';

import { prisma } from './db';

/** Apple wants a short-lived ES256 JWT as the client secret (max 6 months). */
async function appleClientSecret(): Promise<string> {
  const clientId = process.env.APPLE_CLIENT_ID!;
  const privateKey = process.env.APPLE_PRIVATE_KEY!.replace(/\\n/g, '\n');
  const key = await importPKCS8(privateKey, 'ES256');
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: process.env.APPLE_KEY_ID! })
    .setIssuer(process.env.APPLE_TEAM_ID!)
    .setSubject(clientId)
    .setAudience('https://appleid.apple.com')
    .setIssuedAt(now)
    .setExpirationTime(now + 180 * 24 * 60 * 60)
    .sign(key);
}

const hasApple = Boolean(
  process.env.APPLE_CLIENT_ID &&
    process.env.APPLE_TEAM_ID &&
    process.env.APPLE_KEY_ID &&
    process.env.APPLE_PRIVATE_KEY,
);

/** Providers with credentials configured; the sign-in page shows only these. */
export const enabledProviders = {
  apple: hasApple,
};

const allowedEmails = (process.env.ALLOWED_EMAILS ?? '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const socialProviders: BetterAuthOptions['socialProviders'] = {};
if (hasApple) {
  socialProviders.apple = async () => ({
    clientId: process.env.APPLE_CLIENT_ID!,
    clientSecret: await appleClientSecret(),
  });
}

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
  socialProviders,
  trustedOrigins: hasApple ? ['https://appleid.apple.com'] : [],
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
  account: {
    // Let an Apple sign-in with the same verified email share the existing account.
    accountLinking: { enabled: true, trustedProviders: ['apple'] },
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
