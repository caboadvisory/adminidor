import { createClient } from "@/lib/supabase/server";
import type { Client } from "./types";

// Reference query for the Clients module. Full CRUD lands in a later milestone.
export async function listClients(): Promise<Client[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select(
      "id, name, registration_number, contact_email, contact_phone, created_at",
    )
    .order("name");

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    registrationNumber: row.registration_number,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    createdAt: row.created_at,
  }));
}
