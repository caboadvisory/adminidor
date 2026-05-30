"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { commitProposedTimeEntry } from "@/modules/assistant/actions";
import type {
  AssistantMessage,
  ChatStreamEvent,
  TimeEntryProposal,
} from "@/modules/assistant/types";

type ChatMessage = { role: "user" | "assistant"; content: string };

export function AssistantChat({
  conversationId: initialConversationId,
  initialMessages,
}: {
  conversationId: string | null;
  initialMessages: AssistantMessage[];
}) {
  const t = useTranslations("assistant");
  const locale = useLocale();
  const router = useRouter();

  const [conversationId, setConversationId] = useState(initialConversationId);
  const [messages, setMessages] = useState<ChatMessage[]>(
    initialMessages.map((m) => ({ role: m.role, content: m.content })),
  );
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<TimeEntryProposal | null>(null);

  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, proposal]);

  async function send(text: string) {
    setError(null);
    setProposal(null);
    setMessages((m) => [
      ...m,
      { role: "user", content: text },
      { role: "assistant", content: "" },
    ]);
    setLoading(true);

    try {
      const res = await fetch(`/${locale}/assistant/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message: text }),
      });
      if (!res.ok || !res.body) {
        setError(t("error"));
        setLoading(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let newConvId: string | null = null;

      const handle = (ev: ChatStreamEvent) => {
        switch (ev.type) {
          case "conversation":
            newConvId = ev.id;
            setConversationId(ev.id);
            break;
          case "text":
            setMessages((m) => {
              const next = [...m];
              next[next.length - 1] = {
                role: "assistant",
                content: next[next.length - 1].content + ev.delta,
              };
              return next;
            });
            break;
          case "proposal":
            setProposal(ev.proposal);
            break;
          case "error":
            setError(t("error"));
            break;
        }
      };

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            handle(JSON.parse(line) as ChatStreamEvent);
          } catch {
            // ignore malformed line
          }
        }
      }

      // If this created a new conversation, reflect it in the URL + sidebar.
      if (!initialConversationId && newConvId) {
        router.replace(`/assistant?c=${newConvId}`);
        router.refresh();
      } else {
        router.refresh();
      }
    } catch {
      setError(t("error"));
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    void send(text);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit(e as unknown as FormEvent);
    }
  }

  async function commit() {
    if (!proposal || !conversationId) return;
    setLoading(true);
    const res = await commitProposedTimeEntry({
      conversationId,
      projectId: proposal.projectId,
      workDate: proposal.workDate,
      hours: proposal.hours,
      description: proposal.description,
      billable: proposal.billable,
      amount: proposal.amount,
    });
    setLoading(false);
    if (!res.ok) {
      setError(t("error"));
      return;
    }
    setProposal(null);
    setMessages((m) => [...m, { role: "assistant", content: res.message }]);
    router.refresh();
  }

  const empty = messages.length === 0;

  return (
    <div className="flex h-[calc(100dvh-9rem)] flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto pr-1">
        {empty ? (
          <div className="flex h-full items-center justify-center text-center text-sm text-muted">
            {t("emptyThread")}
          </div>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className={
                m.role === "user" ? "flex justify-end" : "flex justify-start"
              }
            >
              <div
                className={
                  m.role === "user"
                    ? "max-w-[80%] rounded-2xl bg-primary px-4 py-2 text-sm text-primary-foreground"
                    : "max-w-[85%] rounded-2xl bg-surface border border-border px-4 py-2 text-sm whitespace-pre-wrap"
                }
              >
                {m.content || (loading && i === messages.length - 1 ? "…" : "")}
              </div>
            </div>
          ))
        )}

        {proposal ? (
          <ProposalCard
            proposal={proposal}
            loading={loading}
            onConfirm={commit}
            onDismiss={() => setProposal(null)}
          />
        ) : null}

        {error ? (
          <p className="text-sm text-red-700">{error}</p>
        ) : null}
        <div ref={endRef} />
      </div>

      <form onSubmit={onSubmit} className="mt-4 flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          rows={2}
          placeholder={t("placeholder")}
          className="min-h-11 flex-1 resize-none rounded-md border border-border-strong bg-surface px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/25"
        />
        <Button type="submit" disabled={loading || !input.trim()}>
          {t("send")}
        </Button>
      </form>
    </div>
  );
}

function ProposalCard({
  proposal,
  loading,
  onConfirm,
  onDismiss,
}: {
  proposal: TimeEntryProposal;
  loading: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  const t = useTranslations("assistant");
  const locale = useLocale();
  const numFmt = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const row = (label: string, value: string) => (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-muted">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );

  return (
    <div className="max-w-[85%] space-y-3 rounded-2xl border border-primary/40 bg-surface p-4 shadow-sm">
      <div className="text-sm font-semibold uppercase tracking-wide text-foreground/60">
        {t("proposal.title")}
      </div>
      <div className="space-y-1.5">
        {row(t("proposal.project"), proposal.projectName ?? "—")}
        {proposal.clientName ? row(t("proposal.client"), proposal.clientName) : null}
        {row(t("proposal.date"), proposal.workDate)}
        {row(t("proposal.hours"), `${numFmt.format(proposal.hours)} h`)}
        {row(
          t("proposal.amount"),
          proposal.amount != null
            ? `${numFmt.format(proposal.amount)} ${proposal.currency}`
            : "—",
        )}
        {row(
          t("proposal.billable"),
          proposal.billable ? t("proposal.yes") : t("proposal.no"),
        )}
      </div>
      <div className="flex items-center gap-2 pt-1">
        <Button type="button" onClick={onConfirm} disabled={loading}>
          {loading ? t("proposal.logging") : t("proposal.logIt")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onDismiss}
          disabled={loading}
        >
          {t("proposal.dismiss")}
        </Button>
      </div>
    </div>
  );
}
