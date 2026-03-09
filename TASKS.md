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

## 2. Turso Persistent Database for Research Memory

Replace the in-memory Map in `servers/memory-mcp/src/` with a [Turso](https://turso.tech) (cloud SQLite) backed store.

**Prerequisites:** Sign up at [turso.tech](https://turso.tech) (free), create a database, grab the URL + auth token.

**Steps:**
1. Install `@libsql/client` in `servers/memory-mcp/`
2. Update save/retrieve/delete/list to use a SQLite table instead of the in-memory Map
3. Schema: `id TEXT PK, title TEXT, content TEXT, citations JSON, savedAt TEXT`
4. Add `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` to `.env.example` and `.env`
5. Update `api-server.ts` startup env validation to check for Turso vars
6. Update memory contract tests to mock `@libsql/client`
7. Test locally, then verify memory persists across restarts after `azd up`

---

## Order of play

1. UI example prompts (quick win)
2. Turso persistent memory
3. `azd up`
