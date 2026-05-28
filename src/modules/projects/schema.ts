import { z } from "zod";

export const projectStatusEnum = z.enum([
  "active",
  "on_hold",
  "completed",
  "archived",
]);

export const projectBillingTypeEnum = z.enum(["hourly", "fixed"]);

const emptyToNull = (v: unknown) => (v === "" || v == null ? null : v);

const nullableText = (max: number) =>
  z.preprocess(emptyToNull, z.string().trim().max(max).nullable());

const nullableDate = z.preprocess(
  emptyToNull,
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
    .nullable(),
);

const nullableNumber = z.preprocess(
  (v) => (v === "" || v == null ? null : Number(v)),
  z.number().min(0).nullable(),
);

export const projectInputSchema = z.object({
  clientId: z.uuid(),
  name: z.string().trim().min(1).max(200),
  code: nullableText(50),
  status: projectStatusEnum,
  hourlyRate: nullableNumber,
  currency: z.preprocess(
    (v) => (v === "" || v == null ? "SEK" : v),
    z.string().trim().min(1).max(10),
  ),
  billingType: projectBillingTypeEnum,
  fixedPrice: nullableNumber,
  startDate: nullableDate,
  endDate: nullableDate,
});

export type ProjectInput = z.infer<typeof projectInputSchema>;
