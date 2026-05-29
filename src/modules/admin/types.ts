export type UserRole = "admin" | "member";

export type AdminUser = {
  id: string;
  email: string;
  fullName: string | null;
  role: UserRole;
  locale: string;
  active: boolean;
  createdAt: string;
};
