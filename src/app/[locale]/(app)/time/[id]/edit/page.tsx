import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { listProjectsForPicker } from "@/modules/projects/queries";
import { TimeEntryForm } from "@/modules/time/components/time-entry-form";
import { getTimeEntry } from "@/modules/time/queries";

type Props = {
  params: Promise<{ locale: string; id: string }>;
};

export default async function EditTimeEntryPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("time");

  const [entry, projects] = await Promise.all([
    getTimeEntry(id),
    listProjectsForPicker(),
  ]);
  if (!entry) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/time" className="text-sm text-foreground/60 hover:underline">
          ← {t("backToList")}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{t("editTitle")}</h1>
      </div>
      <TimeEntryForm
        mode="edit"
        entryId={id}
        initial={entry}
        projects={projects}
      />
    </div>
  );
}
