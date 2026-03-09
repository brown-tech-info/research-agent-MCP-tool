import { useState } from 'react';
import type { AuditRecord, ToolCall } from '../types';

interface Props {
  auditRecord: AuditRecord | null;
  isLoading: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function ToolCallRow({ call }: { call: ToolCall }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="tool-call-item">
      <div
        className="tool-call-summary"
        onClick={() => setExpanded((v) => !v)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span
          className="tool-status"
          style={{ color: call.success ? 'var(--success)' : 'var(--error)' }}
          aria-label={call.success ? 'Success' : 'Failed'}
        >
          {call.success ? '✓' : '✗'}
        </span>
        <span className="tool-name">{call.toolName}</span>
        <span className="tool-duration">{formatDuration(call.durationMs)}</span>
        <span className="tool-timestamp">{formatTime(call.timestamp)}</span>
        <span className="tool-expand-icon">{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div className="tool-call-detail">
          <h4>Inputs</h4>
          <pre className="tool-inputs-json">
            {JSON.stringify(call.inputs, null, 2)}
          </pre>
          {call.error && (
            <div className="tool-error">Error: {call.error}</div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ToolTracePanel({
  auditRecord,
  isLoading,
  collapsed,
  onToggleCollapse,
}: Props) {
  return (
    <div className="tool-trace-panel">
      <div className="panel-header">
        {!collapsed && <span>🔍</span>}
        {!collapsed && 'Tool Trace'}
        <button
          onClick={onToggleCollapse}
          aria-label={collapsed ? 'Expand tool trace' : 'Collapse tool trace'}
          style={{ marginLeft: collapsed ? 'auto' : undefined }}
        >
          {collapsed ? '◀' : '▶'}
        </button>
      </div>

      {!collapsed && (
        <>
          {isLoading && (
            <div className="tool-trace-empty">
              <div className="loading-indicator" style={{ justifyContent: 'center' }}>
                <div className="spinner" />
                <span>Fetching tool trace…</span>
              </div>
            </div>
          )}

          {!isLoading && !auditRecord && (
            <div className="tool-trace-empty">No interaction selected.</div>
          )}

          {!isLoading && auditRecord && (
            <>
              <div className="tool-calls-list">
                {auditRecord.toolCalls.map((call, i) => (
                  <ToolCallRow key={i} call={call} />
                ))}
              </div>
              <div className="trace-footer">
                Total: {formatDuration(auditRecord.durationMs)} &nbsp;·&nbsp;{' '}
                {auditRecord.toolCalls.length} tool call
                {auditRecord.toolCalls.length !== 1 ? 's' : ''}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
