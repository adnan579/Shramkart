import type { z } from 'zod';
import { badRequest } from './errors.ts';
import { firstIssue } from './schemas.ts';

/** Validates a request body or query against a zod schema; the first problem becomes a 400 with a readable message. */
export function parse<T extends z.ZodType>(schema: T, data: unknown): z.output<T> {
  const r = schema.safeParse(data);
  if (!r.success) throw badRequest(firstIssue(r.error));
  return r.data;
}
