export type ClientType = "individual" | "entity";
export type KycStatus =
  | "not_started"
  | "in_progress"
  | "verified"
  | "rejected"
  | "expired";
export type RiskLevel = "low" | "medium" | "high";
export type AmlScreeningType = "pep" | "sanctions" | "adverse_media";
export type AmlScreeningResult = "clear" | "hit" | "pending";
export type DocumentOwnerType = "client" | "project";

export type Client = {
  id: string;
  clientType: ClientType;
  name: string;
  // entity-specific
  registrationNumber: string | null;
  jurisdiction: string | null;
  legalForm: string | null;
  // individual-specific
  dateOfBirth: string | null;
  nationality: string | null;
  nationalId: string | null;
  // contact
  contactEmail: string | null;
  contactPhone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  notes: string | null;
  // KYC
  kycStatus: KycStatus;
  riskLevel: RiskLevel | null;
  kycVerifiedAt: string | null;
  kycVerifiedBy: string | null;
  kycReviewDue: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ClientListItem = {
  id: string;
  clientType: ClientType;
  name: string;
  kycStatus: KycStatus;
  riskLevel: RiskLevel | null;
  kycReviewDue: string | null;
  createdAt: string;
};

export type BeneficialOwner = {
  id: string;
  clientId: string;
  fullName: string;
  dateOfBirth: string | null;
  nationality: string | null;
  ownershipPercentage: number | null;
  isPep: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AmlScreening = {
  id: string;
  clientId: string;
  screeningType: AmlScreeningType;
  result: AmlScreeningResult;
  provider: string;
  reference: string | null;
  screenedAt: string;
  screenedBy: string | null;
  notes: string | null;
  createdAt: string;
};

export type ClientDocument = {
  id: string;
  ownerType: DocumentOwnerType;
  ownerId: string;
  fileName: string;
  r2Key: string;
  contentType: string | null;
  sizeBytes: number | null;
  uploadedBy: string | null;
  createdAt: string;
};

export type ClientDetail = Client & {
  beneficialOwners: BeneficialOwner[];
  amlScreenings: AmlScreening[];
  documents: ClientDocument[];
};
