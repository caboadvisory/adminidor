import { createClient } from "@/lib/supabase/server";
import { listDocuments } from "@/modules/documents/queries";
import type {
  Project,
  ProjectDetail,
  ProjectListItem,
  ProjectPickerOption,
} from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

function mapProject(row: any): Project {
  return {
    id: row.id,
    clientId: row.client_id,
    name: row.name,
    code: row.code,
    status: row.status,
    hourlyRate: row.hourly_rate == null ? null : Number(row.hourly_rate),
    currency: row.currency,
    billingType: row.billing_type,
    fixedPrice: row.fixed_price == null ? null : Number(row.fixed_price),
    startDate: row.start_date,
    endDate: row.end_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listProjectsForPicker(): Promise<ProjectPickerOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select(
      "id, name, currency, hourly_rate, billing_type, clients(default_hourly_rate)",
    )
    .order("name");

  if (error) throw error;

  return (data ?? []).map((row: any) => {
    const projectRate = row.hourly_rate == null ? null : Number(row.hourly_rate);
    const clientRate =
      row.clients?.default_hourly_rate == null
        ? null
        : Number(row.clients.default_hourly_rate);
    return {
      id: row.id,
      name: row.name,
      currency: row.currency,
      effectiveRate: projectRate ?? clientRate,
      billingType: row.billing_type,
    };
  });
}

export async function listProjects(): Promise<ProjectListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select(
      "id, name, code, status, currency, hourly_rate, start_date, client_id, clients(name)",
    )
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    name: row.name,
    code: row.code,
    status: row.status,
    currency: row.currency,
    hourlyRate: row.hourly_rate == null ? null : Number(row.hourly_rate),
    clientId: row.client_id,
    clientName: row.clients?.name ?? null,
    startDate: row.start_date,
  }));
}

export async function getProject(id: string): Promise<ProjectDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*, clients(name)")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const documents = await listDocuments("project", id);

  return {
    ...mapProject(data),
    clientName: (data as any).clients?.name ?? null,
    documents,
  };
}
