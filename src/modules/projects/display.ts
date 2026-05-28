import type { BadgeTone } from "@/components/ui/badge";
import type { ProjectStatus } from "./types";

export function projectStatusTone(status: ProjectStatus): BadgeTone {
  switch (status) {
    case "active":
      return "green";
    case "on_hold":
      return "amber";
    case "completed":
      return "blue";
    case "archived":
      return "neutral";
    default:
      return "neutral";
  }
}
