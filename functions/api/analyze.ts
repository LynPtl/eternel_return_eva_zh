import { analyzePlayers } from "../../src/lib/server/analyze";
import type { ServerEnv } from "../../src/lib/server/dakgg";

type PagesContext = EventContext<ServerEnv, string, Record<string, unknown>>;

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders() });
}

export async function onRequestPost(context: PagesContext): Promise<Response> {
  try {
    const body = await context.request.json();
    const result = await analyzePlayers(fetch, context.env, body);
    return json(result, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "分析失败";
    const status = message.includes("请输入") ? 400 : 502;
    return json({ error: message }, status);
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
