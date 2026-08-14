export interface DakggMatch {
  gameId: number;
  nickname: string;
  startDtm: string;
  matchingMode: number;
  matchingTeamMode?: number;
  teamNumber?: number;
  gameRank: number;
  victory?: number;
  characterNum: number;
  characterLevel?: number;
  playerKill?: number;
  playerAssistant?: number;
  playerDeaths?: number;
  teamKill?: number;
  teamElimination?: number;
  teamDown?: number;
  damageToPlayer?: number;
  damageFromPlayer?: number;
  damageToMonster?: number;
  monsterKill?: number;
  healAmount?: number;
  addTelephotoCamera?: number;
  removeTelephotoCamera?: number;
  useSecurityConsole?: number;
  useHyperLoop?: number;
  totalGainVFCredit?: number;
  totalUseVFCredit?: number;
  viewContribution?: number;
  ccTimeToPlayer?: number;
  duration?: number;
  killDetails?: Record<number, number>;
  deathDetails?: Record<number, number>;
}

export interface CharacterInfo {
  id: number;
  key: string;
  name: string;
}

export type CharacterMap = Record<number, CharacterInfo>;

export interface PlayerMatchSample {
  nickname: string;
  matches: DakggMatch[];
  sampleCount: number;
  excludedCobaltCount: number;
  exhaustedPages: boolean;
}

export type ModeLabel = "普通" | "排位" | "钴协议" | "其他模式";
