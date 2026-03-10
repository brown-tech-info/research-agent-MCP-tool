# Upcoming Tasks

## 1. UI Example Prompts

Add 4 clickable example prompts to the frontend that appear when the chat is empty. Clicking a prompt populates the input field. Hide them once the conversation starts.

**Files to change:** `apps/frontend/src/App.tsx` or `apps/frontend/src/components/ConversationPanel.tsx`

**The 4 prompts:**
1. *(Web search)* "What are the latest FDA regulatory updates on GLP-1 receptor agonists for obesity in 2024?"
2. *(ClinicalTrials)* "Are there any active Phase 3 clinical trials recruiting patients for Alzheimer's disease immunotherapy?"
3. *(PubMed)* "What does the peer-reviewed literature say about the mechanism of action of semaglutide in reducing cardiovascular risk?"
4. *(PubMed + ClinicalTrials)* "What is the clinical evidence for CAR-T cell therapy in multiple myeloma, and are there ongoing trials?"

---

## ~~2. Turso Persistent Database for Research Memory~~ ✅ Done (Cosmos DB)

Replaced the in-memory Map in `servers/memory-mcp/src/` with **Azure Cosmos DB** (serverless, managed identity auth — no connection string needed).

- `IMemoryStore` interface + `InMemoryStore` fallback (used when `COSMOS_ENDPOINT` is not set)
- `CosmosMemoryStore` uses `DefaultAzureCredential` — same `az login` session as Azure OpenAI
- Database `research-agent`, container `memory-entries`, partition key `/id`
- `createMemoryTools()` is async; picks store based on `COSMOS_ENDPOINT` env var
- Infra: `infra/modules/cosmos.bicep` + `cosmos-role-assignment.bicep` — provisioned by `azd up`
- Local account: `research-agent-cosmos-local` (Sweden Central, `research-agent-tool-ghcli` RG)

---

## Order of play

1. UI example prompts (quick win)
2. Turso persistent memory
3. `azd up`
