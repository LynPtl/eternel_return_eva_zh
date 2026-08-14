import { selectRecentNonCobaltMatches } from "../er/samples";
import type { CharacterMap, DakggMatch, PlayerMatchSample } from "../er/types";

export interface ServerEnv {
  DEFAULT_SEASON?: string;
  DEEPSEEK_API_KEY?: string;
  DEEPSEEK_BASE_URL?: string;
}

export interface SeasonInfo {
  key: string;
  name: string;
}

export type Fetcher = typeof fetch;

const BASE_URL = "https://er.dakgg.io/api/v1";
const MAX_PAGES = 8;
const SAMPLE_LIMIT = 20;

export async function fetchCurrentSeason(fetcher: Fetcher, env: Pick<ServerEnv, "DEFAULT_SEASON">): Promise<SeasonInfo> {
  try {
    const response = await fetcher(`${BASE_URL}/data/seasons?hl=zh-CN`);
    if (!response.ok) throw new Error(`season status ${response.status}`);
    const data = (await response.json()) as { seasons?: Array<{ key: string; name: string; isCurrent?: boolean }> };
    const current = data.seasons?.find((season) => season.isCurrent);
    if (current) return { key: current.key, name: current.name };
  } catch {
    // Fall through to configured default.
  }

  return { key: env.DEFAULT_SEASON ?? "SEASON_21", name: env.DEFAULT_SEASON ?? "SEASON_21" };
}

export async function fetchCharacters(fetcher: Fetcher): Promise<CharacterMap> {
  const response = await fetcher(`${BASE_URL}/data/characters?hl=zh-CN`);
  if (!response.ok) throw new Error(`characters status ${response.status}`);
  const data = (await response.json()) as {
    characters?: Array<{ id: number; key: string; name: string; charArcheTypes?: string[]; masteries?: string[] }>;
  };
  const characters: CharacterMap = {};
  for (const character of data.characters ?? []) {
    characters[character.id] = {
      id: character.id,
      key: character.key,
      name: character.name,
      charArcheTypes: character.charArcheTypes,
      masteries: character.masteries
    };
  }
  return characters;
}

export async function syncPlayerByName(fetcher: Fetcher, nickname: string): Promise<void> {
  const encoded = encodeURIComponent(nickname);
  try {
    await fetcher(`https://er.dakgg.io/api/v0/rpc/player-sync/by-name/${encoded}`, {
      headers: {
        Accept: "application/json,text/plain,*/*",
        Origin: "https://dak.gg",
        Referer: `https://dak.gg/er/players/${encoded}`,
        "User-Agent": "Mozilla/5.0"
      }
    });
  } catch {
    // Sync is a freshness hint. Match fetching should still work if it fails.
  }
}

export function normalizeMatch(nickname: string, raw: Record<string, unknown>): DakggMatch {
  return {
    gameId: Number(raw.gameId),
    nickname,
    startDtm: String(raw.startDtm ?? ""),
    matchingMode: Number(raw.matchingMode),
    matchingTeamMode: raw.matchingTeamMode === undefined ? undefined : Number(raw.matchingTeamMode),
    teamNumber: raw.teamNumber === undefined ? undefined : Number(raw.teamNumber),
    gameRank: Number(raw.gameRank),
    victory: raw.victory === undefined ? undefined : Number(raw.victory),
    characterNum: Number(raw.characterNum),
    characterLevel: numberOrUndefined(raw.characterLevel),
    playerKill: numberOrUndefined(raw.playerKill),
    playerAssistant: numberOrUndefined(raw.playerAssistant),
    playerDeaths: numberOrUndefined(raw.playerDeaths),
    teamKill: numberOrUndefined(raw.teamKill),
    teamElimination: numberOrUndefined(raw.teamElimination),
    teamDown: numberOrUndefined(raw.teamDown),
    damageToPlayer: numberOrUndefined(raw.damageToPlayer),
    damageFromPlayer: numberOrUndefined(raw.damageFromPlayer),
    damageToMonster: numberOrUndefined(raw.damageToMonster),
    monsterKill: numberOrUndefined(raw.monsterKill),
    healAmount: numberOrUndefined(raw.healAmount),
    addTelephotoCamera: numberOrUndefined(raw.addTelephotoCamera),
    removeTelephotoCamera: numberOrUndefined(raw.removeTelephotoCamera),
    useSecurityConsole: numberOrUndefined(raw.useSecurityConsole),
    useHyperLoop: numberOrUndefined(raw.useHyperLoop),
    totalGainVFCredit: numberOrUndefined(raw.totalGainVFCredit),
    totalUseVFCredit: numberOrUndefined(raw.totalUseVFCredit),
    viewContribution: numberOrUndefined(raw.viewContribution),
    ccTimeToPlayer: numberOrUndefined(raw.ccTimeToPlayer),
    duration: numberOrUndefined(raw.duration),
    killDetails: parseDetails(raw.killDetails),
    deathDetails: parseDetails(raw.deathDetails)
  };
}

export async function fetchPlayerSample(fetcher: Fetcher, nickname: string, seasonKey: string): Promise<PlayerMatchSample> {
  const pages: DakggMatch[][] = [];
  await syncPlayerByName(fetcher, nickname);

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const encoded = encodeURIComponent(nickname);
    const response = await fetcher(
      `${BASE_URL}/players/${encoded}/matches?season=${seasonKey}&matchingMode=ALL&teamMode=ALL&page=${page}`
    );
    if (!response.ok) throw new Error(`matches ${nickname} status ${response.status}`);
    const data = (await response.json()) as { matches?: Array<Record<string, unknown>> };
    const normalized = (data.matches ?? []).map((raw) => normalizeMatch(nickname, raw));
    if (normalized.length === 0) break;
    pages.push(normalized);

    const sample = selectRecentNonCobaltMatches(nickname, pages, SAMPLE_LIMIT);
    if (sample.sampleCount >= SAMPLE_LIMIT) return { ...sample, exhaustedPages: false };
  }

  return selectRecentNonCobaltMatches(nickname, pages, SAMPLE_LIMIT);
}

function numberOrUndefined(value: unknown): number | undefined {
  return value === undefined || value === null ? undefined : Number(value);
}

function parseDetails(value: unknown): Record<number, number> | undefined {
  if (value === undefined || value === null || value === "") return undefined;

  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value) as unknown;
    } catch {
      return undefined;
    }
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;

  const details: Record<number, number> = {};
  for (const [key, rawCount] of Object.entries(parsed)) {
    const characterNum = Number(key);
    const count = Number(rawCount);
    if (Number.isFinite(characterNum) && Number.isFinite(count) && count > 0) {
      details[characterNum] = count;
    }
  }

  return Object.keys(details).length > 0 ? details : undefined;
}
