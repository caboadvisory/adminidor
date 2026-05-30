// Anthropic / Assistant configuration. Server-only — the API key must never be
// exposed to the browser (no NEXT_PUBLIC_ prefix).
export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";

// Model is overridable per deployment; defaults to Opus 4.8.
export const ASSISTANT_MODEL =
  process.env.ASSISTANT_MODEL?.trim() || "claude-opus-4-8";

export function isAssistantConfigured(): boolean {
  return Boolean(ANTHROPIC_API_KEY);
}
