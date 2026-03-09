import { config as dotenvConfig } from "dotenv";
import { join } from "path";
// Load .env from the orchestrator package root, overriding any OS-level env vars
dotenvConfig({ path: join(__dirname, "../.env"), override: true });

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { Orchestrator } from "./orchestrator";
import { MCPClient } from "./mcp-client";
import { AuditRecorder } from "./audit-recorder";
import { FileAuditStorage } from "./file-audit-storage";
import { logger } from "./logger";
import { MetricsCollector } from "./metrics";
import { ClarificationNeeded } from "./types";
import { PubMedSearchTool } from "@research-agent/pubmed-mcp";
import { ClinicalTrialsSearchTool } from "@research-agent/clinicaltrials-mcp";
import { WebFetchTool } from "@research-agent/web-mcp";
import { DraftMailTool } from "@research-agent/m365-mail-mcp";
import { createMemoryTools } from "@research-agent/memory-mcp";
import type { Citation } from "@research-agent/memory-mcp";
import { createLLMClient } from "./llm-client";
import { parseQuery } from "./llm-query-parser";
import { SYSTEM_PROMPT, buildSynthesisUserMessage } from "./llm-synthesizer";

// --- Audit persistence (T6.1) ---
const auditFile = process.env.AUDIT_FILE ?? join(process.cwd(), "data", "audit.jsonl");
const auditStorage = new FileAuditStorage(auditFile);
const auditRecorder = new AuditRecorder(auditStorage);

// --- Metrics (T6.2) ---
const metrics = new MetricsCollector();

// --- LLM client (optional — falls back to keyword path when not configured) ---
const llmClient = createLLMClient();
if (llmClient) {
  logger.info("llm_enabled", { deployment: process.env.AZURE_OPENAI_DEPLOYMENT, endpoint: process.env.AZURE_OPENAI_ENDPOINT });
} else {
  logger.info("llm_disabled", { reason: "AZURE_OPENAI_* env vars not configured — using keyword fallback" });
}

const mcpClient = new MCPClient();
mcpClient.registerTool(new PubMedSearchTool());
mcpClient.registerTool(new ClinicalTrialsSearchTool());
mcpClient.registerTool(new WebFetchTool());

const orchestrator = new Orchestrator(mcpClient, auditRecorder, llmClient);

const { saveTool, retrieveTool, deleteTool } = createMemoryTools();
const draftTool = new DraftMailTool();

// --- Express app ---
const app = express();

app.use(express.json());
app.use(
  cors({
    origin: "http://localhost:5173",
  })
);

// Request logging + metrics middleware (T6.2)
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on("finish", () => {
    const latencyMs = Date.now() - start;
    const success = res.statusCode < 400;
    const endpoint = `${req.method} ${req.path}`;
    metrics.recordRequest(endpoint, success, latencyMs);
    logger.info("http_request", {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      latencyMs,
    });
  });
  next();
});

