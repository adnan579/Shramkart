import type { Queryable } from '../db.ts';
import { newId } from '../lib/ids.ts';
import { fmtDateTime } from '../lib/format.ts';

export function event(stage: string, role: 'worker' | 'employer' | 'system', actorName: string, note?: string) {
  return { id: newId('ev'), stage, toStage: stage, actorRole: role, actor: role, actorName, timestamp: fmtDateTime(new Date()), note };
}

export async function appendHistory(q: Queryable, applicationId: string, status: string | null, ev: object, extraData: Record<string, unknown> = {}) {
  await q.query(
    `UPDATE applications SET status = COALESCE($2, status),
       data = jsonb_set(data || $3::jsonb, '{history}', COALESCE(data->'history', '[]'::jsonb) || $4::jsonb),
       updated_at = now() WHERE id = $1`,
    [applicationId, status, JSON.stringify(extraData), JSON.stringify([ev])]
  );
}

/** Called whenever an application becomes Joined, once. */
export async function markJoined(q: Queryable, applicationId: string, jobId: string) {
  await q.query(`UPDATE jobs SET vacancies_left = GREATEST(vacancies_left - 1, 0) WHERE id = $1`, [jobId]);
  await q.query(`UPDATE applications SET data = data || jsonb_build_object('joinedAt', to_jsonb(now())) WHERE id = $1`, [applicationId]);
}
