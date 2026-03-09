# REST API Reference — Pharmaceutical Research Assistant

Base URL: `http://localhost:3001`

All endpoints return JSON unless noted. All requests accept `Content-Type: application/json`.

---

## Research

### `POST /api/research`

Submit a research question and receive a complete structured response in one round-trip.

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `question` | `string` | ✅ | Natural language research question |
| `context` | `string` | — | Optional scope constraint |
| `history` | `ConversationTurn[]` | — | Prior conversation turns for multi-turn context |

```json
{
  "question": "What is the evidence for metformin in PCOS?",
  "history": [
    { "role": "user", "content": "Tell me about metformin." },
    { "role": "assistant", "content": "Metformin is a biguanide..." }
  ]
}
```

**Response — research result**

```json
{
  "type": "response",
  "interactionId": "uuid",
  "summary": "...",
  "evidenceOverview": [
    { "type": "pubmed", "identifier": "PMID:12345678", "description": "..." }
  ],
  "synthesisAndInterpretation": "...",
  "confidenceAndGaps": "...",
  "references": [
    { "id": "PMID:12345678", "citation": "Author et al. ...", "url": "https://pubmed.ncbi.nlm.nih.gov/..." }
  ]
}
```

**Response — clarification needed**

```json
{
  "type": "clarification",
  "reason": "Query is ambiguous between two distinct conditions.",
  "suggestion": "Did you mean Type 2 diabetes or PCOS?"
}
```

---

### `POST /api/research/stream`

Submit a research question and receive a streaming Server-Sent Events (SSE) response.
The response body is `text/event-stream`. Use `fetch()` with `response.body.getReader()` to consume it — do not use `EventSource` (requires POST).

**Request body** — same as `POST /api/research`.

**SSE event stream**

Events arrive in order:

| Event | Data shape | Description |
|---|---|---|
| `status` | `{ phase, message, tool? }` | Progress update — one per tool queried, plus parse/synthesize phases |
| `token` | `{ chunk: string }` | A single LLM output token during synthesis |
| `complete` | Response object (see below) | Final structured result; also signals stream end |
| `error` | `{ message: string }` | Terminal error; stream ends |

**`status` phase values**

| `phase` | When |
|---|---|
| `parsing` | LLM query parser is running |
| `querying` | An MCP tool is being invoked (see `tool` field) |
| `synthesizing` | LLM synthesis has started |

**`complete` event data**

Same shape as the `POST /api/research` response — either a `response` or `clarification` object, always including `interactionId` when `type === "response"`.

**Client example (TypeScript)**

```typescript
const res = await fetch('/api/research/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ question }),
});

const reader = res.body!.getReader();
const decoder = new TextDecoder();
let buffer = '';
let currentEvent = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });

  for (const line of buffer.split('\n')) {
    if (line.startsWith('event: ')) currentEvent = line.slice(7).trim();
    else if (line.startsWith('data: ')) {
      const data = JSON.parse(line.slice(6));
      if (currentEvent === 'token') console.log(data.chunk);
      if (currentEvent === 'complete') handleComplete(data);
      currentEvent = '';
    }
  }
  buffer = buffer.split('\n').pop() ?? '';
}
```

---

## Audit

### `GET /api/audit`

List all recorded interaction IDs.

**Response**

```json
{ "ids": ["uuid-1", "uuid-2"] }
```

---

### `GET /api/audit/:interactionId`

Retrieve the full audit record for a single interaction.

**Response**

```json
{
  "interactionId": "uuid",
  "timestamp": "2026-03-06T13:00:00.000Z",
  "userInput": { "question": "...", "context": null },
  "toolCalls": [
    {
      "toolName": "pubmed-search",
      "timestamp": "...",
      "inputs": { "query": "metformin PCOS", "maxResults": 10 },
      "outputs": { "totalFound": 47, "results": [...] },
      "success": true,
      "durationMs": 620
    }
  ],
  "finalResponse": { ... },
  "durationMs": 4210
}
```

**404** — Interaction not found.

---

## Memory

### `GET /api/memory`

List all saved research memory entries.

**Response**

```json
{
  "entries": [
    {
      "id": "uuid",
      "title": "Metformin PCOS summary",
      "content": "...",
      "citations": [{ "type": "pmid", "id": "12345678", "title": "..." }],
      "savedAt": "...",
      "updatedAt": "..."
    }
  ],
  "count": 1
}
```

---

### `POST /api/memory`

Save a new research memory entry.

**Request body**

| Field | Type | Required |
|---|---|---|
| `title` | `string` | ✅ |
| `content` | `string` | ✅ |
| `citations` | `Citation[]` | — |

**Response** — `201 Created`

```json
{ "entry": { "id": "uuid", ... } }
```

---

### `DELETE /api/memory/:id`

Delete a memory entry by ID.

**Response**

```json
{ "deleted": true, "id": "uuid" }
```

---

## Email Drafting

### `POST /api/mail/draft`

Create a reviewable email draft. **No send capability exists** — `sendCapability` is always `false`.

**Request body**

| Field | Type | Required |
|---|---|---|
| `to` | `string` | ✅ |
| `subject` | `string` | ✅ |
| `body` | `string` | ✅ |
| `citations` | `Citation[]` | — |

**Response** — `201 Created`

```json
{
  "draft": {
    "id": "uuid",
    "to": "alice@example.com",
    "subject": "Research Summary: ...",
    "body": "...",
    "citations": [],
    "status": "DRAFT",
    "createdAt": "...",
    "sendCapability": false,
    "requiresUserApproval": true
  }
}
```

> The frontend automatically calls this endpoint when it detects email intent in a chat message
> (presence of an email address + "email"/"send"/"mail" keyword). The resulting draft is rendered
> as a review card in the conversation. See `README.md §Email drafting` for user-facing details.

---

## Metrics

### `GET /api/metrics`

Return a snapshot of request and tool-call metrics since server start.

**Response**

```json
{
  "requests": {
    "POST /api/research": { "total": 12, "success": 11, "errors": 1, "avgLatencyMs": 3800 }
  },
  "toolCalls": {
    "pubmed-search": { "total": 11, "success": 10, "errors": 1, "avgDurationMs": 540 }
  }
}
```

---

## Type Definitions

### `ConversationTurn`

```typescript
{ role: "user" | "assistant"; content: string }
```

### `Citation`

```typescript
{ type: "pmid" | "nct" | "url"; id: string; title?: string }
```

### `EvidenceSource`

```typescript
{ type: "pubmed" | "clinicaltrials" | "web" | "unknown"; identifier: string; description: string }
```

### `Reference`

```typescript
{ id: string; citation: string; url: string }
```

---

## Error responses

All error responses use standard HTTP status codes with a JSON body:

```json
{ "error": "Human-readable error message" }
```

| Status | Meaning |
|---|---|
| 400 | Missing or invalid request fields |
| 404 | Resource not found |
| 500 | Unexpected server error |

Server errors are also logged structurally via the internal logger and recorded in metrics.
