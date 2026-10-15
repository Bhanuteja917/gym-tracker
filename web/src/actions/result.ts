import 'server-only';

import { z } from 'zod';

import { firstError } from '@/lib/validation';
import { DomainError } from '@/server/errors';

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Runs an action body, turning validation and domain errors into a message
 * for the form. Anything else (bugs, DB outages) is rethrown, as are Next's
 * redirect/notFound signals.
 */
export async function attempt<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, error: firstError(error) };
    if (error instanceof DomainError) return { ok: false, error: error.message };
    throw error;
  }
}
