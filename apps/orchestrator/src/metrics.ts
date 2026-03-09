/**
 * Metrics Collector — Spec Section 12.7
 *
 * Tracks basic operational metrics for observability and compliance review.
 * Metrics are in-memory and reset on restart (suitable for MVP).
 *
 * Tracked:
 * - Request counts per endpoint (total, success, error)
 * - Tool invocation counts (total, success, error)
 * - Latency samples for p50 / p99 calculation
 */

export interface EndpointMetrics {
  total: number;
  success: number;
  errors: number;
  latencyMs: number[];
}

export interface ToolMetrics {
  total: number;
  success: number;
  errors: number;
  latencyMs: number[];
}

export interface MetricsSnapshot {
  uptimeSeconds: number;
  requests: Record<string, EndpointMetrics>;
  tools: Record<string, ToolMetrics>;
  timestamp: string;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

export class MetricsCollector {
  private readonly startTime = Date.now();
  private requests: Map<string, EndpointMetrics> = new Map();
  private tools: Map<string, ToolMetrics> = new Map();

  // ---------------------------------------------------------------------------
  // Request tracking
  // ---------------------------------------------------------------------------

  recordRequest(endpoint: string, success: boolean, latencyMs: number): void {
    if (!this.requests.has(endpoint)) {
      this.requests.set(endpoint, { total: 0, success: 0, errors: 0, latencyMs: [] });
    }
    const m = this.requests.get(endpoint)!;
    m.total++;
    if (success) m.success++;
    else m.errors++;
    m.latencyMs.push(latencyMs);
  }

  // ---------------------------------------------------------------------------
  // Tool tracking
  // ---------------------------------------------------------------------------

  recordToolCall(toolName: string, success: boolean, latencyMs: number): void {
    if (!this.tools.has(toolName)) {
      this.tools.set(toolName, { total: 0, success: 0, errors: 0, latencyMs: [] });
    }
    const m = this.tools.get(toolName)!;
    m.total++;
    if (success) m.success++;
    else m.errors++;
    m.latencyMs.push(latencyMs);
  }

  // ---------------------------------------------------------------------------
  // Snapshot
  // ---------------------------------------------------------------------------

  snapshot(): MetricsSnapshot {
    const requestsOut: Record<string, EndpointMetrics & { p50Ms: number; p99Ms: number }> = {};
    for (const [key, m] of this.requests) {
      const sorted = [...m.latencyMs].sort((a, b) => a - b);
      requestsOut[key] = { ...m, p50Ms: percentile(sorted, 50), p99Ms: percentile(sorted, 99) };
    }

    const toolsOut: Record<string, ToolMetrics & { p50Ms: number; p99Ms: number }> = {};
    for (const [key, m] of this.tools) {
      const sorted = [...m.latencyMs].sort((a, b) => a - b);
      toolsOut[key] = { ...m, p50Ms: percentile(sorted, 50), p99Ms: percentile(sorted, 99) };
    }

    return {
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      requests: requestsOut,
      tools: toolsOut,
      timestamp: new Date().toISOString(),
    };
  }
}
