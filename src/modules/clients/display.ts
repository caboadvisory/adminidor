import type { BadgeTone } from "@/components/ui/badge";
import type { AmlScreeningResult, KycStatus, RiskLevel } from "./types";

export function kycStatusTone(status: KycStatus): BadgeTone {
  switch (status) {
    case "verified":
      return "green";
    case "in_progress":
      return "blue";
    case "rejected":
    case "expired":
      return "red";
    default:
      return "neutral";
  }
}

export function riskTone(risk: RiskLevel | null): BadgeTone {
  switch (risk) {
    case "low":
      return "green";
    case "medium":
      return "amber";
    case "high":
      return "red";
    default:
      return "neutral";
  }
}

export function amlResultTone(result: AmlScreeningResult): BadgeTone {
  switch (result) {
    case "clear":
      return "green";
    case "hit":
      return "red";
    default:
      return "amber";
  }
}
