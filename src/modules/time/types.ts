export type TimeEntry = {
  id: string;
  projectId: string;
  userId: string;
  workDate: string;
  minutes: number;
  description: string | null;
  billable: boolean;
  unitRate: number | null;
  amount: number | null;
  createdAt: string;
};

export type TimeEntryListItem = {
  id: string;
  projectId: string;
  projectName: string | null;
  currency: string | null;
  userId: string;
  userName: string | null;
  workDate: string;
  minutes: number;
  description: string | null;
  billable: boolean;
  amount: number | null;
};
