/**
 * LLM Client — Azure OpenAI wrapper
 *
 * Reads connection details from environment variables (loaded via dotenv).
 * Returns null when not configured so the orchestrator can fall back to
 * the keyword-based path without crashing.
 */

import { AzureOpenAI } from "openai";

export interface LLMClient {
  chat(systemPrompt: string, userMessage: string): Promise<string>;
  chatStream(systemPrompt: string, userMessage: string): AsyncIterable<string>;
}

class AzureLLMClient implements LLMClient {
  private client: AzureOpenAI;
  private deployment: string;

  constructor(endpoint: string, apiKey: string, deployment: string) {
    this.client = new AzureOpenAI({ endpoint, apiKey, apiVersion: "2024-10-01-preview" });
    this.deployment = deployment;
  }

  async chat(systemPrompt: string, userMessage: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.deployment,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("LLM returned empty response");
    return content;
  }

  async *chatStream(systemPrompt: string, userMessage: string): AsyncIterable<string> {
    const stream = await this.client.chat.completions.create({
      model: this.deployment,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) yield content;
    }
  }
}
/**
 * Returns a configured LLMClient, or null if env vars are not set.
 * The orchestrator uses null to trigger the keyword-based fallback.
 */
export function createLLMClient(): LLMClient | null {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;

  if (!endpoint || !apiKey || !deployment ||
      endpoint.includes("your-resource") || apiKey === "your-api-key-here") {
    return null;
  }

  return new AzureLLMClient(endpoint, apiKey, deployment);
}
