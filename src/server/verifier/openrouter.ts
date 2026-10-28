// One OpenRouter call: a prompt, a strict JSON schema and the clip inline as base64.

const URL = "https://openrouter.ai/api/v1/chat/completions";
const TIMEOUT_MS = 90_000;

export type Usage = { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; cost?: number };
export type AskResult<T> = { data: T; usage: Usage | null; model: string; ms: number };

export class ModelError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

export function model(): string {
  return process.env.PRANK_MODEL ?? "google/gemini-3.8-flash";
}

async function once(body: string, key: string): Promise<Response> {
  return fetch(URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

export async function ask<T>(prompt: string, schema: object, video: Buffer, mime: string): Promise<AskResult<T>> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new ModelError("OPENROUTER_API_KEY is not set");
  const m = model();
  const body = JSON.stringify({
    model: m,
    temperature: 0,
    response_format: { type: "json_schema", json_schema: { name: "answer", strict: true, schema } },
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "video_url", video_url: { url: `data:${mime};base64,${video.toString("base64")}` } },
        ],
      },
    ],
  });

  const t0 = Date.now();
  let res = await once(body, key);
  if (res.status === 429 || res.status >= 500) {
    await new Promise((r) => setTimeout(r, 2000));
    res = await once(body, key);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ModelError(`OpenRouter ${res.status}: ${text.slice(0, 300)}`, res.status);
  }
  const json = (await res.json()) as {
    choices?: { message?: { content?: string | null } }[];
    usage?: Usage;
    error?: { message?: string };
  };
  if (json.error) throw new ModelError(`OpenRouter error: ${json.error.message ?? "unknown"}`);
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new ModelError("OpenRouter returned no content");
  let data: T;
  try {
    data = JSON.parse(content.replace(/^```(?:json)?\s*|\s*```$/g, "")) as T;
  } catch {
    throw new ModelError(`Model answer is not JSON: ${content.slice(0, 200)}`);
  }
  return { data, usage: json.usage ?? null, model: m, ms: Date.now() - t0 };
}
