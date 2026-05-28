export type TimesheetRow = {
  date: string;
  minutes: number;
  description: string | null;
  amount: number | null;
  billable: boolean;
};

export type TimesheetGroup = {
  projectId: string;
  projectName: string | null;
  currency: string | null;
  rows: TimesheetRow[];
  subtotalMinutes: number;
  subtotalAmount: number;
};

export type TimesheetResult = {
  groups: TimesheetGroup[];
  totalMinutes: number;
  // Amounts are summed per currency (projects may differ).
  totalsByCurrency: Record<string, number>;
};

export type TimesheetParams = {
  clientId: string;
  from: string;
  to: string;
};
