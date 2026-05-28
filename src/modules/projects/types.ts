import type { StoredDocument } from "@/modules/documents/types";

export type ProjectStatus = "active" | "on_hold" | "completed" | "archived";
export type ProjectBillingType = "hourly" | "fixed";

export type Project = {
  id: string;
  clientId: string;
  name: string;
  code: string | null;
  status: ProjectStatus;
  hourlyRate: number | null;
  currency: string;
  billingType: ProjectBillingType;
  fixedPrice: number | null;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProjectPickerOption = {
  id: string;
  name: string;
  currency: string;
  effectiveRate: number | null;
  billingType: ProjectBillingType;
};

export type ProjectListItem = {
  id: string;
  name: string;
  code: string | null;
  status: ProjectStatus;
  currency: string;
  hourlyRate: number | null;
  clientId: string;
  clientName: string | null;
  startDate: string | null;
};

export type ProjectDetail = Project & {
  clientName: string | null;
  documents: StoredDocument[];
};
