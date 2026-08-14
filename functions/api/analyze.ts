import { analyzePlayers } from "../../src/lib/server/analyze";
import type { ServerEnv } from "../../src/lib/server/dakgg";

type PagesContext = EventContext<ServerEnv, string, Record<string, unknown>>;

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders() });
}

export async function onRequestPost(context: PagesContext): Promise<Response> {
  try {
    const body = await parseJsonBody(context.request);
    const result = await analyzePlayers(fetch, context.env, body);
    return json(result, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "分析失败";
    const status = message.includes("请输入") || message.includes("请求体必须") ? 400 : 502;
    return json({ error: message }, status);
  }
}

async function parseJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new Error("请求体必须是有效 JSON。");
  }
}

function json(data: unknown, status: number): Response {
  return Response.json(data, { status, headers: corsHeaders() });
}

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}
