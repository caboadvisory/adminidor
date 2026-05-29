import { createClient } from "@/lib/supabase/server";
import type {
  AmlAttentionItem,
  ComplianceClient,
  DashboardData,
  RecentEntry,
  TopProject,
  WeeklyHours,
} from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

const UNVERIFIED = ["not_started", "in_progress", "rejected", "expired"];

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDate(workDate: string): Date {
  return new Date(`${workDate}T00:00:00`);
}

function weekStartMonday(d: Date): Date {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // 0 = Monday
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

export async function getDashboardData(opts: {
  userId: string;
  isAdmin: boolean;
}): Promise<DashboardData> {
  const { userId, isAdmin } = opts;
  const supabase = await createClient();

  const today = new Date();
  const todayStr = isoDate(today);
  const monthStartStr = isoDate(new Date(today.getFullYear(), today.getMonth(), 1));
  const in30Str = isoDate(new Date(today.getTime() + 30 * 86400000));

  // 8-week window (Monday-aligned), oldest first.
  const curWeek = weekStartMonday(today);
  const buckets: WeeklyHours[] = [];
  for (let i = 7; i >= 0; i--) {
    const ws = new Date(curWeek);
    ws.setDate(ws.getDate() - i * 7);
    buckets.push({ weekStart: isoDate(ws), hours: 0 });
  }
  const windowStart = buckets[0].weekStart;

  // --- counts ---
  const clientsCountQ = supabase
    .from("clients")
    .select("*", { count: "exact", head: true });
  const activeProjectsQ = supabase
    .from("projects")
    .select("*", { count: "exact", head: true })
    .eq("status", "active");

  // --- time entries over the window (one fetch powers KPIs + trend + top) ---
  let entriesQ = supabase
    .from("time_entries")
    .select("work_date, minutes, amount, billable, project_id, projects!inner(name, currency)")
    .gte("work_date", windowStart);
  if (!isAdmin) entriesQ = entriesQ.eq("user_id", userId);

  // --- the viewer's own latest entries ---
  const recentQ = supabase
    .from("time_entries")
    .select("id, work_date, minutes, amount, billable, project_id, projects(name, currency)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(6);

  const [clientsCount, activeProjects, entriesRes, recentRes] = await Promise.all([
    clientsCountQ,
    activeProjectsQ,
    entriesQ,
    recentQ,
  ]);

  const entries = (entriesRes.data ?? []) as any[];

  // weekly hours
  const weekMap = new Map(buckets.map((b) => [b.weekStart, b]));
  let hoursThisMonthMinutes = 0;
  const billableThisMonth: Record<string, number> = {};
  const topMap = new Map<string, TopProject>();

  for (const e of entries) {
    const ws = isoDate(weekStartMonday(parseDate(e.work_date)));
    const bucket = weekMap.get(ws);
    if (bucket) bucket.hours += e.minutes / 60;

    if (e.work_date >= monthStartStr) {
      hoursThisMonthMinutes += e.minutes;
      if (e.billable && e.amount != null) {
        const cur = e.projects?.currency ?? "";
        const amt = Number(e.amount);
        billableThisMonth[cur] = (billableThisMonth[cur] ?? 0) + amt;
        const tp = topMap.get(e.project_id) ?? {
          projectId: e.project_id,
          projectName: e.projects?.name ?? null,
          currency: e.projects?.currency ?? null,
          amount: 0,
        };
        tp.amount += amt;
        topMap.set(e.project_id, tp);
      }
    }
  }

  const weeklyHours = buckets.map((b) => ({
    weekStart: b.weekStart,
    hours: Math.round(b.hours * 100) / 100,
  }));
  const topProjects = Array.from(topMap.values())
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)
    .map((t) => ({ ...t, amount: Math.round(t.amount * 100) / 100 }));

  const recentEntries: RecentEntry[] = (recentRes.data ?? []).map((r: any) => ({
    id: r.id,
    workDate: r.work_date,
    projectId: r.project_id,
    projectName: r.projects?.name ?? null,
    minutes: r.minutes,
    amount: r.amount == null ? null : Number(r.amount),
    currency: r.projects?.currency ?? null,
    billable: r.billable,
  }));

  // --- compliance (admin only) ---
  let compliance: DashboardData["compliance"] = null;
  if (isAdmin) {
    const [overdueRes, dueSoonRes, unverifiedRes, amlRes] = await Promise.all([
      supabase
        .from("clients")
        .select("id, name, kyc_status, kyc_review_due")
        .not("kyc_review_due", "is", null)
        .lt("kyc_review_due", todayStr)
        .order("kyc_review_due", { ascending: true })
        .limit(50),
      supabase
        .from("clients")
        .select("id, name, kyc_status, kyc_review_due")
        .gte("kyc_review_due", todayStr)
        .lte("kyc_review_due", in30Str)
        .order("kyc_review_due", { ascending: true })
        .limit(50),
      supabase
        .from("clients")
        .select("*", { count: "exact", head: true })
        .in("kyc_status", UNVERIFIED),
      supabase
        .from("aml_screenings")
        .select("id, client_id, screening_type, result, screened_at, clients(name)")
        .in("result", ["hit", "pending"])
        .order("screened_at", { ascending: false })
        .limit(10),
    ]);

    const mapClient = (r: any): ComplianceClient => ({
      id: r.id,
      name: r.name,
      kycStatus: r.kyc_status,
      kycReviewDue: r.kyc_review_due,
    });
    const aml: AmlAttentionItem[] = (amlRes.data ?? []).map((r: any) => ({
      id: r.id,
      clientId: r.client_id,
      clientName: r.clients?.name ?? null,
      screeningType: r.screening_type,
      result: r.result,
      screenedAt: r.screened_at,
    }));

    compliance = {
      overdue: (overdueRes.data ?? []).map(mapClient),
      dueSoon: (dueSoonRes.data ?? []).map(mapClient),
      unverifiedCount: unverifiedRes.count ?? 0,
      aml,
    };
  }

  return {
    isAdmin,
    counts: {
      clients: clientsCount.count ?? 0,
      activeProjects: activeProjects.count ?? 0,
    },
    hoursThisMonthMinutes,
    billableThisMonth,
    weeklyHours,
    topProjects,
    compliance,
    recentEntries,
  };
}
