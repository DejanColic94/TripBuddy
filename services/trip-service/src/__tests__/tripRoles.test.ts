import { isTripRole, roleHasPermission } from "../tripRoles";

describe("trip role permissions", () => {
  it("gives admins complete trip access", () => {
    expect(roleHasPermission("admin", "view")).toBe(true);
    expect(roleHasPermission("admin", "contribute")).toBe(true);
    expect(roleHasPermission("admin", "manage")).toBe(true);
  });

  it("allows users to contribute without managing the trip", () => {
    expect(roleHasPermission("user", "view")).toBe(true);
    expect(roleHasPermission("user", "contribute")).toBe(true);
    expect(roleHasPermission("user", "manage")).toBe(false);
  });

  it("keeps guests read-only", () => {
    expect(roleHasPermission("guest", "view")).toBe(true);
    expect(roleHasPermission("guest", "contribute")).toBe(false);
    expect(roleHasPermission("guest", "manage")).toBe(false);
  });

  it("rejects obsolete and unknown role values", () => {
    expect(isTripRole("admin")).toBe(true);
    expect(isTripRole("user")).toBe(true);
    expect(isTripRole("guest")).toBe(true);
    expect(isTripRole("owner")).toBe(false);
    expect(isTripRole("viewer")).toBe(false);
  });
});
