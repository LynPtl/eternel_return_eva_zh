import type { Fetcher, ServerEnv } from "./dakgg";

interface ChatMessage {
  role: "system" | "user";
  content: string;
}

export interface DeepSeekResult {
  aiReview: string;
  warning?: string;
}

export function buildDeepSeekMessages(payload: unknown): ChatMessage[] {
  return [
    {
      role: "system",
      content:
        "你是永恒轮回中文复盘助手。请用中文分析 1-3 名玩家的共同对局表现，优先评价多人配合、角色分工、承压和输出分布。必须提到样本数量。不要评价钴协议，因为钴协议已被排除。共同对局样本少时不要过度下结论。建议要具体并且绑定指标。"
    },
    {
      role: "user",
      content: JSON.stringify(payload)
    }
  ];
}

export async function requestDeepSeekReview(
  fetcher: Fetcher,
  env: ServerEnv,
  payload: unknown
): Promise<DeepSeekResult> {
  if (!env.DEEPSEEK_API_KEY) {
    return { aiReview: "", warning: "未配置 DeepSeek API Key，已仅返回规则指标。" };
  }

  const baseUrl = env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";
  const response = await fetcher(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: buildDeepSeekMessages(payload),
      temperature: 0.4
    })
  });

  if (!response.ok) {
    return { aiReview: "", warning: `DeepSeek 暂不可用，已仅返回规则指标。状态码：${response.status}` };
  }

  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return { aiReview: data.choices?.[0]?.message?.content?.trim() ?? "" };
}
