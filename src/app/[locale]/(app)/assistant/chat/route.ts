import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropic } from "@/lib/anthropic/client";
import { ASSISTANT_MODEL, isAssistantConfigured } from "@/lib/anthropic/config";
import { getCurrentUser, isCurrentUserAdmin } from "@/lib/supabase/auth";
import { rateLimit } from "@/lib/rate-limit";
import { ASSISTANT_TOOLS, executeTool } from "@/modules/assistant/tools";
import { buildAssistantSystemPrompt } from "@/modules/assistant/prompt";
import {
  addMessage,
  createConversation,
  getMessages,
} from "@/modules/assistant/queries";
import type { ChatStreamEvent } from "@/modules/assistant/types";

const MAX_ITERATIONS = 6;

function isoToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale } = await params;

  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!isAssistantConfigured())
    return Response.json({ error: "not_configured" }, { status: 503 });

  // Each request fans out to several Opus calls — rate-limit per user to cap
  // API-cost / DoS exposure. 20 messages per rolling minute is generous for
  // interactive use.
  const limit = rateLimit(`assistant:${user.id}`, 20, 60_000);
  if (!limit.ok) {
    return Response.json(
      { error: "rate_limited" },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      },
    );
  }

  const body = await request.json().catch(() => null);
  const message =
    body && typeof body.message === "string" ? body.message.trim() : "";
  if (!message) return Response.json({ error: "empty" }, { status: 400 });
  if (message.length > 8000)
    return Response.json({ error: "too_long" }, { status: 413 });
  const rawConversationId =
    body && typeof body.conversationId === "string" ? body.conversationId : null;
  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (rawConversationId && !UUID_RE.test(rawConversationId))
    return Response.json({ error: "invalid_conversation" }, { status: 400 });
  const conversationIdIn = rawConversationId;

  // Ensure a conversation and persist the user's message.
  let conversationId = conversationIdIn;
  let title: string | null = null;
  if (!conversationId) {
    const created = await createConversation(message.slice(0, 60));
    if (!created)
      return Response.json({ error: "create_failed" }, { status: 500 });
    conversationId = created.id;
    title = created.title;
  }
  await addMessage(conversationId, "user", message);

  const history = await getMessages(conversationId);
  const apiMessages: Anthropic.MessageParam[] = history.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const isAdmin = await isCurrentUserAdmin();
  const system: Anthropic.TextBlockParam[] = [
    {
      type: "text",
      text: buildAssistantSystemPrompt({
        role: isAdmin ? "admin" : "member",
        locale,
        today: isoToday(),
      }),
      cache_control: { type: "ephemeral" },
    },
  ];

  const anthropic = getAnthropic();
  const convId = conversationId;

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const emit = (e: ChatStreamEvent) =>
        controller.enqueue(enc.encode(JSON.stringify(e) + "\n"));

      emit({ type: "conversation", id: convId, title });

      let assistantText = "";
      const turns: Anthropic.MessageParam[] = [...apiMessages];
      try {
        for (let i = 0; i < MAX_ITERATIONS; i++) {
          const turn = anthropic.messages.stream({
            model: ASSISTANT_MODEL,
            max_tokens: 16000,
            thinking: { type: "adaptive" },
            system,
            tools: ASSISTANT_TOOLS,
            messages: turns,
          });
          turn.on("text", (delta) => {
            assistantText += delta;
            emit({ type: "text", delta });
          });
          const msg = await turn.finalMessage();

          if (msg.stop_reason !== "tool_use") break;

          const toolUses = msg.content.filter(
            (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
          );
          turns.push({
            role: "assistant",
            content: msg.content as Anthropic.ContentBlockParam[],
          });

          const results: Anthropic.ToolResultBlockParam[] = [];
          for (const tu of toolUses) {
            const outcome = await executeTool(tu.name, tu.input, {
              userId: user.id,
            });
            if (outcome.proposal)
              emit({ type: "proposal", proposal: outcome.proposal });
            results.push({
              type: "tool_result",
              tool_use_id: tu.id,
              content: outcome.result,
            });
          }
          turns.push({ role: "user", content: results });
        }

        await addMessage(
          convId,
          "assistant",
          assistantText.trim() || "(Prepared a time entry for your confirmation.)",
        );
        emit({ type: "done" });
      } catch {
        emit({ type: "error", message: "assistant_error" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
