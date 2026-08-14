import {
  comparePlayers,
  summarizePlayer,
  summarizeShared,
  type PlayerComparison,
  type PlayerSummary,
  type SharedSummary
} from "../er/metrics";
import { findSharedMatches } from "../er/shared";
import {
  fetchCharacters,
  fetchCurrentSeason,
  fetchPlayerSample,
  type Fetcher,
  type SeasonInfo,
  type ServerEnv
} from "./dakgg";
import { requestDeepSeekReview } from "./deepseek";

export interface AnalyzeRequest {
  players: string[];
}

export interface AnalyzeResponse {
  season: SeasonInfo;
  players: PlayerSummary[];
  shared: SharedSummary;
  comparison: PlayerComparison;
  aiReview: string;
  warning?: string;
}

export async function analyzePlayers(fetcher: Fetcher, env: ServerEnv, body: unknown): Promise<AnalyzeResponse> {
  const nicknames = validateAnalyzeRequest(body);
  const [season, characters] = await Promise.all([fetchCurrentSeason(fetcher, env), fetchCharacters(fetcher)]);
  const samples = await Promise.all(nicknames.map((nickname) => fetchPlayerSample(fetcher, nickname, season.key)));
  const playerSummaries = samples.map((sample) => summarizePlayer(sample, characters));
  const sharedMatches = findSharedMatches(samples);
  const shared = summarizeShared(sharedMatches, characters);
  const comparison = comparePlayers(shared);

  const compactPayload = {
    season,
    players: playerSummaries,
    shared: {
      matchCount: shared.matchCount,
      confidence: shared.confidence,
      teamMetricsReliable: shared.teamMetricsReliable,
      avgRank: shared.avgRank,
      wins: shared.wins,
      avgTeamKill: shared.avgTeamKill
    },
    comparison
  };

  const deepseek = await requestDeepSeekReview(fetcher, env, compactPayload);

  return {
    season,
    players: playerSummaries,
    shared,
    comparison,
    aiReview: deepseek.aiReview,
    warning: deepseek.warning
  };
}

export function validateAnalyzeRequest(body: unknown): string[] {
  const players = (body as Partial<AnalyzeRequest>)?.players;
  if (!Array.isArray(players)) throw new Error("请输入 1-3 个昵称");

  const nicknames = players.map((item) => String(item).trim()).filter(Boolean);
  const unique = [...new Set(nicknames)];
  if (unique.length < 1 || unique.length > 3) throw new Error("请输入 1-3 个昵称");
  return unique;
}
