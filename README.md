# Pharmaceutical Research Assistant Agent

## Purpose

This is a **research assistant agent** designed for technical and scientific researchers in pharmaceutical companies. The agent accelerates evidence discovery, synthesis, and communication while maintaining scientific rigor and regulatory compliance.

**This is NOT a medical device and does NOT provide medical advice, treatment recommendations, or patient-specific guidance.**

## What It Does

The agent assists researchers by:

- **Discovering biomedical literature** via PubMed (peer-reviewed publications with full abstracts)
- **Analyzing clinical trials** via ClinicalTrials.gov (registered trial metadata, status, endpoints)
- **Synthesizing evidence** with explicit inline citations and uncertainty signaling (GPT-4o)
- **Streaming responses** progressively — tokens appear as GPT-4o generates them
- **Supporting multi-turn conversations** — follow-up questions inherit prior context automatically
- **Drafting professional emails** from research results — type "email that to me@example.com" in chat
- **Maintaining full audit trails** for traceability and reproducibility
- **Persisting research memory** — save, inspect, and delete research notes across sessions

## Architecture

```
User → Frontend (React/Vite, port 5173)
       ↓
    Orchestrator (Express API, port 3001)
       ├── LLM Query Parser   (Azure OpenAI: natural language → structured search terms)
       ├── Tool Selector       (default order: PubMed → ClinicalTrials.gov → Web)
       ├── MCP Client          (invokes registered MCP tools)
       ├── LLM Synthesizer     (Azure OpenAI: tool results → cited structured response)
       ├── SSE Streaming       (tokens streamed to frontend as synthesis happens)
       └── Audit Recorder      (full per-interaction trace to audit.jsonl)
       ↓
    MCP Servers
       ├── pubmed-mcp          (esearch + efetch for full abstracts)
       ├── clinicaltrials-mcp  (trial search + fetch by NCT ID)
       ├── web-mcp             (public web fetch)
       ├── m365-mail-mcp       (draft-only; no send capability)
       └── memory-mcp          (user-controlled research notes)
```

**Key principles:**
- All external data access via Model Context Protocol (MCP) tools — never answered from model memory alone
- Orchestrator selects the minimum set of tools required; selection is always inspectable
- Every interaction writes a complete audit record (tool calls, inputs, outputs, timestamps)
- Default tool order: PubMed → ClinicalTrials.gov → Web Research
- All responses follow the structured Spec §11.2 format with explicit citations and uncertainty
- Email drafts always require user review — no autonomous sending capability exists by design

## Governing Documents

All work on this system **must** comply with these documents in precedence order:

1. **`constitution.md`** — Non-negotiable principles (scientific integrity, safety boundaries, tool discipline)
2. **`spec.md`** — Complete system specification (capabilities, MCP contracts, orchestration rules, output formats)
3. **`plan.md`** — Implementation plan and phased task breakdown

**Before contributing, read the constitution and relevant spec sections.**

## Project Structure

```
/apps/
  /frontend/           # Conversational UI (React + Vite)
  /orchestrator/       # Core agent logic (tool selection, synthesis, audit, API server)
/servers/
  /pubmed-mcp/         # PubMed MCP server (esearch + efetch)
  /clinicaltrials-mcp/ # ClinicalTrials.gov MCP server
  /web-mcp/            # Web research MCP server
  /m365-mail-mcp/      # M365 email drafting MCP server (draft-only)
  /memory-mcp/         # Research memory MCP server
/infra/                # Infrastructure configuration and deployment
/tests/                # Contract tests and end-to-end tests
/docs/                 # Developer documentation (see docs/api.md for REST reference)
```

## Getting Started

### Prerequisites

- **Node.js** v18+ (native `fetch` required)
- **npm** v8+ (workspaces support)
- **Azure OpenAI** resource with a `gpt-4o` deployment *(for LLM query parsing and synthesis)*

### Configuration

```bash
cp apps/orchestrator/.env.example apps/orchestrator/.env
```

Then fill in your values:

```env
AZURE_OPENAI_ENDPOINT=https://<your-resource>.cognitiveservices.azure.com/
AZURE_OPENAI_KEY=<your-api-key>
AZURE_OPENAI_DEPLOYMENT=gpt-4o
AZURE_OPENAI_API_VERSION=2024-10-01-preview
```

> **Note:** `.env` is gitignored — never commit credentials.
> If Azure OpenAI is not configured the orchestrator falls back to keyword-based search (no LLM synthesis or streaming).

The server validates all four variables on startup and exits immediately with a clear error message if any are missing or contain placeholder values.

### Install & Run

```bash
npm install
```

**Terminal 1 — Backend (orchestrator API on port 3001):**
```bash
cd apps/orchestrator
npm start
```

**Terminal 2 — Frontend (Vite dev server on port 5173):**
```bash
cd apps/frontend
npm run dev
```

Open **http://localhost:5173**.

