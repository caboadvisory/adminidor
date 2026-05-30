import { getTranslations, setRequestLocale } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { isAssistantConfigured } from "@/lib/anthropic/config";
import { AssistantChat } from "@/modules/assistant/components/assistant-chat";
import { getMessages, listConversations } from "@/modules/assistant/queries";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ c?: string }>;
};

export default async function AssistantPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { c } = await searchParams;
  const t = await getTranslations("assistant");

  if (!isAssistantConfigured()) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <Card className="text-sm text-muted">{t("notConfigured")}</Card>
      </div>
    );
  }

  const conversations = await listConversations();
  const activeId = c ?? null;
  const initialMessages = activeId ? await getMessages(activeId) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted">{t("subtitle")}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-[16rem_1fr]">
        <aside className="space-y-3">
          <Link
            href="/assistant"
            className="inline-flex h-9 w-full items-center justify-center rounded-md bg-foreground px-3 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            {t("newChat")}
          </Link>
          <nav className="space-y-1">
            {conversations.map((conv) => (
              <Link
                key={conv.id}
                href={`/assistant?c=${conv.id}`}
                className={cn(
                  "block truncate rounded-md px-3 py-2 text-sm transition-colors",
                  conv.id === activeId
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground/70 hover:bg-surface-2 hover:text-foreground",
                )}
              >
                {conv.title || t("untitled")}
              </Link>
            ))}
            {conversations.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted">{t("noConversations")}</p>
            ) : null}
          </nav>
        </aside>

        <Card>
          <AssistantChat
            key={activeId ?? "new"}
            conversationId={activeId}
            initialMessages={initialMessages}
          />
        </Card>
      </div>
    </div>
  );
}
