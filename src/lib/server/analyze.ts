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
  playerErrors: PlayerError[];
  shared: SharedSummary;
  comparison: PlayerComparison;
  aiReview: string;
  warning?: string;
}

export interface PlayerError {
  nickname: string;
  message: string;
}

export async function analyzePlayers(fetcher: Fetcher, env: ServerEnv, body: unknown): Promise<AnalyzeResponse> {
  const nicknames = validateAnalyzeRequest(body);
  const [season, characters] = await Promise.all([fetchCurrentSeason(fetcher, env), fetchCharacters(fetcher)]);
  const sampleResults = await Promise.allSettled(nicknames.map((nickname) => fetchPlayerSample(fetcher, nickname, season.key)));
  const samples = sampleResults.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
  const playerErrors = sampleResults.flatMap((result, index): PlayerError[] =>
    result.status === "rejected"
      ? [
          {
            nickname: nicknames[index],
            message: "无法获取该玩家近期对局，请检查昵称或稍后重试。"
          }
        ]
      : []
  );

  if (samples.length === 0) {
    throw new Error("无法获取任何玩家近期对局，请检查昵称或稍后重试。");
  }

  const playerSummaries = samples.map((sample) => summarizePlayer(sample, characters));
  const sharedMatches = findSharedMatches(samples);
  const shared = summarizeShared(sharedMatches, characters);
  const comparison = comparePlayers(shared);

  const compactPayload = {
    season,
    players: playerSummaries,
    shared: {
      matchCount: shared.matchCount,
      reliableMatchCount: shared.reliableMatchCount,
      confidence: shared.confidence,
      teamMetricsReliable: shared.teamMetricsReliable,
      avgRank: shared.avgRank,
      wins: shared.wins,
      avgTeamKill: shared.avgTeamKill,
      matches: shared.matches.slice(0, 12).map((match) => ({
        gameId: match.gameId,
        startDtm: match.startDtm,
        mode: match.mode,
        rank: match.rank,
        teamNumber: match.teamNumber,
        teamMetricsReliable: match.teamMetricsReliable,
        participants: match.participants.map((participant) => ({
          nickname: participant.nickname,
          characterNum: participant.characterNum,
          characterName: participant.characterName,
          kills: participant.kills,
          assists: participant.assists,
          deaths: participant.deaths,
          damageToPlayer: participant.damageToPlayer,
          damageFromPlayer: participant.damageFromPlayer,
          viewContribution: participant.viewContribution,
          monsterKill: participant.monsterKill,
          ccTimeToPlayer: participant.ccTimeToPlayer
        }))
      }))
    },
    playerErrors,
    comparison
  };

  const deepseek = await requestDeepSeekReview(fetcher, env, compactPayload);

  return {
    season,
    players: playerSummaries,
    playerErrors,
    shared,
    comparison,
    aiReview: deepseek.aiReview,
    warning: deepseek.warning
  };
}

export function validateAnalyzeRequest(body: unknown): string[] {
  const players = (body as Partial<AnalyzeRequest>)?.players;
  if (!Array.isArray(players)) throw new Error("请输入 1-3 个昵称");
  if (!players.every((item) => typeof item === "string")) throw new Error("请输入 1-3 个昵称");

  const nicknames = players.map((item) => item.trim()).filter(Boolean);
  const unique = [...new Set(nicknames)];
  if (unique.length < 1 || unique.length > 3) throw new Error("请输入 1-3 个昵称");
  return unique;
}
