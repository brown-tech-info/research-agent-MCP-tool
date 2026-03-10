# Pharmaceutical Research Assistant Agent

[![CI](https://github.com/brown-tech-info/research-agent-MCP-tool/actions/workflows/ci.yml/badge.svg)](https://github.com/brown-tech-info/research-agent-MCP-tool/actions/workflows/ci.yml)

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
- **Clickable example prompts** — four pre-built queries surface on the empty state to help users get started
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

Fill in your values — all authentication uses `DefaultAzureCredential` (no API keys needed for Azure OpenAI or Cosmos DB):

```env
# Azure OpenAI — run `az login` once; no API key needed
AZURE_OPENAI_ENDPOINT=https://<your-resource>.cognitiveservices.azure.com/
AZURE_OPENAI_DEPLOYMENT=gpt-4o
AZURE_OPENAI_API_VERSION=2024-12-01-preview

# Web search (regulatory/news queries) — free at https://app.tavily.com
TAVILY_API_KEY=<your-tavily-api-key>

# Cosmos DB memory persistence — az login credential used automatically
# Leave unset to use in-memory store (data lost on restart)
COSMOS_ENDPOINT=https://<your-cosmos-account>.documents.azure.com:443/
```

> **No API keys required** for Azure OpenAI or Cosmos DB. Run `az login` once and `DefaultAzureCredential` handles authentication for both — locally and in Azure (Managed Identity).

> `.env` is gitignored — never commit credentials. If Azure OpenAI is not configured the orchestrator falls back to keyword-based search (no LLM synthesis or streaming).

See `.env.example` for the full reference including how to provision a local Cosmos DB account and grant yourself the required role.

### Install & Run

```bash
npm install
npm run build   # compiles all workspace packages (servers + orchestrator)
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

> **After any code change to a server package**, run `npm run build` from the root before restarting the orchestrator to ensure the compiled output is up to date.

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

Runs all 103 tests across MCP contract tests and orchestrator integration tests.

## Using the Agent

### Research queries

When you open the app with an empty conversation, four **clickable example prompts** are shown — one for each data source (Web, ClinicalTrials, PubMed, PubMed + Trials). Click any card to populate the input field, then submit or edit as needed. They disappear once a conversation starts.

Type any natural language research question:
> *What is the evidence for metformin in polycystic ovary syndrome?*

The agent will:
1. Parse the question with GPT-4o into structured search terms
2. Query PubMed and ClinicalTrials.gov (with visible status updates in the chat bubble)
3. Stream the synthesis response token-by-token as GPT-4o generates it
4. Display the structured result (Summary / Evidence Overview / Synthesis / Confidence & Gaps / References)

### Starting a new conversation

A **+ New Research** button appears in the top-right of the header whenever a conversation is active. Clicking it clears the current conversation, resets the Tool Trace panel, and returns to the empty state with example prompts — no page refresh needed.

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

When `COSMOS_ENDPOINT` is configured, notes persist across server restarts in Azure Cosmos DB using managed identity authentication (no connection string needed). Without it, an in-memory store is used (data is lost on restart — fine for local testing).

## Deploy to Azure

[![Deploy to Azure](https://aka.ms/deploytoazurebutton)](https://portal.azure.com)

This project is ready for one-command Azure deployment using the **Azure Developer CLI** (`azd`).

### Architecture in Azure

```
User
  ↓
Azure Static Web Apps (React frontend)
  ↓  /api/* proxy (SWA linked backend)
Azure Container Apps (Express orchestrator, port 3001, always-on)
  ├── Azure OpenAI (your existing resource, Managed Identity auth)
  ├── Azure Cosmos DB (serverless, research memory, Managed Identity auth)
  ├── Tavily Search API (web/regulatory queries)
  └── Application Insights + Log Analytics
```

### Prerequisites

Install these tools before you begin (one-time setup):

- [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli)
- [Azure Developer CLI (`azd`)](https://aka.ms/azd-install)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) — must be **running** when you run `azd up`
- [Node.js 20+](https://nodejs.org/)
- An Azure subscription with an existing **Azure OpenAI** resource and a `gpt-4o` deployment
- A free **Tavily** account for web search — sign up at [app.tavily.com](https://app.tavily.com) (1,000 searches/month, no credit card required)

> **Cost note:** `azd up` provisions a Static Web Apps **Standard** tier (~$9/month) required for the `/api/*` backend proxy to work, plus a serverless Cosmos DB account and a Container App (always-on, 0.5 vCPU / 1 GB). Estimated total: ~$15–20/month depending on usage. Run `azd down` to remove all resources.

### Deploy

Run all commands from the **repo root directory**:

```bash
# 1. Authenticate with Azure (one command covers both az and azd)
az login

# 2. Clone the repo and enter it
git clone https://github.com/brown-tech-info/research-agent-MCP-tool.git
cd research-agent-MCP-tool

# 3. Create an azd environment
azd env new research-agent-prod

# 4. Set required configuration (never committed to source)
azd env set AZURE_OPENAI_ENDPOINT     https://<your-resource>.cognitiveservices.azure.com/
azd env set AZURE_OPENAI_DEPLOYMENT   gpt-4o
azd env set AZURE_OPENAI_API_VERSION  2024-12-01-preview
azd env set TAVILY_API_KEY            <your-tavily-api-key>

# Optional — provide your OpenAI resource ID to auto-assign Managed Identity RBAC
# azd env set AZURE_OPENAI_RESOURCE_ID /subscriptions/<sub>/resourceGroups/<rg>/providers/Microsoft.CognitiveServices/accounts/<name>

# 5. Provision infrastructure and deploy everything
#    ⚠️  Make sure Docker Desktop is running before this step
#    (check the whale icon in your system tray)
azd up
```

`azd up` will:
1. Provision all Azure resources (Container Apps environment, Container App, Container Registry, **Cosmos DB serverless**, Static Web App, Application Insights)
2. Grant the Container App's Managed Identity access to Cosmos DB via RBAC (no secrets)
3. Link the Container App as the `/api/*` backend for the Static Web App (automatic proxying)
4. Build and push the orchestrator Docker image to ACR
5. Build the React frontend and deploy to Static Web Apps
6. Wire everything together: SWA URL → CORS, Container App URL → Cosmos endpoint env var

After deployment, `azd` prints the frontend URL — open it to use the agent.

### Subsequent deployments

```bash
# Redeploy after code changes (from repo root)
azd deploy
```

### Tear down

```bash
# Remove all Azure resources (from repo root)
azd down
```

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
| T9.8 | GitHub Actions CI — automated test runs on push/PR, CI badge in README | ✅ |
| T9.9 | `web-search` tool via Tavily Search API for regulatory/news open-ended queries | ✅ |
| — | Clickable example prompts — four pre-built query cards on empty state, color-coded by source | ✅ |
| — | + New Research button — clears conversation from the header without a page refresh | ✅ |
| — | Cosmos DB-backed research memory — persists across restarts, managed identity auth | ✅ |
| — | Email draft from chat — natural language intent → draft review card | ✅ |
| — | Azure deployment — `azd up` provisions Container Apps + Static Web Apps | ✅ |

### Known limitations

- **Email sending**: Draft-only by design. M365 Graph API / OAuth not integrated.
- **Web search**: Requires `TAVILY_API_KEY`. Without it, open-ended regulatory/news queries fall back to PubMed only.

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
