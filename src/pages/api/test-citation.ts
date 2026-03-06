import type { NextApiRequest, NextApiResponse } from "next";
import { HV_ONLINE_MODELS, HV_WEB_SEARCH_OPTIONS } from "@/lib/openrouter";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  const query =
    (req.query.q as string) || "what is the best AI image generator";
  const model = HV_ONLINE_MODELS.GEMINI_FAST;

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey)
    return res.status(500).json({ error: "OPENROUTER_API_KEY not set" });

  const body = {
    model,
    messages: [
      {
        role: "system",
        content:
          "You are a helpful assistant that provides thorough, well-researched recommendations. Cite as many relevant sources as possible. Be comprehensive.",
      },
      { role: "user", content: query },
    ],
    temperature: 0.3,
    max_tokens: 4096,
    web_search_options: HV_WEB_SEARCH_OPTIONS,
    plugins: [{ id: "web", max_results: 20 }],
  };

  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const raw = await response.json();

  res.status(200).json({ request_body: body, raw_response: raw });
}
