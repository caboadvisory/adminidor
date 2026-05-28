import { z } from "zod";

export const clientTypeEnum = z.enum(["individual", "entity"]);
export const kycStatusEnum = z.enum([
  "not_started",
  "in_progress",
  "verified",
  "rejected",
  "expired",
]);
export const riskLevelEnum = z.enum(["low", "medium", "high"]);
export const amlScreeningTypeEnum = z.enum([
  "pep",
  "sanctions",
  "adverse_media",
]);
export const amlScreeningResultEnum = z.enum(["clear", "hit", "pending"]);

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

const checkbox = z.preprocess(
  (v) => v === true || v === "true" || v === "on",
  z.boolean(),
);

const nullableNumber = z.preprocess(
  (v) => (v === "" || v == null ? null : Number(v)),
  z.number().min(0).nullable(),
);

export const clientInputSchema = z.object({
  clientType: clientTypeEnum,
  name: z.string().trim().min(1).max(200),
  registrationNumber: nullableText(100),
  jurisdiction: nullableText(100),
  legalForm: nullableText(100),
  dateOfBirth: nullableDate,
  nationality: nullableText(100),
  nationalId: nullableText(100),
  contactEmail: z.preprocess(emptyToNull, z.email().nullable()),
  contactPhone: nullableText(50),
  addressLine1: nullableText(200),
  addressLine2: nullableText(200),
  postalCode: nullableText(20),
  city: nullableText(100),
  country: nullableText(100),
  notes: nullableText(2000),
  defaultHourlyRate: nullableNumber,
  defaultCurrency: z.preprocess(
    (v) => (v === "" || v == null ? "SEK" : v),
    z.string().trim().min(1).max(10),
  ),
  kycStatus: kycStatusEnum,
  riskLevel: z.preprocess(emptyToNull, riskLevelEnum.nullable()),
  kycReviewDue: nullableDate,
});

export type ClientInput = z.infer<typeof clientInputSchema>;

export const beneficialOwnerInputSchema = z.object({
  fullName: z.string().trim().min(1).max(200),
  dateOfBirth: nullableDate,
  nationality: nullableText(100),
  ownershipPercentage: z.preprocess(
    (v) => (v === "" || v == null ? null : Number(v)),
    z.number().min(0).max(100).nullable(),
  ),
  isPep: checkbox,
  notes: nullableText(1000),
});

export type BeneficialOwnerInput = z.infer<typeof beneficialOwnerInputSchema>;

export const amlScreeningInputSchema = z.object({
  screeningType: amlScreeningTypeEnum,
  result: amlScreeningResultEnum,
  provider: z.preprocess(
    (v) => (v === "" || v == null ? "manual" : v),
    z.string().trim().min(1).max(100),
  ),
  reference: nullableText(200),
  notes: nullableText(1000),
});

export type AmlScreeningInput = z.infer<typeof amlScreeningInputSchema>;
