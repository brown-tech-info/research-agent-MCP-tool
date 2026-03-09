# Copilot Instructions — Pharmaceutical Research Assistant Agent

## Overview

This is a **research assistant agent** for pharmaceutical researchers, not a medical system. The agent:
- Discovers biomedical literature (PubMed) and clinical trials (ClinicalTrials.gov)
- Synthesizes evidence with explicit citations and uncertainty
- Operates via Model Context Protocol (MCP) for all external data access
- Never fabricates facts, never provides medical advice, never acts autonomously

## Governing Documents (Read First)

All work must comply with these documents **in precedence order**:

1. **`constitution.md`** — Non-negotiable principles (scientific integrity, safety boundaries, tool discipline)
2. **`spec.md`** — Complete system specification (capabilities, MCP contracts, orchestration rules, output formats)
3. **`plan.md`** — Implementation plan and task breakdown

**Critical rules from constitution:**
- Never fabricate citations, PMIDs, NCT IDs, or study results
- Explicit uncertainty over confident guessing
- All external data via MCP tools only
- User identity for all actions (no service accounts)
- Explainable reasoning at all times

**If you're unsure whether something is allowed, check the constitution first.**

## Architecture (High-Level)

```
User → Frontend (conversational UI)
       ↓
    Orchestrator (tool selection, synthesis, audit)
       ↓
    MCP Servers (PubMed, ClinicalTrials.gov, Web, M365, Memory)
```

**Key constraints:**
- Orchestrator acts as a **tool orchestrator**, not a free-form chatbot
- Default tool order: PubMed → ClinicalTrials.gov → Web Research (unless user specifies otherwise)
- Every interaction generates an **audit trail** (tool calls, inputs, outputs, timestamps)
- All responses follow the **structured format** in spec.md Section 11

## Directory Structure

```
/src/orchestrator/     # Core agent logic
/src/mcp-servers/      # MCP server implementations
    /pubmed/
    /clinicaltrials/
    /web-research/
    /m365-mail/
    /memory/
/src/frontend/         # Conversation UI
/tests/                # Contract tests + E2E tests
/docs/                 # Developer documentation
```

## Development Workflow

### Before Writing Code
1. Read the **constitution** and relevant sections of the **spec**
2. Verify your task is explicitly allowed by the spec
3. If adding new behavior, update the spec first (spec-driven development)

### When Implementing
- **Fail loudly, not silently** — no graceful degradation that hides errors
- **Preserve citations** — every claim must trace to a source
- **Conservative language** — avoid "proves", "demonstrates conclusively", "breakthrough"
- **Explicit uncertainty** — use "Evidence is limited", "Results are mixed", "No data identified"

### Testing
- **MCP servers**: Contract tests for inputs/outputs and failure behavior
- **Orchestrator**: E2E tests for happy path, conflicting evidence, and tool failures
- Run existing tests before committing (no new test infrastructure unless needed)

## Output Requirements (Spec Section 11)

All substantive responses must follow this structure:

1. **Summary** — Concise overview
2. **Evidence Overview** — Sources with PMIDs/NCT IDs/URLs
3. **Synthesis & Interpretation** — Analysis with citations
4. **Confidence & Gaps** — Explicit uncertainty and missing data
5. **References** — Full source list

**Citation rules:**
- Attach citations immediately after claims (not grouped at the end)
- Include PMIDs for publications, NCT IDs for trials, URLs for web sources
- No claim without a citation

## MCP Tool Contracts (Spec Section 9)

### PubMed MCP Tool
- Returns: PMID, title, authors, journal, year, abstract, URL
- Never returns fabricated PMIDs
- Explicitly reports empty results

### ClinicalTrials.gov MCP Tool  
- Returns: NCT ID, phase, status, sponsor, eligibility, endpoints, URL
- Never infers unpublished outcomes
- Distinguishes ongoing/completed/terminated trials

### Web Research MCP Tool
- Returns: URL, content, publication date
- Preserves provenance
- Never misrepresents web sources as peer-reviewed

### M365 Email MCP Tool (Draft-Only)
- Creates reviewable drafts only
- No send capability
- Requires explicit user approval

### Memory MCP Tool (Optional)
- User-controlled save/retrieve/delete
- No silent persistence
- Citation integrity maintained

## Orchestration Rules (Spec Section 10)

- **Tool selection**: Minimum set required to answer the question
- **Clarification**: Ask only when ambiguity affects evidence retrieval
- **Synthesis**: Separate facts from interpretation, preserve disagreement
- **Failure handling**: Halt and inform user, never proceed "as if" data were available

## What to Avoid

- **Do not** answer scientific questions from memory alone (use tools)
- **Do not** smooth over uncertainty or conflicting evidence
- **Do not** use marketing language or present false consensus
- **Do not** reduce auditability for speed or convenience
- **Do not** assume user intent — clarify when ambiguous

## Trust & Auditability (Spec Section 12)

Every interaction must support independent review:
- Reconstruct the question, tool calls, and raw outputs
- Trace every claim to its source
- Explain tool selection and reasoning

**Non-reproducible outputs are considered non-compliant.**

## Common Pitfalls

1. **Hallucinating citations** — Always invoke MCP tools, never synthesize PMIDs/NCT IDs
2. **Hiding tool failures** — Surface failures explicitly, don't substitute with guesses
3. **Over-confident language** — Match language confidence to evidence strength
4. **Grouped citations** — Attach citations per claim, not at section end
5. **Ignoring spec boundaries** — If it's not in the spec, don't implement it

## Development Phase Status

Currently in **early implementation** phase. Focus on:
- Repository structure (plan.md Phase 1)
- Orchestrator skeleton (plan.md Phase 2)
- MCP server implementations (plan.md Phase 3)

**MVP scope** defined in plan.md Section 10. No Phase 2 features until MVP is complete.

## Quick Reference

| Task | Check First |
|------|------------|
| Adding new capability | spec.md Section 8 |
| MCP tool behavior | spec.md Section 9 |
| Tool selection logic | spec.md Section 10 |
| Response formatting | spec.md Section 11 |
| Audit requirements | spec.md Section 12 |
| Prohibited actions | constitution.md Section 9 |

---

**Remember**: Accuracy before speed. Transparency before autonomy. Assistance before authority.
