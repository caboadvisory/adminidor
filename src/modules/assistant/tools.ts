import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { getClient, listClients } from "@/modules/clients/queries";
import {
  getProject,
  listProjects,
  listProjectsForPicker,
} from "@/modules/projects/queries";
import { getTimesheet } from "@/modules/reports/queries";
import { minutesToHours } from "@/modules/time/display";
import {
  listTimeEntriesByProject,
  listTimeEntriesByUser,
} from "@/modules/time/queries";
import type { TimeEntryProposal } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Tool definitions advertised to the model. All read-only except
// propose_time_entry, which only drafts an entry (the write happens on explicit
// user confirmation, never from the model).
export const ASSISTANT_TOOLS: Anthropic.Tool[] = [
  {
    name: "list_clients",
    description:
      "List the firm's clients with their KYC status and risk level. Use to find a client or answer questions about the client base.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_client",
    description:
      "Get full detail for one client by id, including KYC, beneficial owners and AML screenings (subject to the user's permissions).",
    input_schema: {
      type: "object",
      properties: { client_id: { type: "string" } },
      required: ["client_id"],
    },
  },
  {
    name: "list_projects",
    description:
      "List projects with their client, status, billing type and rate. Use to find a project by name before proposing a time entry.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_project",
    description: "Get full detail for one project by id.",
    input_schema: {
      type: "object",
      properties: { project_id: { type: "string" } },
      required: ["project_id"],
    },
  },
  {
    name: "list_time_entries",
    description:
      "List time entries. scope 'me' = the current user's own entries; scope 'project' = all entries for a given project (requires project_id). Optional from/to dates (YYYY-MM-DD) filter by work date.",
    input_schema: {
      type: "object",
      properties: {
        scope: { type: "string", enum: ["me", "project"] },
        project_id: { type: "string" },
        from: { type: "string", description: "YYYY-MM-DD" },
        to: { type: "string", description: "YYYY-MM-DD" },
      },
      required: ["scope"],
    },
  },
  {
    name: "timesheet",
    description:
      "Time sheet for a client over a period: all logged time grouped by project with hours and cost. Requires client_id, from and to (YYYY-MM-DD).",
    input_schema: {
      type: "object",
      properties: {
        client_id: { type: "string" },
        from: { type: "string", description: "YYYY-MM-DD" },
        to: { type: "string", description: "YYYY-MM-DD" },
      },
      required: ["client_id", "from", "to"],
    },
  },
  {
    name: "counts",
    description:
      "High-level counts: number of clients and active projects in the firm.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "propose_time_entry",
    description:
      "Draft a time entry for the current user to confirm. Does NOT save anything — it presents a confirmation card to the user, who must approve it. Resolve the project id with list_projects first. Provide work_date as YYYY-MM-DD and hours as a decimal number.",
    input_schema: {
      type: "object",
      properties: {
        project_id: { type: "string" },
        work_date: { type: "string", description: "YYYY-MM-DD" },
        hours: { type: "number" },
        description: { type: "string" },
        billable: { type: "boolean" },
      },
      required: ["project_id", "work_date", "hours"],
    },
  },
];

export type ToolContext = { userId: string };
export type ToolOutcome = { result: string; proposal?: TimeEntryProposal };

const ok = (data: unknown): ToolOutcome => ({ result: JSON.stringify(data) });
const fail = (message: string): ToolOutcome =>
  ({ result: JSON.stringify({ error: message }) });

export async function executeTool(
  name: string,
  input: any,
  ctx: ToolContext,
): Promise<ToolOutcome> {
  try {
    switch (name) {
      case "list_clients": {
        const clients = await listClients();
        return ok(clients.slice(0, 200));
      }
      case "get_client": {
        if (!input?.client_id) return fail("client_id is required");
        const client = await getClient(String(input.client_id));
        return client ? ok(client) : fail("Client not found");
      }
      case "list_projects": {
        const projects = await listProjects();
        return ok(projects.slice(0, 200));
      }
      case "get_project": {
        if (!input?.project_id) return fail("project_id is required");
        const project = await getProject(String(input.project_id));
        return project ? ok(project) : fail("Project not found");
      }
      case "list_time_entries": {
        const scope = input?.scope;
        let entries;
        if (scope === "project") {
          if (!input?.project_id)
            return fail("project_id is required when scope is 'project'");
          entries = await listTimeEntriesByProject(String(input.project_id));
        } else {
          entries = await listTimeEntriesByUser(ctx.userId);
        }
        const from = typeof input?.from === "string" ? input.from : null;
        const to = typeof input?.to === "string" ? input.to : null;
        const filtered = entries.filter(
          (e) =>
            (!from || e.workDate >= from) && (!to || e.workDate <= to),
        );
        return ok(
          filtered.slice(0, 200).map((e) => ({
            date: e.workDate,
            project: e.projectName,
            hours: minutesToHours(e.minutes),
            description: e.description,
            billable: e.billable,
            amount: e.amount,
            currency: e.currency,
          })),
        );
      }
      case "timesheet": {
        if (!input?.client_id || !input?.from || !input?.to)
          return fail("client_id, from and to are required");
        const result = await getTimesheet({
          clientId: String(input.client_id),
          from: String(input.from),
          to: String(input.to),
        });
        return ok(result);
      }
      case "counts": {
        const supabase = await createClient();
        const [clients, projects] = await Promise.all([
          supabase.from("clients").select("*", { count: "exact", head: true }),
          supabase
            .from("projects")
            .select("*", { count: "exact", head: true })
            .eq("status", "active"),
        ]);
        return ok({
          clients: clients.count ?? 0,
          activeProjects: projects.count ?? 0,
        });
      }
      case "propose_time_entry": {
        const projectId = input?.project_id ? String(input.project_id) : "";
        const workDate = input?.work_date ? String(input.work_date) : "";
        const hours = Number(input?.hours);
        if (!projectId) return fail("project_id is required");
        if (!DATE_RE.test(workDate))
          return fail("work_date must be YYYY-MM-DD");
        if (!(hours > 0)) return fail("hours must be a positive number");

        const projects = await listProjectsForPicker();
        const project = projects.find((p) => p.id === projectId);
        if (!project)
          return fail(
            "Unknown project_id. Call list_projects to find the correct id.",
          );

        const rate = project.effectiveRate;
        const amount =
          rate == null ? null : Math.round(rate * hours * 100) / 100;
        const billable = input?.billable === false ? false : true;

        const proposal: TimeEntryProposal = {
          projectId,
          projectName: project.name,
          clientName: project.clientName,
          currency: project.currency,
          workDate,
          hours,
          billable,
          unitRate: rate,
          amount,
          description:
            typeof input?.description === "string" && input.description.trim()
              ? input.description.trim()
              : null,
        };

        // No write here — the card is shown to the user for confirmation.
        return {
          result: JSON.stringify({
            status: "awaiting_user_confirmation",
            proposal: {
              project: proposal.projectName,
              client: proposal.clientName,
              date: proposal.workDate,
              hours: proposal.hours,
              amount: proposal.amount,
              currency: proposal.currency,
              billable: proposal.billable,
            },
          }),
          proposal,
        };
      }
      default:
        return fail(`Unknown tool: ${name}`);
    }
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Tool execution failed");
  }
}
