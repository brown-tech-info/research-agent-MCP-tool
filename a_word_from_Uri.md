# A Word from Uri

I want to tell you how this app came to be — because the *how* is as interesting as the *what*.

## It started with a conversation

I didn't open a code editor first. I opened **Microsoft 365 Copilot** and had a conversation about an idea: a research assistant for pharmaceutical researchers that would search PubMed, ClinicalTrials.gov, and the web — and do it in a way that was honest about uncertainty, transparent about its sources, and impossible to misuse as a medical advice tool.

I mentioned I wanted to try **spec-driven development** — the idea that before you write a single line of code, you write down *what the system must be* at a values level, *what it must do* at a specification level, and *how you plan to build it* at a task level.

M365 Copilot helped me think through all of that and produced three markdown files:

- **`constitution.md`** — the non-negotiable principles (scientific integrity, never fabricate citations, always show uncertainty, never give medical advice)
- **`spec.md`** — the complete system specification (MCP tool contracts, orchestration rules, response format, audit requirements)
- **`plan.md`** — the ordered task breakdown, phase by phase

I put those three files in a folder. That folder became this repository.

## Then I handed it to GitHub Copilot CLI

I opened that folder with **GitHub Copilot CLI** — a terminal-native AI coding assistant — and said something like: *"I'd like you to review these documents and help me build the app."*

And it did.

It read the constitution. It read the spec. It asked clarifying questions when something was ambiguous. It wrote code that referenced the spec sections it was implementing. When I asked for something that wasn't in the spec, it pushed back. It was, genuinely, a collaborator that understood the *intent* behind the system — not just the syntax.

## What we built, together

From that starting point, we built the whole thing:

- A **React frontend** with a conversational research UI, clickable example prompts, and a memory panel
- An **Express orchestrator** that routes questions to the right tools, synthesises evidence with citations, and retries gracefully when the LLM returns malformed JSON
- Five **MCP servers** — PubMed, ClinicalTrials.gov, web search (Tavily), M365 email drafting, and research memory
- **Azure Cosmos DB** persistence for saved research, using Managed Identity (no secrets)
- A full **Azure deployment** via `azd up` — Container Apps, Static Web Apps, Cosmos DB, Application Insights, all wired together with Bicep

We hit real bugs along the way. Docker build failures. Bicep compilation errors after a compiler upgrade. An Azure Static Web Apps tier limitation I hadn't anticipated. A cross-resource-group RBAC assignment that needed a manual step. Every one of them got diagnosed, fixed, and committed — with a clear message explaining *why* the fix was needed, not just *what* changed.

## What surprised me

I expected the AI to write code faster than me. It did. But what I didn't expect was how much the *governance documents* shaped the quality of everything that followed.

Because we had a constitution, the AI never drifted into building features we didn't want. Because we had a spec, every implementation decision had a reference point. Because we had a plan, we always knew what was next.

The three markdown files weren't overhead. They were the foundation.

## An invitation

If you're a developer — or a researcher, or a product person with a technical idea — I'd genuinely encourage you to try this approach:

1. **Have a conversation** with M365 Copilot (or any AI you trust) about your idea. Ask it to help you think through the values, the constraints, the boundaries. Write those down as a `constitution.md`.
2. **Turn that into a spec.** What does the system do? What does it explicitly *not* do? What are the contracts between components?
3. **Open a folder** with GitHub Copilot CLI and say: *"Here are my governing documents. Help me build this."*

You might be surprised how far you get — and how much you enjoy the process.

The app is fully open source. The governing documents are in the repo. The deployment guide is in the README. Everything you need to run your own instance is there.

If you build something with this approach, I'd love to hear about it.

— Uri

---

*Built with [GitHub Copilot CLI](https://githubnext.com/projects/copilot-cli), [Azure Developer CLI](https://aka.ms/azd), and a lot of iterative conversations.*
