import { getUser, type User } from "@netlify/identity";

// Staff roles, mirroring the Django backend's groups.
// Set them per user in the Netlify dashboard: Identity > (user) > Roles.
export const ROLES = ["admin", "approver", "editor", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export const can = {
  view: ["admin", "approver", "editor", "viewer"] as Role[],
  write: ["admin", "approver", "editor"] as Role[],
  approve: ["admin", "approver"] as Role[],
  remove: ["admin"] as Role[],
};

export type Staff = { user: User; roles: Role[]; email: string };

export async function getStaff(): Promise<Staff | null> {
  const user = await getUser();
  if (!user) return null;
  const roles = (user.roles ?? []).filter((r): r is Role => (ROLES as readonly string[]).includes(r));
  return { user, roles, email: user.email ?? user.id };
}

export const has = (s: Staff, allowed: Role[]) => s.roles.some((r) => allowed.includes(r));
