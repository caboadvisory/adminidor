export type DocumentOwnerType = "client" | "project";
export type DocumentKind = "general" | "report";

export type StoredDocument = {
  id: string;
  ownerType: DocumentOwnerType;
  ownerId: string;
  fileName: string;
  r2Key: string;
  contentType: string | null;
  sizeBytes: number | null;
  kind: DocumentKind;
  uploadedBy: string | null;
  createdAt: string;
};
