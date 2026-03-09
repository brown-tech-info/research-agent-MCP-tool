import { useState } from 'react';
import type { ApiResponse, ResearchResponse } from '../types';
import EvidenceChip from './EvidenceChip';
import DraftMailCard from './DraftMailCard';

interface Props {
  content: string | ApiResponse;
  onSave?: (response: ResearchResponse) => Promise<void>;
}

export default function AgentMessage({ content, onSave }: Props) {
  if (typeof content === 'string') {
    return <div className="agent-message">{content}</div>;
  }

  if (content.type === 'clarification') {
    return (
      <div className="agent-message">
        <div className="clarification-box">
          <div className="clarification-reason">
            ℹ️ Clarification needed: {content.reason}
          </div>
          <div className="clarification-suggestion">{content.suggestion}</div>
        </div>
      </div>
    );
  }

  if (content.type === 'draft') {
    return (
      <div className="agent-message">
        <DraftMailCard draft={content.draft} />
      </div>
    );
  }

  const res = content as ResearchResponse;

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  async function handleSave() {
    if (!onSave || saveState !== 'idle') return;
    setSaveState('saving');
    try {
      await onSave(res);
      setSaveState('saved');
    } catch {
      setSaveState('error');
      setTimeout(() => setSaveState('idle'), 3000);
    }
  }

  return (
    <div className="agent-message">
      {/* Summary */}
      <div className="agent-section">
        <div className="agent-section-title">Summary</div>
        <div className="agent-summary">{res.summary}</div>
      </div>

      {/* Evidence Overview */}
      {res.evidenceOverview.length > 0 && (
        <div className="agent-section">
          <div className="agent-section-title">Evidence Overview</div>
          <div className="evidence-chips">
            {res.evidenceOverview.map((src, i) => (
              <EvidenceChip key={i} source={src} />
            ))}
          </div>
        </div>
      )}

      {/* Synthesis & Interpretation */}
      {res.synthesisAndInterpretation && (
        <div className="agent-section">
          <div className="agent-section-title">Synthesis &amp; Interpretation</div>
          <div className="synthesis-text">{res.synthesisAndInterpretation}</div>
        </div>
      )}

      {/* Confidence & Gaps */}
      {res.confidenceAndGaps && (
        <div className="agent-section">
          <div className="agent-section-title">Confidence &amp; Gaps</div>
          <div className="confidence-box">{res.confidenceAndGaps}</div>
        </div>
      )}

      {/* References */}
      {res.references.length > 0 && (
        <div className="agent-section">
          <div className="agent-section-title">References</div>
          <ol className="references-list">
            {res.references.map((ref, i) => (
              <li key={ref.id}>
                {i + 1}.{' '}
                {ref.url ? (
                  <a href={ref.url} target="_blank" rel="noopener noreferrer">
                    {ref.citation}
                  </a>
                ) : (
                  ref.citation
                )}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Save to memory */}
      {onSave && (
        <div className="agent-actions">
          <button
            className={`save-memory-btn${saveState === 'saved' ? ' saved' : saveState === 'error' ? ' error' : ''}`}
            onClick={() => void handleSave()}
            disabled={saveState === 'saving' || saveState === 'saved'}
            title={saveState === 'saved' ? 'Saved to Research Memory' : 'Save this response to Research Memory'}
          >
            {saveState === 'idle' && '🧠 Save to memory'}
            {saveState === 'saving' && 'Saving…'}
            {saveState === 'saved' && '✓ Saved'}
            {saveState === 'error' && '✗ Save failed'}
          </button>
        </div>
      )}
    </div>
  );
}
