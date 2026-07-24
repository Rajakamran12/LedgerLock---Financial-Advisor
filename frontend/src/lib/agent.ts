/**
 * Server-only client for calling the Python agent microservice. The agent
 * is never reachable from the browser — only this module (used from API
 * routes) knows AGENT_URL and AGENT_API_KEY.
 */

const AGENT_URL = process.env.AGENT_URL ?? "http://localhost:8000";
const AGENT_API_KEY = process.env.AGENT_API_KEY ?? "";

export class AgentWarmingUpError extends Error {
  constructor() {
    super("The AI agent is warming up. Please try again in a few seconds.");
    this.name = "AgentWarmingUpError";
  }
}

export class AgentError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "AgentError";
    this.status = status;
  }
}

async function callAgent<T>(
  path: string,
  body: unknown,
  { retryOnColdStart = true }: { retryOnColdStart?: boolean } = {}
): Promise<T> {
  const attempt = async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);
    try {
      return await fetch(`${AGENT_URL}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": AGENT_API_KEY,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  };

  let response: Response;
  try {
    response = await attempt();
  } catch (err) {
    if (!retryOnColdStart) throw err;
    // Free-tier Render instances sleep after 15 minutes of inactivity and
    // take up to ~30s to wake. Retry once after a short delay.
    await new Promise((resolve) => setTimeout(resolve, 4000));
    try {
      response = await attempt();
    } catch {
      throw new AgentWarmingUpError();
    }
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new AgentError(text || `Agent responded with ${response.status}`, response.status);
  }

  return (await response.json()) as T;
}

export interface EmbedResult {
  embedding: number[];
}

export async function embedText(text: string): Promise<number[]> {
  const result = await callAgent<EmbedResult>("/embed", { text });
  return result.embedding;
}

export interface AgentChunk {
  chunkId: string;
  pageNumber: number;
  content: string;
}

export type AgentQueryStatus =
  | "answered"
  | "refused_advice_request"
  | "refused_out_of_scope"
  | "insufficient_context"
  | "error";

export interface AgentCitation {
  chunkId: string;
  pageNumber: number;
  quote: string;
}

export interface AgentQueryResult {
  status: AgentQueryStatus;
  answer: string | null;
  citations: AgentCitation[];
  confidence: "high" | "medium" | "low" | null;
}

export async function queryAgent(
  question: string,
  chunks: AgentChunk[]
): Promise<AgentQueryResult> {
  return callAgent<AgentQueryResult>("/query", { question, chunks });
}
