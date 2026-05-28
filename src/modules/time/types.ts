export type TimeEntry = {
  id: string;
  projectId: string;
  userId: string;
  workDate: string;
  minutes: number;
  description: string | null;
  billable: boolean;
  createdAt: string;
};
