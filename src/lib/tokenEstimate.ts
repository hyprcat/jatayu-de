/** Simple token estimation: ~4 chars per token (GPT/Claude average) */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

/** Format token count as human-readable string */
export function formatTokenCount(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`
  return String(tokens)
}
