import { modeLabel } from "./modes";
import type { SharedMatchResult } from "./shared";
import type { CharacterMap, DakggMatch, PlayerMatchSample } from "./types";

function value(match: DakggMatch, key: keyof DakggMatch): number {
  const raw = match[key];
  return typeof raw === "number" ? raw : 0;
}

function avg(matches: DakggMatch[], key: keyof DakggMatch): number {
  if (matches.length === 0) return 0;
  return Math.round((matches.reduce((sum, match) => sum + value(match, key), 0) / matches.length) * 10) / 10;
}

function total(matches: DakggMatch[], key: keyof DakggMatch): number {
  return matches.reduce((sum, match) => sum + value(match, key), 0);
}

export interface PlayerSummary {
  nickname: string;
  sampleCount: number;
  excludedCobaltCount: number;
  summary: {
    avgRank: number;
    wins: number;
    top3: number;
    kills: number;
    assists: number;
    deaths: number;
    kda: number;
    avgDamageToPlayer: number;
    avgDamageFromPlayer: number;
    avgDamageToMonster: number;
    avgMonsterKill: number;
    avgVisionContribution: number;
    avgCcTime: number;
    avgGainVFCredit: number;
    avgUseVFCredit: number;
  };
  characters: Array<{ characterNum: number; name: string; games: number }>;
  modeSplit: Record<string, number>;
}

export interface SharedParticipant {
  nickname: string;
  characterNum: number;
  characterName: string;
  kills: number;
  assists: number;
  deaths: number;
  damageToPlayer: number;
  damageFromPlayer: number;
  viewContribution: number;
  monsterKill: number;
  ccTimeToPlayer: number;
}

export interface SharedSummary {
  matchCount: number;
  reliableMatchCount: number;
  confidence: "high" | "low";
  teamMetricsReliable: boolean;
  avgRank: number | null;
  wins: number | null;
  avgTeamKill: number | null;
  matches: Array<{
    gameId: number;
    startDtm: string;
    mode: string | null;
    rank: number | null;
    teamNumber?: number;
    teamMetricsReliable: boolean;
    participants: SharedParticipant[];
  }>;
}

export interface PlayerComparison {
  damageLeader: string | null;
  pressureBearer: string | null;
  visionLeader: string | null;
  roleNotes: string[];
}

export function summarizePlayer(sample: PlayerMatchSample, characters: CharacterMap): PlayerSummary {
  const matches = sample.matches;
  const kills = total(matches, "playerKill");
  const assists = total(matches, "playerAssistant");
  const deaths = total(matches, "playerDeaths");
  const characterCounts = new Map<number, number>();
  const modeSplit: Record<string, number> = {};

  for (const match of matches) {
    characterCounts.set(match.characterNum, (characterCounts.get(match.characterNum) ?? 0) + 1);
    const label = modeLabel(match.matchingMode);
    modeSplit[label] = (modeSplit[label] ?? 0) + 1;
  }

  return {
    nickname: sample.nickname,
    sampleCount: sample.sampleCount,
    excludedCobaltCount: sample.excludedCobaltCount,
    summary: {
      avgRank: avg(matches, "gameRank"),
      wins: matches.filter((match) => match.gameRank === 1 || match.victory === 1).length,
      top3: matches.filter((match) => match.gameRank <= 3).length,
      kills,
      assists,
      deaths,
      kda: deaths === 0 ? kills + assists : Math.round(((kills + assists) / deaths) * 100) / 100,
      avgDamageToPlayer: avg(matches, "damageToPlayer"),
      avgDamageFromPlayer: avg(matches, "damageFromPlayer"),
      avgDamageToMonster: avg(matches, "damageToMonster"),
      avgMonsterKill: avg(matches, "monsterKill"),
      avgVisionContribution: avg(matches, "viewContribution"),
      avgCcTime: avg(matches, "ccTimeToPlayer"),
      avgGainVFCredit: avg(matches, "totalGainVFCredit"),
      avgUseVFCredit: avg(matches, "totalUseVFCredit")
    },
    characters: [...characterCounts.entries()]
      .map(([characterNum, games]) => ({
        characterNum,
        name: characters[characterNum]?.name ?? `角色 ${characterNum}`,
        games
      }))
      .sort((left, right) => right.games - left.games),
    modeSplit
  };
}

