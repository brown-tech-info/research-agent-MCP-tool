import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import type { Message, ResearchResponse } from '../types';
import AgentMessage from './AgentMessage';

interface Props {
  messages: Message[];
  isLoading: boolean;
  onSubmit: (question: string) => void;
  onSaveToMemory: (response: ResearchResponse) => Promise<void>;
}

const EXAMPLE_PROMPTS: { label: string; source: 'pubmed' | 'clinicaltrials' | 'web' | 'multi'; text: string }[] = [
  {
    label: 'Web',
    source: 'web',
    text: 'What are the latest FDA regulatory updates on GLP-1 receptor agonists for obesity in 2024?',
  },
  {
    label: 'ClinicalTrials',
    source: 'clinicaltrials',
    text: "Are there any active Phase 3 clinical trials recruiting patients for Alzheimer's disease immunotherapy?",
  },
  {
    label: 'PubMed',
    source: 'pubmed',
    text: 'What does the peer-reviewed literature say about the mechanism of action of semaglutide in reducing cardiovascular risk?',
  },
  {
    label: 'PubMed + Trials',
    source: 'multi',
    text: 'What is the clinical evidence for CAR-T cell therapy in multiple myeloma, and are there ongoing trials?',
  },
];

export default function ConversationPanel({ messages, isLoading, onSubmit, onSaveToMemory }: Props) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  function handleSubmit() {
    const q = input.trim();
    if (!q || isLoading) return;
    setInput('');
    onSubmit(q);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div className="conversation-panel">
      <div className="message-list">
        {messages.length === 0 && !isLoading && (
          <div className="message-empty">
            <p>🔬</p>
            <p>No conversations yet. Enter a research question to begin.</p>
            <div className="example-prompts">
              {EXAMPLE_PROMPTS.map((prompt) => (
                <button
                  key={prompt.text}
                  className={`example-prompt-card example-prompt-${prompt.source}`}
                  onClick={() => setInput(prompt.text)}
                  type="button"
                >
                  <span className={`example-prompt-badge example-badge-${prompt.source}`}>{prompt.label}</span>
                  <span className="example-prompt-text">{prompt.text}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`message-row ${msg.role === 'streaming' ? 'agent' : msg.role}`}>
            <div className={`message-bubble ${msg.role === 'streaming' ? 'agent' : msg.role}`}>
              {msg.role === 'user' ? (
                <>
                  <div>{msg.content as string}</div>
                  <div className="message-meta">{formatTime(msg.timestamp)}</div>
                </>
              ) : msg.role === 'streaming' ? (
                <div className="streaming-message">
                  <div className="loading-indicator">
                    <div className="spinner" />
                    <span>{msg.streamingStatus ?? 'Working…'}</span>
                  </div>
                  {msg.content && (
                    <pre className="streaming-preview">{msg.content as string}</pre>
                  )}
                </div>
              ) : (
                <>
                  <AgentMessage content={msg.content} onSave={msg.content && typeof msg.content === 'object' && msg.content.type === 'response' ? onSaveToMemory : undefined} />
                  <div className="message-meta">{formatTime(msg.timestamp)}</div>
                </>
              )}
            </div>
          </div>
        ))}

        {isLoading && !messages.some((m) => m.role === 'streaming') && (
          <div className="message-row agent">
            <div className="message-bubble agent">
              <div className="loading-indicator">
                <div className="spinner" />
                <span>Researching — querying PubMed, ClinicalTrials.gov…</span>
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <form
        className="query-form"
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        <textarea
          className="query-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter a research question (e.g. What is the evidence for metformin in PCOS?)"
          disabled={isLoading}
          aria-label="Research question"
          rows={1}
        />
        <button
          type="submit"
          className="submit-btn"
          disabled={isLoading || !input.trim()}
        >
          {isLoading ? 'Researching…' : 'Ask'}
        </button>
      </form>
    </div>
  );
}
