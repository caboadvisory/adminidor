export type ProjectStatus = "active" | "on_hold" | "completed" | "archived";

export type Project = {
  id: string;
  clientId: string;
  name: string;
  code: string | null;
  status: ProjectStatus;
  hourlyRate: number | null;
  currency: string;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
};
