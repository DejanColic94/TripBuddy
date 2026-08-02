export const tripRoles = ["admin", "user", "guest"] as const;

export type TripRole = (typeof tripRoles)[number];
export type TripPermission = "view" | "contribute" | "manage";

const rolePermissions: Record<TripRole, readonly TripPermission[]> = {
  admin: ["view", "contribute", "manage"],
  user: ["view", "contribute"],
  guest: ["view"],
};

export function isTripRole(role: unknown): role is TripRole {
  return typeof role === "string" && tripRoles.includes(role as TripRole);
}

export function roleHasPermission(
  role: TripRole,
  permission: TripPermission
): boolean {
  return rolePermissions[role].includes(permission);
}
