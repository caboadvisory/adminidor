export type WeeklyHours = { weekStart: string; hours: number };

export type TopProject = {
  projectId: string;
  projectName: string | null;
  currency: string | null;
  amount: number;
};

export type ComplianceClient = {
  id: string;
  name: string;
  kycStatus: string;
  kycReviewDue: string | null;
};

export type AmlAttentionItem = {
  id: string;
  clientId: string;
  clientName: string | null;
  screeningType: string;
  result: string;
  screenedAt: string;
};

export type RecentEntry = {
  id: string;
  workDate: string;
  projectId: string;
  projectName: string | null;
  minutes: number;
  amount: number | null;
  currency: string | null;
  billable: boolean;
};

export type DashboardData = {
  isAdmin: boolean;
  counts: { clients: number; activeProjects: number };
  hoursThisMonthMinutes: number;
  billableThisMonth: Record<string, number>; // currency -> summed billable amount
  weeklyHours: WeeklyHours[]; // last 8 weeks (oldest first)
  topProjects: TopProject[]; // top 5 by billable amount this month
  compliance: {
    overdue: ComplianceClient[];
    dueSoon: ComplianceClient[];
    unverifiedCount: number;
    aml: AmlAttentionItem[];
  } | null; // null for non-admins
  recentEntries: RecentEntry[]; // the viewer's own latest entries
};
