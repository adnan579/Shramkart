import type { AuthContext } from '../types.ts';
import { HttpError, forbidden, unauthorized } from './errors.ts';
import { can, type Permission } from './permissions.ts';

/** Anything that carries the caller's session: a native route's context. */
type WithAuth = { auth?: AuthContext };

export function workerId(req: WithAuth): string {
  if (!req.auth) throw unauthorized();
  if (req.auth.role !== 'worker' || !req.auth.workerId) throw forbidden('This action is for worker accounts.');
  return req.auth.workerId;
}

/** Employer team member who may change data (Owner or Recruiter). Viewers are read-only. */
export function employerWriter(req: WithAuth): string {
  if (!req.auth) throw unauthorized();
  if (req.auth.role !== 'employer' || !req.auth.employerId) throw forbidden('This action is for factory accounts.');
  if (req.auth.memberRole === 'Viewer') throw forbidden('Your team role is view-only.');
  return req.auth.employerId;
}

export function employerOwner(req: WithAuth): string {
  const id = employerWriter(req);
  if (req.auth!.memberRole !== 'Owner') throw forbidden('Only the account owner can do this.');
  return id;
}

/** The signed-in worker or factory member, if their role is one of `roles`. Staff sessions never count here. */
export function requireRole(c: WithAuth, ...roles: AuthContext['role'][]): AuthContext {
  if (!c.auth) throw unauthorized();
  if (!roles.includes(c.auth.role)) throw forbidden();
  return c.auth;
}

/** Admin API guard: a valid staff session, a finished password change, and the permission for this area. */
export function requireAdmin(c: { admin?: AuthContext }, permission?: Permission): AuthContext {
  if (!c.admin) throw unauthorized('Please sign in to the admin console.');
  if (c.admin.mustChangePassword) throw new HttpError(403, 'You must choose a new password first.', { code: 'PASSWORD_CHANGE_REQUIRED' });
  if (permission && !can(c.admin.adminRole, permission)) throw forbidden('Your role does not allow this.');
  return c.admin;
}
