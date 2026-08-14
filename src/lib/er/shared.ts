import type { DakggMatch, PlayerMatchSample } from "./types";

export interface SharedMatch {
  gameId: number;
  startDtm: string;
  teamNumber?: number;
  participants: DakggMatch[];
}

export interface SharedMatchResult {
  matches: SharedMatch[];
  confidence: "high" | "low";
}

export function findSharedMatches(samples: PlayerMatchSample[]): SharedMatchResult {
  if (samples.length <= 1) {
    return { matches: [], confidence: "high" };
  }

  const [first, ...rest] = samples;
  const shared: SharedMatch[] = [];
  let confidence: "high" | "low" = "high";

  for (const candidate of first.matches) {
    const participants = [candidate];
    let allFound = true;

    for (const sample of rest) {
      const sameGameMatches = sample.matches.filter((match) => match.gameId === candidate.gameId);
      const hasCompleteTeamData =
        candidate.teamNumber !== undefined && sameGameMatches.every((match) => match.teamNumber !== undefined);

      const teammate = hasCompleteTeamData
        ? sameGameMatches.find((match) => match.teamNumber === candidate.teamNumber)
        : sameGameMatches[0];

      if (!hasCompleteTeamData && sameGameMatches.length > 0) {
        confidence = "low";
      }

      if (!teammate) {
        allFound = false;
        break;
      }

      participants.push(teammate);
    }

    if (allFound) {
      shared.push({
        gameId: candidate.gameId,
        startDtm: candidate.startDtm,
        teamNumber: candidate.teamNumber,
        participants
      });
    }
  }

  return { matches: shared, confidence };
}