> If port 3001 is already in use:
> ```powershell
> Get-NetTCPConnection -LocalPort 3001 -State Listen |
>   Select-Object -ExpandProperty OwningProcess |
>   ForEach-Object { Stop-Process -Id $_ -Force }
> ```

### Running Tests

```bash
npm test
```

Runs all 88 tests across MCP contract tests and orchestrator integration tests.

## Using the Agent

### Research queries

Type any natural language research question:
> *What is the evidence for metformin in polycystic ovary syndrome?*

The agent will:
1. Parse the question with GPT-4o into structured search terms
2. Query PubMed and ClinicalTrials.gov (with visible status updates in the chat bubble)
3. Stream the synthesis response token-by-token as GPT-4o generates it
4. Display the structured result (Summary / Evidence Overview / Synthesis / Confidence & Gaps / References)

### Multi-turn conversations

Follow-up questions automatically carry prior context:
> *What about the evidence in adolescents specifically?*

Prior turns are sent with each request so the LLM can resolve references without re-stating the topic.

### Email drafting

After receiving a research response, type a natural language email request:
> *Please email the last response to alice@example.com*
> *Can you send that to my team at research@pharma.com?*

The agent detects the email intent and recipient address, formats the full research response into a professional citation-preserving email body, and presents a **Draft Review card** in the chat — clearly labelled `DRAFT` — with a **Copy to clipboard** button.

> **By design, no email is ever sent automatically.** The `DraftMailTool` has `sendCapability: false`
> hardcoded (per `constitution.md §4`). Actual sending requires M365 Graph API / OAuth integration,
> which is not wired up. The draft card IS the review and confirmation step.

### Tool trace & audit

The **Tool Trace** panel shows every MCP tool invoked, its inputs, outputs, and duration for the current query. Full interaction records are persisted to `apps/orchestrator/data/audit.jsonl` and accessible via `GET /api/audit/:id`.

### Research memory

The **Memory** panel lets you save, inspect, and delete research notes. Saved notes preserve citations. Nothing is saved automatically — all memory is explicitly user-controlled.

## API Reference

See **[docs/api.md](docs/api.md)** for the complete REST API reference.

## Development Workflow

1. **Read governing documents** before writing any code
2. **Update spec.md first** when adding new behavior (spec-driven development)
3. **Follow the task sequence** in `plan.md`
4. **Run tests** before and after changes: `npm test`
5. **Never reduce auditability** — any change that makes interactions less traceable is invalid

## Non-Negotiable Constraints

From `constitution.md`:

- **Never fabricate** citations, PMIDs, NCT IDs, or trial outcomes
- **Explicit uncertainty** — "Evidence is limited", "Results are mixed", "No published trials identified"
- **All external data via MCP tools** — no simulated or inferred tool outputs
- **User identity for all actions** — no shared service accounts
- **Explainable reasoning** — tool selection and synthesis rationale always visible
- **Privacy-preserving** — no personal health data stored or inferred
- **Draft-only email** — no autonomous sending capability, ever

## Output Standards

All substantive research responses follow this structure (Spec §11.2):

| Section | Content |
|---|---|
| **Summary** | Concise overview of key findings |
| **Evidence Overview** | Sources with PMIDs / NCT IDs / URLs |
| **Synthesis & Interpretation** | Analysis with inline citations after every claim |
| **Confidence & Gaps** | Explicit uncertainty and missing data |
| **References** | Full numbered source list with links |

## Current Status

**Phase:** Post-MVP (Phase 9) — all planned improvements complete.

### Implemented features

| Task | Description | Status |
|---|---|---|
| T9.1 | Graceful shutdown + uncaught exception/rejection handlers | ✅ |
| T9.2 | Startup `.env` validation — exits with clear error on misconfiguration | ✅ |
| T9.3 | PubMed full abstracts via `efetch` (previously returning empty abstracts) | ✅ |
| T9.4 | ClinicalTrials.gov wired into LLM orchestration path | ✅ |
| T9.5 | Web research tool correctly routed in LLM path | ✅ |
| T9.6 | Multi-turn conversation history — follow-up questions inherit context | ✅ |
| T9.7 | Streaming LLM responses via SSE — tokens visible as synthesis happens | ✅ |
| — | Email draft from chat — natural language intent → draft review card | ✅ |

### Known limitations

- **Email sending**: Draft-only by design. M365 Graph API / OAuth not integrated.
- **Web research**: The `web-fetch` tool requires a direct URL; open-ended web search queries are skipped with a logged notice.
- **Memory persistence**: In-memory within a single server process; no database backing.

## Contributing

This project uses agent-based, spec-driven development with GitHub Copilot CLI.

**Before implementing:**
1. Verify your task is explicitly allowed by the spec
2. Update `spec.md` before adding new behavior
3. Ensure compliance with all constitution constraints

**Principles:**
- Fail loudly, not silently
- Accuracy before speed
- Transparency before autonomy
- Assistance before authority

## License

*(To be defined)*

## Contact

*(To be defined)*
