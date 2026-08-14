import type { Fetcher, ServerEnv } from "./dakgg";

interface ChatMessage {
  role: "system" | "user";
  content: string;
}

interface DeepSeekAnalysisPayload {
  season?: {
    key?: string;
    name?: string;
  };
  players?: Array<{
    nickname?: string;
    sampleCount?: number;
    excludedCobaltCount?: number;
    exhaustedPages?: boolean;
    summary?: Record<string, number>;
    characters?: Array<{ characterNum?: number; name?: string; games?: number }>;
    modeSplit?: Record<string, number>;
  }>;
  shared?: {
    matchCount?: number;
    confidence?: "high" | "low";
    teamMetricsReliable?: boolean;
    avgRank?: number | null;
    wins?: number | null;
    avgTeamKill?: number | null;
  };
  comparison?: {
    damageLeader?: string | null;
    pressureBearer?: string | null;
    visionLeader?: string | null;
    roleNotes?: string[];
  };
}

export interface DeepSeekResult {
  aiReview: string;
  warning?: string;
}

export function buildDeepSeekMessages(payload: unknown): ChatMessage[] {
  const safePayload = projectDeepSeekPayload(payload);

  return [
    {
      role: "system",
      content:
        "你是永恒轮回中文复盘助手。请用中文分析 1-3 名玩家的共同对局表现，优先评价多人配合、角色分工、承压和输出分布。必须提到样本数量。不要评价钴协议，因为钴协议已被排除。共同对局样本少时不要过度下结论。建议要具体并且绑定指标。"
    },
    {
      role: "user",
      content: JSON.stringify(safePayload)
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
  let response: Response;
  try {
    response = await fetcher(`${baseUrl}/chat/completions`, {
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
  } catch {
    return { aiReview: "", warning: "DeepSeek 请求失败，已仅返回规则指标。" };
  }

  if (!response.ok) {
    return { aiReview: "", warning: `DeepSeek 暂不可用，已仅返回规则指标。状态码：${response.status}` };
  }

  let data: { choices?: Array<{ message?: { content?: string } }> };
  try {
    data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  } catch {
    return { aiReview: "", warning: "DeepSeek 返回内容解析失败，已仅返回规则指标。" };
  }

  const content = data.choices?.[0]?.message?.content;
  const aiReview = typeof content === "string" ? content.trim() : "";
  if (!aiReview) {
    return { aiReview: "", warning: "DeepSeek 返回内容为空或格式异常，已仅返回规则指标。" };
  }

  return { aiReview };
}

const playerSummaryKeys = [
  "avgRank",
  "wins",
  "top3",
  "kills",
  "assists",
  "deaths",
  "kda",
  "avgDamageToPlayer",
  "avgDamageFromPlayer",
  "avgDamageToMonster",
  "avgMonsterKill",
  "avgVisionContribution",
  "avgCcTime",
  "avgGainVFCredit",
  "avgUseVFCredit"
] as const;

function projectDeepSeekPayload(payload: unknown): DeepSeekAnalysisPayload {
  const input = recordOrEmpty(payload);

  return {
    season: projectSeason(input.season),
    players: arrayOrEmpty(input.players).map(projectPlayer),
    shared: projectShared(input.shared),
    comparison: projectComparison(input.comparison)
  };
}

function projectSeason(value: unknown): DeepSeekAnalysisPayload["season"] {
  const season = recordOrEmpty(value);
  return {
    key: stringOrUndefined(season.key),
    name: stringOrUndefined(season.name)
  };
}

function projectPlayer(value: unknown): NonNullable<DeepSeekAnalysisPayload["players"]>[number] {
  const player = recordOrEmpty(value);
  return {
    nickname: stringOrUndefined(player.nickname),
    sampleCount: numberOrUndefined(player.sampleCount),
    excludedCobaltCount: numberOrUndefined(player.excludedCobaltCount),
    exhaustedPages: booleanOrUndefined(player.exhaustedPages),
    summary: projectNumberRecord(player.summary, playerSummaryKeys),
    characters: arrayOrEmpty(player.characters).map(projectCharacter),
    modeSplit: projectArbitraryNumberRecord(player.modeSplit)
  };
}

function projectCharacter(value: unknown): { characterNum?: number; name?: string; games?: number } {
  const character = recordOrEmpty(value);
  return {
    characterNum: numberOrUndefined(character.characterNum),
    name: stringOrUndefined(character.name),
    games: numberOrUndefined(character.games)
  };
}

function projectShared(value: unknown): DeepSeekAnalysisPayload["shared"] {
  const shared = recordOrEmpty(value);
  return {
    matchCount: numberOrUndefined(shared.matchCount),
    confidence: shared.confidence === "high" || shared.confidence === "low" ? shared.confidence : undefined,
    teamMetricsReliable: booleanOrUndefined(shared.teamMetricsReliable),
    avgRank: nullableNumber(shared.avgRank),
    wins: nullableNumber(shared.wins),
    avgTeamKill: nullableNumber(shared.avgTeamKill)
  };
}

function projectComparison(value: unknown): DeepSeekAnalysisPayload["comparison"] {
  const comparison = recordOrEmpty(value);
  return {
    damageLeader: nullableString(comparison.damageLeader),
    pressureBearer: nullableString(comparison.pressureBearer),
    visionLeader: nullableString(comparison.visionLeader),
    roleNotes: arrayOrEmpty(comparison.roleNotes).map(stringOrUndefined).filter((item): item is string => item !== undefined)
  };
}

function projectNumberRecord<K extends string>(value: unknown, keys: readonly K[]): Partial<Record<K, number>> {
  const input = recordOrEmpty(value);
  const output: Partial<Record<K, number>> = {};
  for (const key of keys) {
    const numberValue = numberOrUndefined(input[key]);
    if (numberValue !== undefined) output[key] = numberValue;
  }
  return output;
}

function projectArbitraryNumberRecord(value: unknown): Record<string, number> {
  const input = recordOrEmpty(value);
  const output: Record<string, number> = {};
  for (const [key, rawValue] of Object.entries(input)) {
    const numberValue = numberOrUndefined(rawValue);
    if (numberValue !== undefined) output[key] = numberValue;
  }
  return output;
}

function recordOrEmpty(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function arrayOrEmpty(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function nullableString(value: unknown): string | null | undefined {
  if (value === null) return null;
  return stringOrUndefined(value);
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function nullableNumber(value: unknown): number | null | undefined {
  if (value === null) return null;
  return numberOrUndefined(value);
}

function booleanOrUndefined(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}