export function summarizeShared(shared: SharedMatchResult, characters: CharacterMap): SharedSummary {
  const matches = shared.matches;
  const summarizedMatches = matches.map((item) => {
    const representative = item.participants[0];
    const teamMetricsReliable =
      !item.usedFallback &&
      item.participants.length > 0 &&
      item.teamNumber !== undefined &&
      item.participants.every((participant) => participant.teamNumber === item.teamNumber);

    return {
      gameId: item.gameId,
      startDtm: item.startDtm,
      mode: teamMetricsReliable && representative ? modeLabel(representative.matchingMode) : null,
      rank: teamMetricsReliable && representative ? representative.gameRank : null,
      teamNumber: item.teamNumber,
      teamMetricsReliable,
      participants: item.participants.map((participant) => ({
        nickname: participant.nickname,
        characterNum: participant.characterNum,
        characterName: characters[participant.characterNum]?.name ?? `角色 ${participant.characterNum}`,
        kills: value(participant, "playerKill"),
        assists: value(participant, "playerAssistant"),
        deaths: value(participant, "playerDeaths"),
        damageToPlayer: value(participant, "damageToPlayer"),
        damageFromPlayer: value(participant, "damageFromPlayer"),
        viewContribution: value(participant, "viewContribution"),
        monsterKill: value(participant, "monsterKill"),
        ccTimeToPlayer: value(participant, "ccTimeToPlayer")
      }))
    };
  });
  const reliableMatches = matches.filter((item, index) => summarizedMatches[index]?.teamMetricsReliable);
  const teamMetricsReliable = reliableMatches.length > 0;

  return {
    matchCount: matches.length,
    reliableMatchCount: reliableMatches.length,
    confidence: shared.confidence,
    teamMetricsReliable,
    avgRank: teamMetricsReliable
      ? Math.round((reliableMatches.reduce((sum, item) => sum + item.participants[0].gameRank, 0) / reliableMatches.length) * 10) /
        10
      : null,
    wins: teamMetricsReliable
      ? reliableMatches.filter((item) => item.participants[0].gameRank === 1 || item.participants[0].victory === 1).length
      : null,
    avgTeamKill: teamMetricsReliable
      ? Math.round(
          (reliableMatches.reduce((sum, item) => sum + value(item.participants[0], "teamKill"), 0) / reliableMatches.length) *
            10
        ) / 10
      : null,
    matches: summarizedMatches
  };
}

export function comparePlayers(shared: SharedSummary): PlayerComparison {
  const totals = new Map<string, { damage: number; taken: number; vision: number }>();
  for (const match of shared.matches) {
    for (const participant of match.participants) {
      const current = totals.get(participant.nickname) ?? { damage: 0, taken: 0, vision: 0 };
      current.damage += participant.damageToPlayer;
      current.taken += participant.damageFromPlayer;
      current.vision += participant.viewContribution;
      totals.set(participant.nickname, current);
    }
  }

  const entries = [...totals.entries()];
  const leaderBy = (key: "damage" | "taken" | "vision") =>
    entries.sort((a, b) => b[1][key] - a[1][key])[0]?.[0] ?? null;

  const damageLeader = leaderBy("damage");
  const pressureBearer = leaderBy("taken");
  const visionLeader = leaderBy("vision");

  return {
    damageLeader,
    pressureBearer,
    visionLeader,
    roleNotes: [
      damageLeader ? `${damageLeader} 在共同对局中承担主要输出。` : "共同对局样本不足，无法判断主要输出。",
      pressureBearer ? `${pressureBearer} 承受了最多来自玩家的压力。` : "共同对局样本不足，无法判断承压角色。",
      visionLeader ? `${visionLeader} 的视野贡献最高。` : "共同对局样本不足，无法判断视野贡献。"
    ]
  };
}
