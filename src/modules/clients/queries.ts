import { createClient } from "@/lib/supabase/server";
import { listDocuments } from "@/modules/documents/queries";
import type {
  AmlScreening,
  BeneficialOwner,
  Client,
  ClientDetail,
  ClientListItem,
} from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

function mapClient(row: any): Client {
  return {
    id: row.id,
    clientType: row.client_type,
    name: row.name,
    registrationNumber: row.registration_number,
    jurisdiction: row.jurisdiction,
    legalForm: row.legal_form,
    dateOfBirth: row.date_of_birth,
    nationality: row.nationality,
    nationalId: row.national_id,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    postalCode: row.postal_code,
    city: row.city,
    country: row.country,
    notes: row.notes,
    defaultHourlyRate:
      row.default_hourly_rate == null ? null : Number(row.default_hourly_rate),
    defaultCurrency: row.default_currency,
    kycStatus: row.kyc_status,
    riskLevel: row.risk_level,
    kycVerifiedAt: row.kyc_verified_at,
    kycVerifiedBy: row.kyc_verified_by,
    kycReviewDue: row.kyc_review_due,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapBeneficialOwner(row: any): BeneficialOwner {
  return {
    id: row.id,
    clientId: row.client_id,
    fullName: row.full_name,
    dateOfBirth: row.date_of_birth,
    nationality: row.nationality,
    ownershipPercentage:
      row.ownership_percentage == null ? null : Number(row.ownership_percentage),
    isPep: row.is_pep,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAmlScreening(row: any): AmlScreening {
  return {
    id: row.id,
    clientId: row.client_id,
    screeningType: row.screening_type,
    result: row.result,
    provider: row.provider,
    reference: row.reference,
    screenedAt: row.screened_at,
    screenedBy: row.screened_by,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export async function listClients(): Promise<ClientListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select("id, client_type, name, kyc_status, risk_level, kyc_review_due, created_at")
    .order("name");

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    clientType: row.client_type,
    name: row.name,
    kycStatus: row.kyc_status,
    riskLevel: row.risk_level,
    kycReviewDue: row.kyc_review_due,
    createdAt: row.created_at,
  }));
}

export async function getClient(id: string): Promise<ClientDetail | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("clients")
    .select("*, beneficial_owners(*), aml_screenings(*)")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const documents = await listDocuments("client", id);

  const beneficialOwners = ((data as any).beneficial_owners ?? [])
    .map(mapBeneficialOwner)
    .sort((a: BeneficialOwner, b: BeneficialOwner) =>
      a.fullName.localeCompare(b.fullName),
    );

  const amlScreenings = ((data as any).aml_screenings ?? [])
    .map(mapAmlScreening)
    .sort(
      (a: AmlScreening, b: AmlScreening) =>
        new Date(b.screenedAt).getTime() - new Date(a.screenedAt).getTime(),
    );

  return {
    ...mapClient(data),
    beneficialOwners,
    amlScreenings,
    documents,
  };
}
