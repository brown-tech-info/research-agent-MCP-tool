import { useState } from 'react';
import type { MemoryEntry } from '../types';

interface Props {
  entries: MemoryEntry[];
  onDelete: (id: string) => void;
  onRefresh: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function MemoryEntryRow({
  entry,
  onDelete,
}: {
  entry: MemoryEntry;
  onDelete: (id: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);

  function handleDeleteClick() {
    if (confirming) {
      onDelete(entry.id);
    } else {
      setConfirming(true);
    }
  }

  return (
    <div className="memory-entry">
      <div className="memory-entry-body">
        <div className="memory-entry-title" title={entry.title}>
          {entry.title}
        </div>
        <div className="memory-entry-date">Saved {formatDate(entry.savedAt)}</div>
        {entry.citations.length > 0 && (
          <div className="memory-citations">
            {entry.citations.map((c, i) => (
              <span key={i} className="citation-badge" title={c.title}>
                {c.type === 'pmid' && `PMID:${c.id}`}
                {c.type === 'nct' && c.id}
                {c.type === 'url' && (
                  (() => {
                    try {
                      return new URL(c.id).hostname;
                    } catch {
                      return c.id.slice(0, 20);
                    }
                  })()
                )}
              </span>
            ))}
          </div>
        )}
      </div>

      <button
        className={`delete-btn${confirming ? ' confirm' : ''}`}
        onClick={handleDeleteClick}
        onBlur={() => setConfirming(false)}
        aria-label={confirming ? 'Confirm delete' : `Delete "${entry.title}"`}
      >
        {confirming ? 'Confirm?' : 'Delete'}
      </button>
    </div>
  );
}

export default function MemoryPanel({
  entries,
  onDelete,
  onRefresh,
  collapsed,
  onToggleCollapse,
}: Props) {
  return (
    <div className="memory-panel">
      <div className="panel-header">
        {!collapsed && <span>🧠</span>}
        {!collapsed && 'Research Memory'}
        {!collapsed && entries.length > 0 && (
          <span className="badge">{entries.length}</span>
        )}
        {!collapsed && (
          <button onClick={onRefresh} aria-label="Refresh memory" title="Refresh">
            ↻
          </button>
        )}
        <button
          onClick={onToggleCollapse}
          aria-label={collapsed ? 'Expand memory panel' : 'Collapse memory panel'}
          style={{ marginLeft: collapsed ? 'auto' : undefined }}
        >
          {collapsed ? '▲' : '▼'}
        </button>
      </div>

      {!collapsed && (
        <>
          <div className="memory-panel-note">
            Memory is user-controlled. Entries are deleted permanently.
          </div>

          {entries.length === 0 ? (
            <div className="memory-empty">No saved entries.</div>
          ) : (
            <div className="memory-list">
              {entries.map((entry) => (
                <MemoryEntryRow key={entry.id} entry={entry} onDelete={onDelete} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
