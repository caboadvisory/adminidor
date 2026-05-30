"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { createTimeEntry } from "@/modules/time/actions";
import { addMessage } from "./queries";

export type CommitResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

// Writes a time entry the user confirmed in the chat. The actual DB write goes
// through the existing RLS-scoped createTimeEntry action.
export async function commitProposedTimeEntry(input: {
  conversationId: string;
  projectId: string;
  workDate: string;
  hours: number;
  description: string | null;
  billable: boolean;
  amount: number | null;
}): Promise<CommitResult> {
  const res = await createTimeEntry({
    projectId: input.projectId,
    workDate: input.workDate,
    hours: input.hours,
    description: input.description ?? "",
    amount: input.amount ?? "",
    billable: input.billable,
  });
  if (!res.ok) {
    return { ok: false, error: res.error };
  }

  // Record a short confirmation line in the conversation transcript.
  const note = `Logged ${input.hours} h on ${input.workDate}.`;
  await addMessage(input.conversationId, "assistant", note);

  const locale = await getLocale();
  revalidatePath(`/${locale}/time`);
  return { ok: true, message: note };
}

export async function deleteConversation(id: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("assistant_conversations").delete().eq("id", id);
  const locale = await getLocale();
  revalidatePath(`/${locale}/assistant`);
}