// POST /api/research
app.post("/api/research", async (req: Request, res: Response, next: NextFunction) => {
  const { question, context, history } = req.body as {
    question?: string;
    context?: string;
    history?: import("./types").ConversationTurn[];
  };

  if (!question || typeof question !== "string" || question.trim() === "") {
    res.status(400).json({ error: "question is required" });
    return;
  }

  logger.info("research_request", { question });

  try {
    const result = await orchestrator.processRequest({ question, context, history });

    if ((result as ClarificationNeeded).type === "clarification") {
      const clarification = result as ClarificationNeeded;
      logger.info("clarification_returned", { reason: clarification.reason });
      res.status(200).json({
        type: "clarification",
        reason: clarification.reason,
        suggestion: clarification.suggestion,
      });
      return;
    }

    const ids = await orchestrator.listInteractions();
    const interactionId = ids[ids.length - 1];

    // Record tool-level metrics from the audit record
    const audit = await orchestrator.getInteractionAudit(interactionId);
    if (audit) {
      for (const call of audit.toolCalls) {
        metrics.recordToolCall(call.toolName, call.success, call.durationMs);
      }
      logger.info("research_complete", {
        interactionId,
        toolsInvoked: audit.toolCalls.map((c) => c.toolName),
        durationMs: audit.durationMs,
      });
    }

    res.status(200).json({ type: "response", interactionId, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("research_failed", { question, error: message });
    next(error);
  }
});

// POST /api/research/stream  — SSE streaming endpoint (T9.7)
app.post("/api/research/stream", async (req: Request, res: Response) => {
  const { question, context, history } = req.body as {
    question?: string;
    context?: string;
    history?: import("./types").ConversationTurn[];
  };

  if (!question || typeof question !== "string" || question.trim() === "") {
    res.status(400).json({ error: "question is required" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  function send(event: string, data: unknown): void {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  logger.info("research_stream_request", { question });

  try {
    if (!llmClient) {
      // Non-LLM path: no token streaming, but emit status + complete via SSE
      send("status", { phase: "querying", message: "Querying evidence sources…" });
      const result = await orchestrator.processRequest({ question, context, history });

      if ((result as ClarificationNeeded).type === "clarification") {
        send("complete", result);
        res.end();
        return;
      }

      const ids = await orchestrator.listInteractions();
      const interactionId = ids[ids.length - 1];
      send("complete", { type: "response", interactionId, ...result });
      res.end();
      return;
    }

    // LLM path with streaming synthesis
    send("status", { phase: "parsing", message: "Analyzing research question…" });
    const parsed = await parseQuery(question, llmClient, history);

    if (parsed.clarificationNeeded) {
      send("complete", {
        type: "clarification",
        reason: "Query requires clarification before evidence retrieval.",
        suggestion: parsed.clarificationQuestion ?? "Please provide more detail.",
      });
      res.end();
      return;
    }

    const toolResults: Array<{ toolName: string; result: import("./mcp-types").ToolInvocationResult }> = [];

    auditRecorder.startInteraction({ question, context, history });

    for (const toolName of parsed.toolsNeeded) {
      let inputs: Record<string, unknown>;

      if (toolName === "clinicaltrials-search") {
        inputs = { query: parsed.searchTerms.slice(0, 200), maxResults: 10 };
      } else if (toolName === "web-fetch") {
        logger.info("tool_skipped", { toolName, reason: "web-fetch requires a URL, not a search query" });
        continue;
      } else {
        inputs = { query: parsed.searchTerms, maxResults: 10 };
        if (parsed.dateFilter) inputs.dateFilter = parsed.dateFilter;
      }

      send("status", { phase: "querying", tool: toolName, message: `Querying ${toolName}…` });
      const result = await mcpClient.invokeTool(toolName, inputs);
      auditRecorder.recordToolCall(result.metadata);

      if (!result.success) {
        logger.warn("tool_failed_continuing", { toolName, error: result.error });
        continue;
      }

      toolResults.push({ toolName, result });
    }

    if (toolResults.length === 0) {
      send("error", { message: "All tools failed — no evidence data available for synthesis." });
      res.end();
      return;
    }

    send("status", { phase: "synthesizing", message: "Synthesizing evidence…" });

    const userMessage = buildSynthesisUserMessage(question, parsed, toolResults, history);

    let fullText = "";
    for await (const chunk of llmClient.chatStream(SYSTEM_PROMPT, userMessage)) {
      fullText += chunk;
      send("token", { chunk });
    }

    // Parse the complete JSON response
    const jsonText = fullText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    let synthesisResult: import("./types").ResearchResponse;
    try {
      synthesisResult = JSON.parse(jsonText) as import("./types").ResearchResponse;
    } catch {
      send("error", { message: `Synthesis returned invalid JSON: ${fullText.slice(0, 200)}` });
      res.end();
      return;
    }

    const auditRecord = await auditRecorder.completeInteraction(synthesisResult);
    metrics.recordRequest("POST /api/research/stream", true, 0);
    for (const call of auditRecord.toolCalls) {
      metrics.recordToolCall(call.toolName, call.success, call.durationMs);
    }
    logger.info("research_stream_complete", {
      interactionId: auditRecord.interactionId,
      toolsInvoked: auditRecord.toolCalls.map((c) => c.toolName),
    });

    send("complete", { type: "response", interactionId: auditRecord.interactionId, ...synthesisResult });
    res.end();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("research_stream_failed", { question, error: message });
    send("error", { message });
    res.end();
  }
});

// GET /api/audit
app.get("/api/audit", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const ids = await orchestrator.listInteractions();
    res.json({ ids });
  } catch (error) {
    next(error);
  }
});

// GET /api/audit/:interactionId
app.get("/api/audit/:interactionId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const record = await orchestrator.getInteractionAudit(req.params.interactionId);
    if (!record) {
      res.status(404).json({ error: `Interaction '${req.params.interactionId}' not found` });
      return;
    }
    res.json(record);
  } catch (error) {
    next(error);
  }
});

// GET /api/memory
app.get("/api/memory", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await retrieveTool.execute({});
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /api/memory
app.post("/api/memory", async (req: Request, res: Response, next: NextFunction) => {
  const { title, content, citations } = req.body as {
    title?: string;
    content?: string;
    citations?: Citation[];
  };

  if (!title || !content) {
    res.status(400).json({ error: "title and content are required" });
    return;
  }

  try {
    const result = await saveTool.execute({ title, content, citations });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/memory/:id
app.delete("/api/memory/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await deleteTool.execute({ id: req.params.id });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /api/mail/draft
app.post("/api/mail/draft", async (req: Request, res: Response, next: NextFunction) => {
  const { to, subject, body, citations } = req.body as {
    to?: string;
    subject?: string;
    body?: string;
    citations?: Citation[];
  };

  if (!to || !subject || !body) {
    res.status(400).json({ error: "to, subject, and body are required" });
    return;
  }

  try {
    const result = await draftTool.execute({ to, subject, body, citations });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/metrics  (T6.2)
app.get("/api/metrics", (_req: Request, res: Response) => {
  res.json(metrics.snapshot());
});

// Error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : "Internal server error";
  logger.error("unhandled_error", { error: message });
  res.status(500).json({ error: message });
});

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

// --- T9.2: Startup environment validation ---
function validateEnv(): void {
  const required = [
    "AZURE_OPENAI_ENDPOINT",
    "AZURE_OPENAI_KEY",
    "AZURE_OPENAI_DEPLOYMENT",
    "AZURE_OPENAI_API_VERSION",
  ];
  const placeholders = ["<your-resource>", "<your-api-key>", "your-", "placeholder"];

  if (llmClient) {
    const missing = required.filter((k) => !process.env[k]);
    const placeholder = required.filter((k) => {
      const val = process.env[k] ?? "";
      return placeholders.some((p) => val.includes(p));
    });

    if (missing.length > 0) {
      logger.error("env_validation_failed", { missing, hint: "Copy apps/orchestrator/.env.example to .env and fill in values" });
      process.exit(1);
    }
    if (placeholder.length > 0) {
      logger.error("env_validation_failed", { placeholder, hint: "Replace placeholder values in .env with real Azure credentials" });
      process.exit(1);
    }
  }
}

validateEnv();

// --- T9.1: Graceful shutdown ---
function shutdown(signal: string, server: ReturnType<typeof app.listen>): void {
  logger.info("shutdown_initiated", { signal });
  server.close(() => {
    logger.info("shutdown_complete");
    process.exit(0);
  });
  // Force-exit if connections don't drain within 10s
  setTimeout(() => {
    logger.error("shutdown_timeout", { hint: "Forcing exit after 10s" });
    process.exit(1);
  }, 10_000).unref();
}

const server = app.listen(PORT, () => {
  logger.info("server_started", {
    port: PORT,
    auditFile,
    auditRecordsLoaded: auditStorage.size(),
  });
  process.stdout.write(`Research Agent API server running on http://localhost:${PORT}\n`);
});

process.on("SIGTERM", () => shutdown("SIGTERM", server));
process.on("SIGINT", () => shutdown("SIGINT", server));

process.on("uncaughtException", (err) => {
  logger.error("uncaught_exception", { error: err.message, stack: err.stack });
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  logger.error("unhandled_rejection", { error: message });
  process.exit(1);
});
