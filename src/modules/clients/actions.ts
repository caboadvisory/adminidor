"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import {
  amlScreeningInputSchema,
  beneficialOwnerInputSchema,
  clientInputSchema,
  type ClientInput,
} from "./schema";

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string };

export type CreateResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

async function getUserAndRole() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, isAdmin: false };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  return { supabase, user, isAdmin: profile?.role === "admin" };
}

async function revalidateClient(id?: string) {
  const locale = await getLocale();
  revalidatePath(`/${locale}/clients`);
  if (id) revalidatePath(`/${locale}/clients/${id}`);
}

function clientRow(input: ClientInput) {
  return {
    client_type: input.clientType,
    name: input.name,
    registration_number: input.registrationNumber,
    jurisdiction: input.jurisdiction,
    legal_form: input.legalForm,
    date_of_birth: input.dateOfBirth,
    nationality: input.nationality,
    national_id: input.nationalId,
    contact_email: input.contactEmail,
    contact_phone: input.contactPhone,
    address_line1: input.addressLine1,
    address_line2: input.addressLine2,
    postal_code: input.postalCode,
    city: input.city,
    country: input.country,
    notes: input.notes,
    default_hourly_rate: input.defaultHourlyRate,
    default_currency: input.defaultCurrency,
    kyc_status: input.kycStatus,
    risk_level: input.riskLevel,
    kyc_review_due: input.kycReviewDue,
  };
}

// --- Clients ---------------------------------------------------------------

export async function createClient(input: unknown): Promise<CreateResult> {
  const parsed = clientInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };

  const { supabase, user, isAdmin } = await getUserAndRole();
  if (!user || !isAdmin) return { ok: false, error: "forbidden" };

  const verified = parsed.data.kycStatus === "verified";
  const { data, error } = await supabase
    .from("clients")
    .insert({
      ...clientRow(parsed.data),
      created_by: user.id,
      kyc_verified_at: verified ? new Date().toISOString() : null,
      kyc_verified_by: verified ? user.id : null,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: "generic" };

  await revalidateClient(data.id);
  return { ok: true, id: data.id };
}

export async function updateClient(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  const parsed = clientInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };

  const { supabase, user, isAdmin } = await getUserAndRole();
  if (!user || !isAdmin) return { ok: false, error: "forbidden" };

  const { data: existing } = await supabase
    .from("clients")
    .select("kyc_status, kyc_verified_at, kyc_verified_by")
    .eq("id", id)
    .maybeSingle();

  const nowVerified = parsed.data.kycStatus === "verified";
  const wasVerified = existing?.kyc_status === "verified";

  let kycVerifiedAt = existing?.kyc_verified_at ?? null;
  let kycVerifiedBy = existing?.kyc_verified_by ?? null;
  if (nowVerified && !wasVerified) {
    kycVerifiedAt = new Date().toISOString();
    kycVerifiedBy = user.id;
  } else if (!nowVerified) {
    kycVerifiedAt = null;
    kycVerifiedBy = null;
  }

  const { data: updated, error } = await supabase
    .from("clients")
    .update({
      ...clientRow(parsed.data),
      kyc_verified_at: kycVerifiedAt,
      kyc_verified_by: kycVerifiedBy,
    })
    .eq("id", id)
    .select("id");

  if (error) return { ok: false, error: "generic" };
  if (!updated || updated.length === 0) return { ok: false, error: "forbidden" };

  await revalidateClient(id);
  return { ok: true };
}

export async function deleteClient(id: string): Promise<ActionResult> {
  const { supabase, user, isAdmin } = await getUserAndRole();
  if (!user || !isAdmin) return { ok: false, error: "forbidden" };

  const { data: deleted, error } = await supabase
    .from("clients")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) return { ok: false, error: "generic" };
  if (!deleted || deleted.length === 0) return { ok: false, error: "forbidden" };

  await revalidateClient(id);
  return { ok: true };
}

// --- Beneficial owners -----------------------------------------------------

export async function addBeneficialOwner(
  clientId: string,
  input: unknown,
): Promise<ActionResult> {
  const parsed = beneficialOwnerInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };

  const { supabase, user, isAdmin } = await getUserAndRole();
  if (!user || !isAdmin) return { ok: false, error: "forbidden" };

  const { error } = await supabase.from("beneficial_owners").insert({
    client_id: clientId,
    full_name: parsed.data.fullName,
    date_of_birth: parsed.data.dateOfBirth,
    nationality: parsed.data.nationality,
    ownership_percentage: parsed.data.ownershipPercentage,
    is_pep: parsed.data.isPep,
    notes: parsed.data.notes,
  });

  if (error) return { ok: false, error: "generic" };

  await revalidateClient(clientId);
  return { ok: true };
}

export async function deleteBeneficialOwner(
  id: string,
  clientId: string,
): Promise<ActionResult> {
  const { supabase, user, isAdmin } = await getUserAndRole();
  if (!user || !isAdmin) return { ok: false, error: "forbidden" };

  const { data: deleted, error } = await supabase
    .from("beneficial_owners")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) return { ok: false, error: "generic" };
  if (!deleted || deleted.length === 0) return { ok: false, error: "forbidden" };

  await revalidateClient(clientId);
  return { ok: true };
}

// --- AML screenings --------------------------------------------------------

export async function addAmlScreening(
  clientId: string,
  input: unknown,
): Promise<ActionResult> {
  const parsed = amlScreeningInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };

  const { supabase, user, isAdmin } = await getUserAndRole();
  if (!user || !isAdmin) return { ok: false, error: "forbidden" };

  const { error } = await supabase.from("aml_screenings").insert({
    client_id: clientId,
    screening_type: parsed.data.screeningType,
    result: parsed.data.result,
    provider: parsed.data.provider,
    reference: parsed.data.reference,
    notes: parsed.data.notes,
    screened_by: user.id,
  });

  if (error) return { ok: false, error: "generic" };

  await revalidateClient(clientId);
  return { ok: true };
}

export async function deleteAmlScreening(
  id: string,
  clientId: string,
): Promise<ActionResult> {
  const { supabase, user, isAdmin } = await getUserAndRole();
  if (!user || !isAdmin) return { ok: false, error: "forbidden" };

  const { data: deleted, error } = await supabase
    .from("aml_screenings")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) return { ok: false, error: "generic" };
  if (!deleted || deleted.length === 0) return { ok: false, error: "forbidden" };

  await revalidateClient(clientId);
  return { ok: true };
}
