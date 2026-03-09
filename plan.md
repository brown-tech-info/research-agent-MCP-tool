
Tasks — Pharmaceutical Research Assistant Agent
This document translates plan.md into a concrete, ordered task list suitable for spec‑driven, agent‑based development using GitHub Copilot CLI and the GitHub Spec Kit.
All tasks are constrained by constitution.md and spec.md. Any task that violates those documents is invalid.


Task Conventions

Tasks are sequential by default unless marked as parallel‑safe.
Each task has a clear done definition.
No task may introduce behavior not explicitly allowed by the spec.
Copilot may generate code, but humans remain reviewers and gatekeepers.


Phase 0 — Governance & Readiness (Gate)
T0.1 Verify governing documents

Confirm constitution.md, spec.md, and plan.md exist at repo root
Confirm no open TODOs or placeholders in those documents
Done when: All three documents are present, reviewed, and approved.


Phase 1 — Repository Bootstrap
T1.1 Initialize repository structure

Create directory structure defined in plan.md Section 1.1
Add empty .gitkeep files where needed
Done when: Repo tree exactly matches the planned layout.


T1.2 Create README.md

Describe project purpose (research assistant, not medical system)
Document local run flow (frontend → orchestrator → MCP servers)
Reference governing documents explicitly
Done when: New contributor can understand intent and run locally.


T1.3 Tooling baseline

Add formatting, linting, and test defaults
Add pre‑commit or CI checks (format + tests only)
Done when: CI fails on formatting or test errors.


Phase 2 — Architecture Skeleton
T2.1 Orchestrator skeleton

Create orchestrator app with:Request intake
Tool selection placeholder
Structured response template (Spec 11)
Done when: Orchestrator can return a static, spec‑compliant response.


T2.2 MCP client adapter

Implement abstraction layer for calling MCP tools
Capture tool name, inputs, outputs, timestamps
Done when: Orchestrator can call a stub MCP tool and record metadata.


T2.3 Audit / trace recorder

Persist per‑interaction audit record
Store: user input, tool calls, outputs, final response
Done when: A single interaction can be fully reconstructed.


Phase 3 — MCP Servers (One at a Time)
T3.1 PubMed MCP server

Implement search tool
Implement fetch‑by‑PMID tool
Handle empty and error cases explicitly
Done when:

Valid PMIDs returned
Empty results surfaced explicitly
Contract tests pass


T3.2 ClinicalTrials.gov MCP server

Implement trial search tool
Implement fetch‑by‑NCT tool
Represent “results not available” clearly
Done when:

Trial status is correct
No inferred outcomes
Contract tests pass


T3.3 Web research MCP server

Implement fetch/search tool for public web
Tag output as web context
Preserve URLs and timestamps
Done when:

Provenance always visible
Web sources never mis‑labeled as peer‑reviewed


T3.4 M365 mail MCP server (draft‑only)

Implement draft creation tool only
No send capability
Done when:

Drafts are reviewable
No message can be sent


T3.5 Memory MCP server (optional)

Implement save / retrieve / delete
Require explicit user intent
Done when:

User can inspect and delete all memory


Phase 4 — Orchestration Logic
T4.1 Tool selection rules

Implement rules from Spec 10.2
Enforce “no answer from memory” rule
Done when: Tool selection is deterministic and explainable.


T4.2 Tool ordering

Enforce default order: PubMed → Trials → Web
Require explicit justification for deviation
Done when: Order violations are visible in output.


T4.3 Clarification logic

Ask clarifying questions only when scope ambiguity affects evidence
Done when: Agent never over‑queries unnecessarily.


T4.4 Synthesis engine

Generate response using Spec 11 structure
Attach citations per claim
Include explicit uncertainty section
Done when: End‑to‑end answer meets Spec Sections 10 and 11.


Phase 5 — Frontend
T5.1 Conversation UI

Display user/agent turns
Display citations inline
Done when: Research output is readable and scannable.


T5.2 Tool trace UI

Display tool calls with timestamps and status
Done when: User can inspect how an answer was produced.


T5.3 Memory inspector

List saved items
Allow edit/delete
Done when: Memory is fully user‑controlled.


Phase 6 — Trust, Audit & Observability
T6.1 Audit persistence

Persist full interaction records
Support replay
Done when: Any response can be reconstructed.


T6.2 Observability

Add structured logs
Add basic metrics (latency, errors)
Done when: Failures are diagnosable.


Phase 7 — Testing
T7.1 MCP contract tests

Validate inputs/outputs
Validate failure behavior
Done when: Each MCP server has passing contract tests.


T7.2 End‑to‑end tests

Happy path
Conflicting evidence
Tool failure
Done when: Agent behaves correctly under stress.


Phase 8 — MVP Release
T8.1 MVP gate review

Verify MVP scope only
Verify no disallowed features
Done when: MVP meets Plan Section 10 exactly.


Phase 9 — Post‑MVP

Group 1 — Stability (unblocks all other work)

T9.1 Robust error handling & graceful shutdown

Add process-level uncaughtException and unhandledRejection handlers in api-server.ts
Add SIGTERM/SIGINT handlers for graceful shutdown
Prevent silent crashes observed during MVP testing
Done when: Server handles unexpected errors without silently dying.


T9.2 Startup .env validation

On server start, verify all required Azure OpenAI env vars are present and non-placeholder
Log a clear error message and exit(1) if misconfigured
Done when: Misconfiguration is caught at startup, not silently at first query.


Group 2 — Richer Research Output (parallel-safe, depends on Group 1)

T9.3 PubMed abstracts via efetch

PubMed esummary returns empty abstracts; add efetch call to retrieve full abstracts
Update pubmed-mcp search-tool.ts and contract tests
Done when: LLM synthesizer receives full abstract text for each result.


T9.4 Wire ClinicalTrials.gov into LLM orchestration path

LLM query parser selects clinicaltrials-search but orchestrator only passes query/maxResults
Map parsed fields (condition, intervention, status, phase) to CT tool inputs
Update E2E tests to cover the CT path
Done when: CT results are returned and included in LLM synthesis.


T9.5 Wire web-research tool into LLM orchestration path

Web tool expects url input, not a generic query; route it correctly in the LLM orchestrator path
Done when: Web sources are retrieved and cited when LLM selects the web tool.


Group 3 — UX Improvements (depends on Group 2)

T9.6 Multi-turn conversation history

Store turn history in frontend and send prior turns with each request
Update orchestrator API to accept optional history array
Pass history to LLM query parser and synthesizer so follow-up questions have context
Done when: "What about women?" correctly inherits the prior topic without re-stating it.


T9.7 Streaming LLM responses

Use Azure OpenAI streaming API (stream: true) to begin returning tokens immediately
Add SSE endpoint in api-server.ts
Update frontend to render tokens progressively
Done when: User sees visible progress during the 3–5s synthesis step.


Group 4 — GitHub Readiness

T9.8 GitHub Actions CI workflow

Add .github/workflows/ci.yml triggered on push and pull_request
Steps: npm install, npm test across all workspaces
Add passing CI badge to README
Done when: Every push runs the full 88-test suite automatically.



Rule of execution:
If a task makes the system less auditable, less explainable, or less traceable — it is wrong, even if it “works.”


