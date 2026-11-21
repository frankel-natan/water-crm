export type UserRole = "manager" | "technician";

export const ROLE_LABELS: Record<UserRole, string> = {
  manager: "מנהל / מוקדן",
  technician: "טכנאי שטח",
};

export const TECHNICIAN_TABS = ["technician", "routes", "inventory", "maintenance"];

export function canAccessTab(role: UserRole, tab: string): boolean {
  if (role === "manager") return true;
  return TECHNICIAN_TABS.includes(tab);
}

export function getDefaultTabForRole(role: UserRole): string {
  return role === "manager" ? "dispatcher" : "technician";
}