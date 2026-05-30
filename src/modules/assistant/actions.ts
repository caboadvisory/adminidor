"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createTimeEntry } from "@/modules/time/actions";
import { addMessage } from "./queries";

export type CommitResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

const commitSchema = z.object({
  conversationId: z.string().uuid(),
  projectId: z.string().uuid(),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hours: z.number().positive(),
  description: z.string().nullable(),
  billable: z.boolean(),
  amount: z.number().nullable(),
});

// Writes a time entry the user confirmed in the chat. The actual DB write goes
// through the existing RLS-scoped createTimeEntry action (which binds user_id
// to the authenticated caller).
export async function commitProposedTimeEntry(
  input: unknown,
): Promise<CommitResult> {
  const parsed = commitSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const data = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "forbidden" };

  const res = await createTimeEntry({
    projectId: data.projectId,
    workDate: data.workDate,
    hours: data.hours,
    description: data.description ?? "",
    amount: data.amount ?? "",
    billable: data.billable,
  });
  if (!res.ok) {
    return { ok: false, error: res.error };
  }

  // Record a short confirmation line in the transcript — only if the caller
  // actually owns this conversation (RLS would also reject otherwise).
  const { data: conv } = await supabase
    .from("assistant_conversations")
    .select("id")
    .eq("id", data.conversationId)
    .eq("user_id", user.id)
    .maybeSingle();
  const note = `Logged ${data.hours} h on ${data.workDate}.`;
  if (conv) await addMessage(data.conversationId, "assistant", note);

  const locale = await getLocale();
  revalidatePath(`/${locale}/time`);
  return { ok: true, message: note };
}

export async function deleteConversation(input: unknown): Promise<void> {
  const id = z.string().uuid().safeParse(input);
  if (!id.success) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // RLS scopes the delete to the owner; the explicit user_id match is belt-and-braces.
  await supabase
    .from("assistant_conversations")
    .delete()
    .eq("id", id.data)
    .eq("user_id", user.id);
  const locale = await getLocale();
  revalidatePath(`/${locale}/assistant`);
}
