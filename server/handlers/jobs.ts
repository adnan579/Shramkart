import { requireRole } from '../lib/guards.ts';
import { respond } from '../lib/respond.ts';
import { createJob, updateJob } from '../services/jobs.ts';
import type { NativeHandler } from '../next/native.ts';

export const jobCreate: NativeHandler = async (c) => {
  const auth = requireRole(c, 'employer');
  return respond(c, { job: await createJob(c.ctx, auth, c.body) }, 201);
};

export const jobUpdate: NativeHandler = async (c) => {
  const auth = requireRole(c, 'employer');
  return respond(c, { job: await updateJob(c.ctx, auth, c.params.id!, c.body) });
};
