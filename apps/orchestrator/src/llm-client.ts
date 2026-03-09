/**
 * LLM Client — Azure OpenAI wrapper
 *
 * Uses DefaultAzureCredential for token-based authentication — no API key required.
 * Locally: picks up `az login` or `azd auth login` credentials automatically.
 * In Azure: uses the Container App's Managed Identity.
 *
 * Returns null when AZURE_OPENAI_ENDPOINT / DEPLOYMENT are not set so the
 * orchestrator can fall back to the keyword-based path without crashing.
 */

import { AzureOpenAI } from "openai";
import { DefaultAzureCredential, getBearerTokenProvider } from "@azure/identity";

export interface LLMClient {
  chat(systemPrompt: string, userMessage: string): Promise<string>;
  chatStream(systemPrompt: string, userMessage: string): AsyncIterable<string>;
}

class AzureLLMClient implements LLMClient {
  private client: AzureOpenAI;
  private deployment: string;

  constructor(endpoint: string, deployment: string, apiVersion: string) {
    // When using azureADTokenProvider, the OpenAI SDK throws if AZURE_OPENAI_API_KEY
    // or OPENAI_API_KEY are present in the environment (even as system env vars not
    // in .env). Remove them so the SDK uses only the token provider.
    delete process.env.AZURE_OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    const credential = new DefaultAzureCredential();
    const azureADTokenProvider = getBearerTokenProvider(
      credential,
      "https://cognitiveservices.azure.com/.default"
    );
    this.client = new AzureOpenAI({ endpoint, azureADTokenProvider, apiVersion });
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
 * Returns a configured LLMClient using DefaultAzureCredential, or null if
 * AZURE_OPENAI_ENDPOINT / DEPLOYMENT are not configured (triggers keyword fallback).
 * AZURE_OPENAI_KEY is no longer required — authentication uses az login / Managed Identity.
 */
export function createLLMClient(): LLMClient | null {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION ?? "2024-10-01-preview";

  if (!endpoint || endpoint.includes("your-resource") ||
      !deployment || deployment.includes("your-")) {
    return null;
  }

  return new AzureLLMClient(endpoint, deployment, apiVersion);
}
