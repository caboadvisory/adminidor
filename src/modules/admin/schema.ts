import { z } from "zod";

export const userRoleEnum = z.enum(["admin", "member"]);
export const userLocaleEnum = z.enum(["en", "sv", "es"]);

const emptyToNull = (v: unknown) => (v === "" || v == null ? null : v);

export const createUserSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(72),
  fullName: z.preprocess(emptyToNull, z.string().trim().max(200).nullable()),
  role: userRoleEnum,
  locale: userLocaleEnum,
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  fullName: z.preprocess(emptyToNull, z.string().trim().max(200).nullable()),
  role: userRoleEnum,
  locale: userLocaleEnum,
  // Optional password reset; blank = unchanged.
  password: z.preprocess(emptyToNull, z.string().min(8).max(72).nullable()),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
