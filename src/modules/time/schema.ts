import { z } from "zod";

const emptyToNull = (v: unknown) => (v === "" || v == null ? null : v);

const nullableText = (max: number) =>
  z.preprocess(emptyToNull, z.string().trim().max(max).nullable());

const nullableNumber = z.preprocess(
  (v) => (v === "" || v == null ? null : Number(v)),
  z.number().min(0).nullable(),
);

export const timeEntryInputSchema = z.object({
  projectId: z.uuid(),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD"),
  hours: z.preprocess(
    (v) => (v === "" || v == null ? NaN : Number(v)),
    z.number().positive().max(744), // <= 31 days
  ),
  description: nullableText(1000),
  // Optional manual override; when omitted the server computes amount from the
  // effective rate (project rate, else client base rate) × hours.
  amount: nullableNumber,
  billable: z.preprocess(
    (v) => v === true || v === "true" || v === "on",
    z.boolean(),
  ),
});

export type TimeEntryInput = z.infer<typeof timeEntryInputSchema>;
