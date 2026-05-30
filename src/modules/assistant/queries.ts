import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AssistantMessage, AssistantRole, ConversationListItem } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

// All queries run under the request's authenticated Supabase client, so
// owner-only RLS scopes them to the current user's own conversations.

export async function listConversations(): Promise<ConversationListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assistant_conversations")
    .select("id, title, updated_at")
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    title: r.title,
    updatedAt: r.updated_at,
  }));
}

export async function getMessages(
  conversationId: string,
): Promise<AssistantMessage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assistant_messages")
    .select("id, role, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    role: r.role,
    content: r.content,
    createdAt: r.created_at,
  }));
}

export async function createConversation(
  title: string | null,
): Promise<{ id: string; title: string | null } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("assistant_conversations")
    .insert({ user_id: user.id, title })
    .select("id, title")
    .single();
  if (error) return null;
  return { id: data.id, title: data.title };
}

export async function addMessage(
  conversationId: string,
  role: AssistantRole,
  content: string,
): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("assistant_messages")
    .insert({ conversation_id: conversationId, role, content });
  // Bump the conversation's updated_at so it sorts to the top.
  await supabase
    .from("assistant_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);
}
