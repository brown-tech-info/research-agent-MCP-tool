import type { ApiResponse, AuditRecord, MemoryEntry, Citation } from './types';

// In production with Azure Static Web Apps, API calls use the SWA proxy (relative URLs).
// Set VITE_API_BASE_URL to override for non-proxy scenarios (e.g. direct Container App URL).
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((body as { error?: string }).error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

export async function submitResearchQuery(
  question: string,
  context?: string,
  history?: ConversationTurn[],
): Promise<ApiResponse> {
  const res = await fetch(`${API_BASE}/api/research`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, context, history }),
  });
  return handleResponse<ApiResponse>(res);
}

export interface StreamStatusEvent {
  phase: string;
  message?: string;
  tool?: string;
}

/** Subscribe to a streaming research response via SSE over POST. Returns an AbortController to cancel. */
export function submitResearchQueryStream(
  question: string,
  context: string | undefined,
  history: ConversationTurn[] | undefined,
  callbacks: {
    onStatus?: (data: StreamStatusEvent) => void;
    onToken?: (chunk: string) => void;
    onComplete?: (response: ApiResponse & { interactionId?: string }) => void;
    onError?: (err: Error) => void;
  },
): AbortController {
  const controller = new AbortController();

  (async () => {
    let res: Response;
    try {
      res = await fetch(`${API_BASE}/api/research/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, context, history }),
        signal: controller.signal,
      });
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        callbacks.onError?.(err instanceof Error ? err : new Error(String(err)));
      }
      return;
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      callbacks.onError?.(new Error((body as { error?: string }).error ?? res.statusText));
      return;
    }

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let currentEvent = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE lines
        const parts = buffer.split('\n');
        buffer = parts.pop() ?? '';

        for (const line of parts) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            try {
              const data = JSON.parse(dataStr) as Record<string, unknown>;
              if (currentEvent === 'status') {
                callbacks.onStatus?.(data as unknown as StreamStatusEvent);
              } else if (currentEvent === 'token') {
                callbacks.onToken?.(data.chunk as string);
              } else if (currentEvent === 'complete') {
                callbacks.onComplete?.(data as unknown as ApiResponse & { interactionId?: string });
              } else if (currentEvent === 'error') {
                callbacks.onError?.(new Error((data.message as string) ?? 'Streaming error'));
              }
            } catch {
              // malformed data line — skip
            }
            currentEvent = '';
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        callbacks.onError?.(err instanceof Error ? err : new Error(String(err)));
      }
    }
  })();

  return controller;
}

export async function getAuditRecord(interactionId: string): Promise<AuditRecord> {
  const res = await fetch(`${API_BASE}/api/audit/${encodeURIComponent(interactionId)}`);
  return handleResponse<AuditRecord>(res);
}

export async function listMemory(): Promise<{ entries: MemoryEntry[]; count: number }> {
  const res = await fetch(`${API_BASE}/api/memory`);
  return handleResponse<{ entries: MemoryEntry[]; count: number }>(res);
}

export async function saveMemory(
  title: string,
  content: string,
  citations?: Citation[],
): Promise<{ entry: MemoryEntry }> {
  const res = await fetch(`${API_BASE}/api/memory`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, content, citations }),
  });
  return handleResponse<{ entry: MemoryEntry }>(res);
}

export async function createMailDraft(
  to: string,
  subject: string,
  body: string,
  citations?: Citation[],
): Promise<{ draft: import('./types').MailDraft }> {
  const res = await fetch(`${API_BASE}/api/mail/draft`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, subject, body, citations }),
  });
  return handleResponse<{ draft: import('./types').MailDraft }>(res);
}

export async function deleteMemory(id: string): Promise<{ deleted: boolean; id: string }> {
  const res = await fetch(`${API_BASE}/api/memory/${encodeURIComponent(id)}`, { method: 'DELETE' });
  return handleResponse<{ deleted: boolean; id: string }>(res);
}
