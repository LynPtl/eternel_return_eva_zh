import { isCobaltMatch } from "./modes";
import type { DakggMatch, PlayerMatchSample } from "./types";

export function selectRecentNonCobaltMatches(
  nickname: string,
  pages: DakggMatch[][],
  limit = 20
): PlayerMatchSample {
  const matches: DakggMatch[] = [];
  let excludedCobaltCount = 0;

  for (const page of pages) {
    for (const match of page) {
      if (isCobaltMatch(match)) {
        excludedCobaltCount += 1;
        continue;
      }
      if (matches.length < limit) {
        matches.push(match);
      }
    }
    if (matches.length >= limit) break;
  }

  return {
    nickname,
    matches,
    sampleCount: matches.length,
    excludedCobaltCount,
    exhaustedPages: matches.length < limit
  };
}
