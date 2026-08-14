import type { DakggMatch, ModeLabel } from "./types";

export const COBALT_MODE = 6;

export function isCobaltMode(mode: number): boolean {
  return mode === COBALT_MODE;
}

export function isCobaltMatch(match: Pick<DakggMatch, "matchingMode">): boolean {
  return isCobaltMode(match.matchingMode);
}

export function modeLabel(mode: number): ModeLabel {
  if (mode === 2) return "普通";
  if (mode === 3) return "排位";
  if (mode === COBALT_MODE) return "钴协议";
  return "其他模式";
}
