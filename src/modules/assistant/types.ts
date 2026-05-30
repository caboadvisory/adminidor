export type AssistantRole = "user" | "assistant";

export type ConversationListItem = {
  id: string;
  title: string | null;
  updatedAt: string;
};

export type AssistantMessage = {
  id: string;
  role: AssistantRole;
  content: string;
  createdAt: string;
};

// A proposed time entry the user must confirm before it is written.
export type TimeEntryProposal = {
  projectId: string;
  projectName: string | null;
  clientName: string | null;
  currency: string;
  workDate: string; // YYYY-MM-DD
  hours: number;
  billable: boolean;
  unitRate: number | null;
  amount: number | null;
  description: string | null;
};

// NDJSON event protocol streamed from the chat route to the client.
export type ChatStreamEvent =
  | { type: "conversation"; id: string; title: string | null }
  | { type: "text"; delta: string }
  | { type: "proposal"; proposal: TimeEntryProposal }
  | { type: "done" }
  | { type: "error"; message: string };
