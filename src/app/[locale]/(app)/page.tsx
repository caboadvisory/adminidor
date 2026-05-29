import { getTranslations, setRequestLocale } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Link } from "@/i18n/navigation";
import { getCurrentUser, isCurrentUserAdmin } from "@/lib/supabase/auth";
import { kycStatusTone, amlResultTone } from "@/modules/clients/display";
import {
  TopProjectsChart,
  WeeklyHoursChart,
} from "@/modules/dashboard/components/charts";
import { getDashboardData } from "@/modules/dashboard/queries";
import { minutesToHours } from "@/modules/time/display";

const sectionTitle =
  "text-sm font-semibold uppercase tracking-wide text-foreground/50";

type Props = { params: Promise<{ locale: string }> };

export default async function DashboardPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("dashboard");
  const tClients = await getTranslations("clients");

  const [user, isAdmin] = await Promise.all([
    getCurrentUser(),
    isCurrentUserAdmin(),
  ]);
  const data = await getDashboardData({ userId: user?.id ?? "", isAdmin });

  const numFmt = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const hUnit = t("units.hours");

  const billableText =
    Object.keys(data.billableThisMonth).length === 0
      ? "—"
      : Object.entries(data.billableThisMonth)
          .map(([cur, amt]) => `${numFmt.format(amt)}${cur ? ` ${cur}` : ""}`)
          .join(" · ");

  const monthHours = minutesToHours(data.hoursThisMonthMinutes);
  const weekHours = data.weeklyHours.at(-1)?.hours ?? 0;
  const c = data.compliance;
  const complianceEmpty =
    c &&
    c.overdue.length === 0 &&
    c.dueSoon.length === 0 &&
    c.unverifiedCount === 0 &&
    c.aml.length === 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted">{t("subtitle")}</p>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isAdmin ? (
          <>
            <StatCard label={t("kpis.clients")} value={data.counts.clients} />
            <StatCard
              label={t("kpis.activeProjects")}
              value={data.counts.activeProjects}
            />
            <StatCard
              label={t("kpis.hoursThisMonth")}
              value={`${numFmt.format(monthHours)} ${hUnit}`}
            />
            <StatCard label={t("kpis.billableThisMonth")} value={billableText} />
          </>
        ) : (
          <>
            <StatCard
              label={t("kpis.myHoursThisWeek")}
              value={`${numFmt.format(weekHours)} ${hUnit}`}
            />
            <StatCard
              label={t("kpis.myHoursThisMonth")}
              value={`${numFmt.format(monthHours)} ${hUnit}`}
            />
            <StatCard
              label={t("kpis.myBillableThisMonth")}
              value={billableText}
            />
          </>
        )}
      </div>

      {/* Compliance (admin) */}
      {c ? (
        <Card className="space-y-4">
          <h2 className={sectionTitle}>{t("compliance.title")}</h2>
          {complianceEmpty ? (
            <p className="text-sm text-muted">{t("compliance.allClear")}</p>
          ) : (
            <div className="space-y-5">
              {c.overdue.length > 0 ? (
                <ComplianceGroup
                  title={t("compliance.overdue")}
                  tone="red"
                  count={c.overdue.length}
                >
                  {c.overdue.map((cl) => (
                    <ComplianceClientRow
                      key={cl.id}
                      href={`/clients/${cl.id}`}
                      name={cl.name}
                      meta={t("compliance.reviewDue", {
                        date: cl.kycReviewDue
                          ? dateFmt.format(new Date(cl.kycReviewDue))
                          : "—",
                      })}
                      badge={tClients(`kycStatus.${cl.kycStatus}`)}
                      badgeTone={kycStatusTone(cl.kycStatus as never)}
                    />
                  ))}
                </ComplianceGroup>
              ) : null}

              {c.dueSoon.length > 0 ? (
                <ComplianceGroup
                  title={t("compliance.dueSoon")}
                  tone="amber"
                  count={c.dueSoon.length}
                >
                  {c.dueSoon.map((cl) => (
                    <ComplianceClientRow
                      key={cl.id}
                      href={`/clients/${cl.id}`}
                      name={cl.name}
                      meta={t("compliance.reviewDue", {
                        date: cl.kycReviewDue
                          ? dateFmt.format(new Date(cl.kycReviewDue))
                          : "—",
                      })}
                      badge={tClients(`kycStatus.${cl.kycStatus}`)}
                      badgeTone={kycStatusTone(cl.kycStatus as never)}
                    />
                  ))}
                </ComplianceGroup>
              ) : null}

              {c.aml.length > 0 ? (
                <ComplianceGroup
                  title={t("compliance.aml")}
                  tone="red"
                  count={c.aml.length}
                >
                  {c.aml.map((a) => (
                    <ComplianceClientRow
                      key={a.id}
                      href={`/clients/${a.clientId}`}
                      name={a.clientName ?? "—"}
                      meta={tClients(`amlType.${a.screeningType}`)}
                      badge={tClients(`amlResult.${a.result}`)}
                      badgeTone={amlResultTone(a.result as never)}
                    />
                  ))}
                </ComplianceGroup>
              ) : null}

              {c.unverifiedCount > 0 ? (
                <Link
                  href="/clients"
                  className="inline-block text-sm text-primary hover:underline"
                >
                  {t("compliance.unverified", { count: c.unverifiedCount })} →
                </Link>
              ) : null}
            </div>
          )}
        </Card>
      ) : null}

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-4">
          <h2 className={sectionTitle}>{t("financials.weeklyHours")}</h2>
          <WeeklyHoursChart data={data.weeklyHours} />
        </Card>
        <Card className="space-y-4">
          <h2 className={sectionTitle}>{t("financials.byProject")}</h2>
          {data.topProjects.length === 0 ? (
            <p className="text-sm text-muted">{t("financials.noData")}</p>
          ) : (
            <TopProjectsChart data={data.topProjects} locale={locale} />
          )}
        </Card>
      </div>

      {/* My recent time */}
      <Card className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className={sectionTitle}>{t("myTime.title")}</h2>
          <Link
            href="/time"
            className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            {t("myTime.logTime")}
          </Link>
        </div>
        {data.recentEntries.length === 0 ? (
          <p className="text-sm text-muted">{t("myTime.empty")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {data.recentEntries.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between gap-4 py-2.5 text-sm"
              >
                <div className="min-w-0">
                  <Link
                    href={`/projects/${e.projectId}`}
                    className="font-medium hover:underline"
                  >
                    {e.projectName ?? "—"}
                  </Link>
                  <div className="text-muted">
                    {dateFmt.format(new Date(`${e.workDate}T00:00:00`))} ·{" "}
                    {numFmt.format(minutesToHours(e.minutes))} {hUnit}
                  </div>
                </div>
                <div className="shrink-0 whitespace-nowrap text-foreground/70">
                  {e.billable && e.amount != null
                    ? `${numFmt.format(e.amount)}${e.currency ? ` ${e.currency}` : ""}`
                    : "—"}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function ComplianceGroup({
  title,
  tone,
  count,
  children,
}: {
  title: string;
  tone: "red" | "amber";
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{title}</span>
        <Badge tone={tone}>{count}</Badge>
      </div>
      <ul className="divide-y divide-border">{children}</ul>
    </div>
  );
}

function ComplianceClientRow({
  href,
  name,
  meta,
  badge,
  badgeTone,
}: {
  href: string;
  name: string;
  meta: string;
  badge: string;
  badgeTone: "neutral" | "green" | "amber" | "red" | "blue";
}) {
  return (
    <li className="flex items-center justify-between gap-4 py-2 text-sm">
      <div className="min-w-0">
        <Link href={href} className="font-medium hover:underline">
          {name}
        </Link>
        <div className="text-muted">{meta}</div>
      </div>
      <Badge tone={badgeTone}>{badge}</Badge>
    </li>
  );
}
