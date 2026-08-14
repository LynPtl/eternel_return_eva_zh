# Eternal Return Performance Analyzer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Cloudflare Pages app that analyzes 1 to 3 Eternal Return players, prioritizing shared non-Cobalt matches and AI coaching in Chinese.

**Architecture:** Use a Vite React static frontend with Cloudflare Pages Functions for `/api/analyze`. Keep match filtering, shared-match detection, and metrics as pure TypeScript modules with Vitest coverage; server modules fetch DAKGG data and call DeepSeek using a Pages environment variable.

**Tech Stack:** Vite, React, TypeScript, Vitest, Cloudflare Pages Functions, Wrangler, DeepSeek chat completions API.

## Global Constraints

- Analyze 1 to 3 player nicknames.
- Fetch DAKGG matches with `matchingMode=ALL&teamMode=ALL`.
- Exclude Cobalt Protocol where `matchingMode === 6`.
- Keep up to the latest 20 non-Cobalt matches per player; if fewer are available, analyze the available count.
- Do not use `union-teams`.
- Shared matches must prefer `gameId + teamNumber`; if team data is missing, fall back to `gameId` and mark confidence lower.
- Use current season from `/api/v1/data/seasons?hl=zh-CN` where `isCurrent === true`; fall back to a configured default.
- Load Chinese character names from `/api/v1/data/characters?hl=zh-CN`.
- Do not send full raw DAKGG match JSON to DeepSeek.
- Keep `DEEPSEEK_API_KEY` server-side only.
- Treat `adina-lab.com` as a functional reference only; do not copy branding, Korean copy, exact assets, or overall visual styling.
- The primary result area must emphasize multiplayer shared-match analysis, team comparison, and AI coaching.

---

## File Structure

- `package.json`: scripts and dependencies.
- `tsconfig.json`: strict TypeScript project config.
- `vite.config.ts`: Vite + React + Vitest config.
- `wrangler.jsonc`: Cloudflare Pages build output and compatibility date.
- `.gitignore`: local artifacts and secrets.
- `.dev.vars.example`: local environment variable template.
- `index.html`: Vite entry document.
- `src/main.tsx`: React bootstrap.
- `src/App.tsx`: page shell, form state, API call, and result rendering.
- `src/styles.css`: responsive dashboard styling.
- `src/lib/er/types.ts`: DAKGG and internal analysis types.
- `src/lib/er/modes.ts`: match-mode labels and Cobalt detection.
- `src/lib/er/samples.ts`: non-Cobalt filtering and recent sample selection.
- `src/lib/er/shared.ts`: shared-match detection using `gameId + teamNumber`.
- `src/lib/er/metrics.ts`: per-player, shared-match, and comparison metrics.
- `src/lib/server/dakgg.ts`: DAKGG API client and compact match normalization.
- `src/lib/server/deepseek.ts`: DeepSeek prompt and request wrapper.
- `src/lib/server/analyze.ts`: orchestration used by Pages Function.
- `functions/api/analyze.ts`: `POST /api/analyze` Pages Function.
- `tests/er/*.test.ts`: pure analysis tests.
- `tests/server/*.test.ts`: server client/orchestration tests with mocked fetch.
- `README.md`: setup, environment variables, local dev, deploy notes.

---

### Task 1: Project Scaffold And Tooling

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `wrangler.jsonc`
- Create: `.gitignore`
- Create: `.dev.vars.example`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/styles.css`

**Interfaces:**
- Produces: React/Vite project with test/build scripts.
- Produces: Cloudflare Pages configuration using `dist` as the build output.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "eternel-return-eva-zh",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview --host 127.0.0.1",
    "pages:dev": "npm run build && wrangler pages dev dist",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "lucide-react": "^0.468.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20260814.0",
    "@types/react": "^18.3.18",
    "@types/react-dom": "^18.3.5",
    "typescript": "^5.7.3",
    "vite": "^6.0.7",
    "vitest": "^2.1.8",
    "wrangler": "^3.99.0"
  }
}
```

- [ ] **Step 2: Create TypeScript and Vite config**

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2022", "WebWorker"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "types": ["@cloudflare/workers-types", "vitest/globals"]
  },
  "include": ["src", "functions", "tests", "vite.config.ts"]
}
```

`vite.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"]
  }
});
```

- [ ] **Step 3: Create Cloudflare and local config files**

`wrangler.jsonc`:

```jsonc
{
  "name": "eternel-return-eva-zh",
  "pages_build_output_dir": "./dist",
  "compatibility_date": "2026-08-14",
  "vars": {
    "DEFAULT_SEASON": "SEASON_21",
    "DEEPSEEK_BASE_URL": "https://api.deepseek.com"
  }
}
```

`.gitignore`:

```gitignore
node_modules/
dist/
.wrangler/
.dev.vars
.DS_Store
```

`.dev.vars.example`:

```text
DEEPSEEK_API_KEY=replace-with-local-key
DEFAULT_SEASON=SEASON_21
DEEPSEEK_BASE_URL=https://api.deepseek.com
```

- [ ] **Step 4: Create minimal app shell**

`index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>永恒轮回组队复盘</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/main.tsx`:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

`src/App.tsx`:

```tsx
export function App() {
  return (
    <main className="app-shell">
      <section className="hero-panel">
        <p className="eyebrow">Eternal Return Team Review</p>
        <h1>永恒轮回组队复盘</h1>
        <p className="lede">输入 1-3 个昵称，分析最近非钴协议对局里的共同表现。</p>
      </section>
    </main>
  );
}
```

`src/styles.css`:

```css
:root {
  color: #eef2ff;
  background: #0a0d14;
  font-family: Inter, "Noto Sans SC", "PingFang SC", system-ui, sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
}

.app-shell {
  min-height: 100vh;
  padding: 32px 18px;
  background:
    radial-gradient(circle at 20% 12%, rgba(60, 130, 246, 0.18), transparent 32%),
    linear-gradient(180deg, #111827 0%, #070a11 100%);
}

.hero-panel {
  width: min(1040px, 100%);
  margin: 0 auto;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 8px;
  padding: 24px;
  background: rgba(15, 23, 42, 0.78);
}

.eyebrow {
  margin: 0 0 8px;
  color: #67e8f9;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0;
}

h1 {
  margin: 0;
  font-size: 32px;
  line-height: 1.15;
}

.lede {
  margin: 12px 0 0;
  color: #cbd5e1;
}
```

- [ ] **Step 5: Install dependencies**

Run: `npm install`

Expected: `package-lock.json` is created and installation exits with code 0.

- [ ] **Step 6: Verify scaffold**

Run: `npm run build`

Expected: TypeScript and Vite build complete successfully and `dist/` exists.

- [ ] **Step 7: Commit scaffold**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts wrangler.jsonc .gitignore .dev.vars.example index.html src/main.tsx src/App.tsx src/styles.css
git commit -m "chore: scaffold pages app" -m "Co-authored-by: TRAE CLI <noreply@bytedance.com>"
```

---

### Task 2: Domain Types And Mode Utilities

**Files:**
- Create: `src/lib/er/types.ts`
- Create: `src/lib/er/modes.ts`
- Test: `tests/er/modes.test.ts`

**Interfaces:**
- Produces: `DakggMatch`, `PlayerMatchSample`, `ModeLabel`, `modeLabel(mode: number): ModeLabel`, `isCobaltMatch(match: Pick<DakggMatch, "matchingMode">): boolean`.
- Consumes: No earlier domain modules.

- [ ] **Step 1: Write failing mode tests**

`tests/er/modes.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isCobaltMode, modeLabel } from "../../src/lib/er/modes";

describe("mode utilities", () => {
  it("labels known modes", () => {
    expect(modeLabel(2)).toBe("普通");
    expect(modeLabel(3)).toBe("排位");
    expect(modeLabel(6)).toBe("钴协议");
    expect(modeLabel(99)).toBe("其他模式");
  });

  it("detects Cobalt Protocol", () => {
    expect(isCobaltMode(6)).toBe(true);
    expect(isCobaltMode(2)).toBe(false);
    expect(isCobaltMode(3)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- tests/er/modes.test.ts`

Expected: FAIL because `src/lib/er/modes.ts` does not exist.

- [ ] **Step 3: Create domain types**

`src/lib/er/types.ts`:

```ts
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
```

- [ ] **Step 4: Create mode utilities**

`src/lib/er/modes.ts`:

```ts
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
```

- [ ] **Step 5: Run test to verify pass**

Run: `npm test -- tests/er/modes.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit domain mode utilities**

```bash
git add src/lib/er/types.ts src/lib/er/modes.ts tests/er/modes.test.ts
git commit -m "feat: add match mode utilities" -m "Co-authored-by: TRAE CLI <noreply@bytedance.com>"
```

---

### Task 3: Non-Cobalt Sampling

**Files:**
- Create: `src/lib/er/samples.ts`
- Test: `tests/er/samples.test.ts`

**Interfaces:**
- Consumes: `DakggMatch` from `src/lib/er/types.ts`.
- Produces: `selectRecentNonCobaltMatches(nickname: string, pages: DakggMatch[][], limit?: number): PlayerMatchSample`.

- [ ] **Step 1: Write failing sample tests**

`tests/er/samples.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { DakggMatch } from "../../src/lib/er/types";
import { selectRecentNonCobaltMatches } from "../../src/lib/er/samples";

function match(gameId: number, mode: number): DakggMatch {
  return {
    gameId,
    nickname: "A",
    startDtm: `2026-08-14T00:${String(gameId).padStart(2, "0")}:00.000+0900`,
    matchingMode: mode,
    matchingTeamMode: mode === 6 ? 4 : 3,
    teamNumber: 1,
    gameRank: 1,
    characterNum: 12
  };
}

describe("selectRecentNonCobaltMatches", () => {
  it("excludes Cobalt and keeps the latest non-Cobalt matches up to limit", () => {
    const pages = [[match(1, 2), match(2, 6), match(3, 3), match(4, 2)]];
    const sample = selectRecentNonCobaltMatches("A", pages, 2);

    expect(sample.matches.map((item) => item.gameId)).toEqual([1, 3]);
    expect(sample.sampleCount).toBe(2);
    expect(sample.excludedCobaltCount).toBe(1);
  });

  it("returns fewer than limit when not enough non-Cobalt matches exist", () => {
    const pages = [[match(1, 6), match(2, 3)]];
    const sample = selectRecentNonCobaltMatches("A", pages, 20);

    expect(sample.matches.map((item) => item.gameId)).toEqual([2]);
    expect(sample.sampleCount).toBe(1);
    expect(sample.excludedCobaltCount).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- tests/er/samples.test.ts`

Expected: FAIL because `src/lib/er/samples.ts` does not exist.

- [ ] **Step 3: Implement sample selection**

`src/lib/er/samples.ts`:

```ts
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
```

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/er/samples.test.ts tests/er/modes.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit sampling**

```bash
git add src/lib/er/samples.ts tests/er/samples.test.ts
git commit -m "feat: add non-cobalt sampling" -m "Co-authored-by: TRAE CLI <noreply@bytedance.com>"
```

---

### Task 4: Shared-Match Detection

**Files:**
- Create: `src/lib/er/shared.ts`
- Test: `tests/er/shared.test.ts`

**Interfaces:**
- Consumes: `PlayerMatchSample`, `DakggMatch`.
- Produces: `findSharedMatches(samples: PlayerMatchSample[]): SharedMatchResult`.

- [ ] **Step 1: Write failing shared-match tests**

`tests/er/shared.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { findSharedMatches } from "../../src/lib/er/shared";
import type { DakggMatch, PlayerMatchSample } from "../../src/lib/er/types";

function match(nickname: string, gameId: number, teamNumber?: number): DakggMatch {
  return {
    gameId,
    nickname,
    startDtm: "2026-08-14T00:00:00.000+0900",
    matchingMode: 3,
    matchingTeamMode: 3,
    teamNumber,
    gameRank: 1,
    characterNum: 12,
    playerKill: 1,
    playerAssistant: 2,
    playerDeaths: 0
  };
}

function sample(nickname: string, matches: DakggMatch[]): PlayerMatchSample {
  return {
    nickname,
    matches,
    sampleCount: matches.length,
    excludedCobaltCount: 0,
    exhaustedPages: true
  };
}

describe("findSharedMatches", () => {
  it("requires same gameId and teamNumber when team data exists", () => {
    const result = findSharedMatches([
      sample("A", [match("A", 1, 7), match("A", 2, 4)]),
      sample("B", [match("B", 1, 7), match("B", 2, 5)])
    ]);

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].gameId).toBe(1);
    expect(result.confidence).toBe("high");
  });

  it("falls back to gameId when teamNumber is missing", () => {
    const result = findSharedMatches([
      sample("A", [match("A", 3)]),
      sample("B", [match("B", 3, 1)])
    ]);

    expect(result.matches).toHaveLength(1);
    expect(result.confidence).toBe("low");
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- tests/er/shared.test.ts`

Expected: FAIL because `src/lib/er/shared.ts` does not exist.

- [ ] **Step 3: Implement shared-match detection**

`src/lib/er/shared.ts`:

```ts
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
```

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/er/shared.test.ts tests/er/samples.test.ts tests/er/modes.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit shared-match detection**

```bash
git add src/lib/er/shared.ts tests/er/shared.test.ts
git commit -m "feat: detect shared team matches" -m "Co-authored-by: TRAE CLI <noreply@bytedance.com>"
```

---

### Task 5: Metrics Aggregation

**Files:**
- Create: `src/lib/er/metrics.ts`
- Test: `tests/er/metrics.test.ts`

**Interfaces:**
- Consumes: `PlayerMatchSample`, `CharacterMap`, `SharedMatchResult`.
- Produces: `summarizePlayer(sample, characters)`, `summarizeShared(shared)`, `comparePlayers(playerSummaries, shared)`.

- [ ] **Step 1: Write failing metrics tests**

`tests/er/metrics.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { comparePlayers, summarizePlayer, summarizeShared } from "../../src/lib/er/metrics";
import type { CharacterMap, DakggMatch, PlayerMatchSample } from "../../src/lib/er/types";
import type { SharedMatchResult } from "../../src/lib/er/shared";

const characters: CharacterMap = {
  12: { id: 12, key: "Hyejin", name: "慧珍" },
  50: { id: 50, key: "Elena", name: "埃琳娜" }
};

function match(overrides: Partial<DakggMatch>): DakggMatch {
  return {
    gameId: 1,
    nickname: "A",
    startDtm: "2026-08-14T00:00:00.000+0900",
    matchingMode: 3,
    teamNumber: 1,
    gameRank: 1,
    characterNum: 12,
    playerKill: 1,
    playerAssistant: 2,
    playerDeaths: 1,
    teamKill: 8,
    damageToPlayer: 10000,
    damageFromPlayer: 5000,
    damageToMonster: 40000,
    monsterKill: 30,
    addTelephotoCamera: 10,
    useSecurityConsole: 2,
    totalGainVFCredit: 700,
    totalUseVFCredit: 500,
    viewContribution: 20,
    ccTimeToPlayer: 30,
    ...overrides
  };
}

function sample(nickname: string, matches: DakggMatch[]): PlayerMatchSample {
  return { nickname, matches, sampleCount: matches.length, excludedCobaltCount: 0, exhaustedPages: true };
}

describe("metrics aggregation", () => {
  it("summarizes individual player metrics and character pool", () => {
    const summary = summarizePlayer(sample("A", [match({ gameRank: 1 }), match({ gameId: 2, gameRank: 3, characterNum: 50 })]), characters);

    expect(summary.nickname).toBe("A");
    expect(summary.summary.avgRank).toBe(2);
    expect(summary.summary.wins).toBe(1);
    expect(summary.characters.map((item) => item.name)).toEqual(["慧珍", "埃琳娜"]);
  });

  it("summarizes shared matches and compares role tendencies", () => {
    const shared: SharedMatchResult = {
      confidence: "high",
      matches: [
        {
          gameId: 10,
          startDtm: "2026-08-14T00:00:00.000+0900",
          teamNumber: 1,
          participants: [
            match({ nickname: "A", damageToPlayer: 20000, damageFromPlayer: 4000, viewContribution: 10 }),
            match({ nickname: "B", damageToPlayer: 8000, damageFromPlayer: 13000, viewContribution: 35 })
          ]
        }
      ]
    };

    const sharedSummary = summarizeShared(shared, characters);
    const comparison = comparePlayers(sharedSummary);

    expect(sharedSummary.matchCount).toBe(1);
    expect(comparison.damageLeader).toBe("A");
    expect(comparison.pressureBearer).toBe("B");
    expect(comparison.visionLeader).toBe("B");
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- tests/er/metrics.test.ts`

Expected: FAIL because `src/lib/er/metrics.ts` does not exist.

- [ ] **Step 3: Implement metrics**

`src/lib/er/metrics.ts`:

```ts
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
  confidence: "high" | "low";
  avgRank: number;
  wins: number;
  avgTeamKill: number;
  matches: Array<{
    gameId: number;
    startDtm: string;
    mode: string;
    rank: number;
    teamNumber?: number;
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
  return {
    matchCount: matches.length,
    confidence: shared.confidence,
    avgRank: matches.length === 0 ? 0 : Math.round((matches.reduce((sum, item) => sum + item.participants[0].gameRank, 0) / matches.length) * 10) / 10,
    wins: matches.filter((item) => item.participants[0].gameRank === 1 || item.participants[0].victory === 1).length,
    avgTeamKill: matches.length === 0 ? 0 : Math.round((matches.reduce((sum, item) => sum + value(item.participants[0], "teamKill"), 0) / matches.length) * 10) / 10,
    matches: matches.map((item) => ({
      gameId: item.gameId,
      startDtm: item.startDtm,
      mode: modeLabel(item.participants[0].matchingMode),
      rank: item.participants[0].gameRank,
      teamNumber: item.teamNumber,
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
    }))
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
```

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/er/metrics.test.ts tests/er/shared.test.ts tests/er/samples.test.ts tests/er/modes.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit metrics**

```bash
git add src/lib/er/metrics.ts tests/er/metrics.test.ts
git commit -m "feat: aggregate player and shared metrics" -m "Co-authored-by: TRAE CLI <noreply@bytedance.com>"
```

---

### Task 6: DAKGG Client

**Files:**
- Create: `src/lib/server/dakgg.ts`
- Test: `tests/server/dakgg.test.ts`

**Interfaces:**
- Produces: `fetchCurrentSeason(fetcher, env)`, `fetchCharacters(fetcher)`, `fetchPlayerSample(fetcher, nickname, seasonKey)`.
- Consumes: `selectRecentNonCobaltMatches`, `CharacterMap`, `DakggMatch`.

- [ ] **Step 1: Write failing DAKGG client tests**

`tests/server/dakgg.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { fetchCharacters, fetchCurrentSeason, normalizeMatch } from "../../src/lib/server/dakgg";

describe("DAKGG client helpers", () => {
  it("selects current season and falls back when missing", async () => {
    const fetcher = async () =>
      Response.json({
        seasons: [
          { key: "SEASON_20", name: "赛季 S11" },
          { key: "SEASON_21", name: "赛季 S12", isCurrent: true }
        ]
      });

    await expect(fetchCurrentSeason(fetcher, { DEFAULT_SEASON: "SEASON_20" })).resolves.toEqual({
      key: "SEASON_21",
      name: "赛季 S12"
    });
  });

  it("normalizes character payload", async () => {
    const fetcher = async () =>
      Response.json({
        characters: [
          { id: 12, key: "Hyejin", name: "慧珍" },
          { id: 50, key: "Elena", name: "埃琳娜" }
        ]
      });

    const characters = await fetchCharacters(fetcher);
    expect(characters[12].name).toBe("慧珍");
    expect(characters[50].key).toBe("Elena");
  });

  it("normalizes match nickname from request context", () => {
    const normalized = normalizeMatch("Ptlantern", {
      gameId: 1,
      startDtm: "2026-08-14T00:00:00.000+0900",
      matchingMode: 3,
      teamNumber: 2,
      gameRank: 1,
      characterNum: 12,
      playerKill: 2
    });

    expect(normalized.nickname).toBe("Ptlantern");
    expect(normalized.playerKill).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- tests/server/dakgg.test.ts`

Expected: FAIL because `src/lib/server/dakgg.ts` does not exist.

- [ ] **Step 3: Implement DAKGG client**

`src/lib/server/dakgg.ts`:

```ts
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
  const data = (await response.json()) as { characters?: Array<{ id: number; key: string; name: string }> };
  const characters: CharacterMap = {};
  for (const character of data.characters ?? []) {
    characters[character.id] = character;
  }
  return characters;
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
    duration: numberOrUndefined(raw.duration)
  };
}

export async function fetchPlayerSample(fetcher: Fetcher, nickname: string, seasonKey: string): Promise<PlayerMatchSample> {
  const pages: DakggMatch[][] = [];

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const encoded = encodeURIComponent(nickname);
    const response = await fetcher(`${BASE_URL}/players/${encoded}/matches?season=${seasonKey}&matchingMode=ALL&teamMode=ALL&page=${page}`);
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
```

- [ ] **Step 4: Run server client test**

Run: `npm test -- tests/server/dakgg.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit DAKGG client**

```bash
git add src/lib/server/dakgg.ts tests/server/dakgg.test.ts
git commit -m "feat: add dakgg data client" -m "Co-authored-by: TRAE CLI <noreply@bytedance.com>"
```

---

### Task 7: DeepSeek Client And Prompt

**Files:**
- Create: `src/lib/server/deepseek.ts`
- Test: `tests/server/deepseek.test.ts`

**Interfaces:**
- Consumes: compact analysis payload from orchestration.
- Produces: `buildDeepSeekMessages(payload)`, `requestDeepSeekReview(fetcher, env, payload)`.

- [ ] **Step 1: Write failing DeepSeek tests**

`tests/server/deepseek.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildDeepSeekMessages, requestDeepSeekReview } from "../../src/lib/server/deepseek";

const payload = {
  season: { key: "SEASON_21", name: "赛季 S12" },
  players: [{ nickname: "A", sampleCount: 20 }],
  shared: { matchCount: 2, confidence: "high" },
  comparison: { roleNotes: ["A 主要输出"] }
};

describe("DeepSeek client", () => {
  it("builds Chinese coaching messages with sample constraints", () => {
    const messages = buildDeepSeekMessages(payload);
    expect(messages[0].content).toContain("中文");
    expect(messages[0].content).toContain("不要评价钴协议");
    expect(messages[1].content).toContain("SEASON_21");
  });

  it("returns empty review when API key is missing", async () => {
    const review = await requestDeepSeekReview(fetch, {}, payload);
    expect(review).toEqual({ aiReview: "", warning: "未配置 DeepSeek API Key，已仅返回规则指标。" });
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- tests/server/deepseek.test.ts`

Expected: FAIL because `src/lib/server/deepseek.ts` does not exist.

- [ ] **Step 3: Implement DeepSeek client**

`src/lib/server/deepseek.ts`:

```ts
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

export async function requestDeepSeekReview(fetcher: Fetcher, env: ServerEnv, payload: unknown): Promise<DeepSeekResult> {
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
```

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/server/deepseek.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit DeepSeek client**

```bash
git add src/lib/server/deepseek.ts tests/server/deepseek.test.ts
git commit -m "feat: add deepseek review client" -m "Co-authored-by: TRAE CLI <noreply@bytedance.com>"
```

---

### Task 8: Analysis Orchestration And Pages Function

**Files:**
- Create: `src/lib/server/analyze.ts`
- Create: `functions/api/analyze.ts`
- Test: `tests/server/analyze.test.ts`

**Interfaces:**
- Consumes: DAKGG client, DeepSeek client, metrics modules.
- Produces: `analyzePlayers(fetcher, env, request): Promise<AnalyzeResponse>`.
- Produces: `onRequestPost(context)` for Cloudflare Pages Function.

- [ ] **Step 1: Write failing orchestration tests**

`tests/server/analyze.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { validateAnalyzeRequest } from "../../src/lib/server/analyze";

describe("analyze request validation", () => {
  it("accepts 1 to 3 non-empty nicknames and trims them", () => {
    expect(validateAnalyzeRequest({ players: [" A ", "B"] })).toEqual(["A", "B"]);
  });

  it("rejects empty or too many players", () => {
    expect(() => validateAnalyzeRequest({ players: [] })).toThrow("请输入 1-3 个昵称");
    expect(() => validateAnalyzeRequest({ players: ["A", "B", "C", "D"] })).toThrow("请输入 1-3 个昵称");
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- tests/server/analyze.test.ts`

Expected: FAIL because `src/lib/server/analyze.ts` does not exist.

- [ ] **Step 3: Implement orchestration**

`src/lib/server/analyze.ts`:

```ts
import { comparePlayers, summarizePlayer, summarizeShared } from "../er/metrics";
import { findSharedMatches } from "../er/shared";
import { fetchCharacters, fetchCurrentSeason, fetchPlayerSample, type Fetcher, type ServerEnv } from "./dakgg";
import { requestDeepSeekReview } from "./deepseek";

export interface AnalyzeRequest {
  players: string[];
}

export async function analyzePlayers(fetcher: Fetcher, env: ServerEnv, body: AnalyzeRequest) {
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
      avgRank: shared.avgRank,
      wins: shared.wins,
      avgTeamKill: shared.avgTeamKill,
      matches: shared.matches.slice(0, 12)
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
```

- [ ] **Step 4: Implement Pages Function**

`functions/api/analyze.ts`:

```ts
import { analyzePlayers } from "../../src/lib/server/analyze";
import type { ServerEnv } from "../../src/lib/server/dakgg";

type PagesContext = EventContext<ServerEnv, string, Record<string, unknown>>;

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders() });
}

export async function onRequestPost(context: PagesContext): Promise<Response> {
  try {
    const body = await context.request.json();
    const result = await analyzePlayers(fetch, context.env, body);
    return json(result, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "分析失败";
    const status = message.includes("请输入") ? 400 : 502;
    return json({ error: message }, status);
  }
}

function json(data: unknown, status: number): Response {
  return Response.json(data, { status, headers: corsHeaders() });
}

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}
```

- [ ] **Step 5: Run tests and typecheck**

Run: `npm test -- tests/server/analyze.test.ts tests/server/deepseek.test.ts tests/server/dakgg.test.ts tests/er/metrics.test.ts tests/er/shared.test.ts tests/er/samples.test.ts tests/er/modes.test.ts`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 6: Commit orchestration and function**

```bash
git add src/lib/server/analyze.ts functions/api/analyze.ts tests/server/analyze.test.ts
git commit -m "feat: expose player analysis function" -m "Co-authored-by: TRAE CLI <noreply@bytedance.com>"
```

---

### Task 9: Frontend Analyzer UI

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `POST /api/analyze` response shape from Task 8.
- Produces: usable Chinese UI with 1 / 2 / 3 player selection, nickname inputs, loading state, shared-match-first results, and AI review.

- [ ] **Step 1: Replace `src/App.tsx` with interactive UI**

```tsx
import { Activity, BarChart3, Brain, Swords, Users } from "lucide-react";
import { useMemo, useState } from "react";

interface AnalyzeResponse {
  season: { key: string; name: string };
  players: Array<{
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
      avgMonsterKill: number;
      avgVisionContribution: number;
      avgCcTime: number;
    };
    characters: Array<{ characterNum: number; name: string; games: number }>;
  }>;
  shared: {
    matchCount: number;
    confidence: "high" | "low";
    avgRank: number;
    wins: number;
    avgTeamKill: number;
    matches: Array<{
      gameId: number;
      mode: string;
      rank: number;
      participants: Array<{
        nickname: string;
        characterName: string;
        kills: number;
        assists: number;
        deaths: number;
        damageToPlayer: number;
        damageFromPlayer: number;
        viewContribution: number;
      }>;
    }>;
  };
  comparison: { damageLeader: string | null; pressureBearer: string | null; visionLeader: string | null; roleNotes: string[] };
  aiReview: string;
  warning?: string;
  error?: string;
}

export function App() {
  const [playerCount, setPlayerCount] = useState(2);
  const [names, setNames] = useState(["Ptlantern", "", ""]);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const activeNames = useMemo(() => names.slice(0, playerCount), [names, playerCount]);
  const canSubmit = activeNames.some((name) => name.trim());

  async function submit() {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ players: activeNames })
      });
      const data = (await response.json()) as AnalyzeResponse;
      if (!response.ok) throw new Error(data.error ?? "分析失败");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "分析失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Eternal Return Team Review</p>
          <h1>永恒轮回组队复盘</h1>
        </div>
        <span className="status-pill"><Activity size={14} /> 当前赛季自动识别</span>
      </header>

      <section className="input-panel">
        <div className="panel-heading">
          <Users size={20} />
          <div>
            <h2>输入玩家</h2>
            <p>分析最近最多 20 场非钴协议对局，重点看多人同队表现。</p>
          </div>
        </div>

        <div className="count-switch">
          {[1, 2, 3].map((count) => (
            <button key={count} className={playerCount === count ? "active" : ""} onClick={() => setPlayerCount(count)}>
              {count} 人分析
            </button>
          ))}
        </div>

        <div className="name-grid">
          {activeNames.map((name, index) => (
            <label key={index} className="name-field">
              <span>{index + 1}</span>
              <input
                value={name}
                placeholder={`玩家昵称 ${index + 1}`}
                onChange={(event) => {
                  const next = [...names];
                  next[index] = event.target.value;
                  setNames(next);
                }}
              />
            </label>
          ))}
        </div>

        <button className="primary-button" disabled={!canSubmit || loading} onClick={submit}>
          <Brain size={18} /> {loading ? "分析中..." : "开始复盘"}
        </button>
        <p className="helper">默认统计全部普通/排位等主模式，钴协议会自动排除；多人共同对局优先按同局同队识别。</p>
      </section>

      {error && <section className="error-panel">{error}</section>}
      {result && <Results result={result} />}
    </main>
  );
}

function Results({ result }: { result: AnalyzeResponse }) {
  return (
    <section className="results">
      <div className="summary-strip">
        <Metric label="赛季" value={result.season.name} />
        <Metric label="共同对局" value={`${result.shared.matchCount} 场`} />
        <Metric label="识别置信度" value={result.shared.confidence === "high" ? "同局同队" : "仅同局"} />
        <Metric label="共同均名次" value={result.shared.matchCount ? String(result.shared.avgRank) : "-"} />
      </div>

      <section className="result-card primary">
        <div className="section-title"><Swords size={18} /><h2>共同对局分析</h2></div>
        {result.shared.matchCount === 0 ? (
          <p className="muted">最近样本里没有识别到共同非钴协议对局，因此只展示个人近况。</p>
        ) : (
          <>
            <p className="lead-metric">共同吃鸡 {result.shared.wins} 场，平均队伍击杀 {result.shared.avgTeamKill}</p>
            <div className="match-list">
              {result.shared.matches.slice(0, 8).map((match) => (
                <article key={match.gameId} className="match-row">
                  <div><strong>#{match.rank}</strong><span>{match.mode}</span></div>
                  <div className="participant-grid">
                    {match.participants.map((player) => (
                      <span key={player.nickname}>
                        {player.nickname} · {player.characterName} · {player.kills}/{player.assists}/{player.deaths} · {player.damageToPlayer.toLocaleString()} 伤害
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="result-card">
        <div className="section-title"><BarChart3 size={18} /><h2>玩家对比</h2></div>
        <div className="player-grid">
          {result.players.map((player) => (
            <article className="player-card" key={player.nickname}>
              <h3>{player.nickname}</h3>
              <p className="muted">样本 {player.sampleCount} 场，排除钴协议 {player.excludedCobaltCount} 场</p>
              <div className="mini-metrics">
                <Metric label="均名次" value={player.summary.avgRank} />
                <Metric label="KDA" value={player.summary.kda} />
                <Metric label="均伤害" value={Math.round(player.summary.avgDamageToPlayer)} />
                <Metric label="均视野" value={Math.round(player.summary.avgVisionContribution)} />
              </div>
              <p className="muted">常用角色：{player.characters.slice(0, 3).map((item) => `${item.name} ${item.games}场`).join(" / ") || "-"}</p>
            </article>
          ))}
        </div>
        <ul className="role-notes">
          {result.comparison.roleNotes.map((note) => <li key={note}>{note}</li>)}
        </ul>
      </section>

      <section className="result-card ai-card">
        <div className="section-title"><Brain size={18} /><h2>AI 复盘</h2></div>
        {result.warning && <p className="warning">{result.warning}</p>}
        <p className="ai-text">{result.aiReview || "AI 复盘暂不可用，规则指标已展示。"}</p>
      </section>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
```

- [ ] **Step 2: Replace `src/styles.css` with dashboard styles**

`src/styles.css`:

```css
:root {
  color: #eef2ff;
  background: #070a11;
  font-family: Inter, "Noto Sans SC", "PingFang SC", system-ui, sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
}

button,
input {
  font: inherit;
}

.app-shell {
  min-height: 100vh;
  padding: 22px;
  background:
    radial-gradient(circle at 18% 12%, rgba(14, 165, 233, 0.17), transparent 28%),
    radial-gradient(circle at 78% 8%, rgba(168, 85, 247, 0.14), transparent 26%),
    linear-gradient(180deg, #111827 0%, #070a11 72%);
}

.topbar,
.input-panel,
.results {
  width: min(1120px, 100%);
  margin: 0 auto;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.eyebrow {
  margin: 0 0 7px;
  color: #67e8f9;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0;
}

h1,
h2,
h3,
p {
  margin-top: 0;
}

h1 {
  margin-bottom: 0;
  font-size: clamp(28px, 4vw, 42px);
  line-height: 1.12;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  white-space: nowrap;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 999px;
  padding: 8px 12px;
  color: #cbd5e1;
  background: rgba(15, 23, 42, 0.72);
}

.input-panel,
.result-card,
.error-panel {
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.83);
  box-shadow: 0 16px 50px rgba(0, 0, 0, 0.24);
}

.input-panel {
  padding: 22px;
}

.panel-heading,
.section-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.panel-heading h2,
.section-title h2 {
  margin: 0;
  font-size: 18px;
}

.panel-heading p {
  margin: 5px 0 0;
  color: #94a3b8;
}

.count-switch {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin: 18px 0;
  padding: 6px;
  border-radius: 8px;
  background: rgba(2, 6, 23, 0.55);
}

.count-switch button {
  min-height: 42px;
  border: 0;
  border-radius: 6px;
  color: #94a3b8;
  background: transparent;
  cursor: pointer;
}

.count-switch button.active {
  color: #ffffff;
  background: linear-gradient(135deg, #2563eb, #0891b2);
}

.name-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 10px;
  margin-bottom: 16px;
}

.name-field {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr);
  align-items: center;
  min-height: 54px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 8px;
  background: rgba(2, 6, 23, 0.45);
  overflow: hidden;
}

.name-field span {
  display: grid;
  place-items: center;
  height: 100%;
  color: #67e8f9;
  font-weight: 800;
  background: rgba(14, 165, 233, 0.08);
}

.name-field input {
  min-width: 0;
  height: 100%;
  border: 0;
  outline: 0;
  padding: 0 12px;
  color: #eef2ff;
  background: transparent;
}

.primary-button {
  width: 100%;
  min-height: 48px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 0;
  border-radius: 8px;
  color: white;
  background: linear-gradient(135deg, #2563eb, #0891b2);
  font-weight: 800;
  cursor: pointer;
}

.primary-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.helper,
.muted {
  color: #94a3b8;
}

.helper {
  margin: 12px 0 0;
  font-size: 13px;
}

.error-panel {
  width: min(1120px, 100%);
  margin: 14px auto 0;
  padding: 14px;
  color: #fecaca;
  background: rgba(127, 29, 29, 0.45);
}

.results {
  display: grid;
  gap: 14px;
  margin-top: 14px;
}

.summary-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.metric {
  min-width: 0;
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 8px;
  padding: 12px;
  background: rgba(15, 23, 42, 0.78);
}

.metric span {
  display: block;
  margin-bottom: 6px;
  color: #94a3b8;
  font-size: 12px;
}

.metric strong {
  display: block;
  overflow-wrap: anywhere;
  font-size: 18px;
}

.result-card {
  padding: 18px;
}

.result-card.primary {
  border-color: rgba(103, 232, 249, 0.3);
}

.lead-metric {
  margin: 12px 0;
  color: #dbeafe;
  font-weight: 700;
}

.match-list {
  display: grid;
  gap: 8px;
}

.match-row {
  display: grid;
  grid-template-columns: 90px minmax(0, 1fr);
  gap: 12px;
  align-items: start;
  border: 1px solid rgba(148, 163, 184, 0.14);
  border-radius: 8px;
  padding: 12px;
  background: rgba(2, 6, 23, 0.32);
}

.match-row strong,
.match-row span {
  display: block;
}

.participant-grid {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.participant-grid span {
  overflow-wrap: anywhere;
  color: #cbd5e1;
}

.player-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 10px;
  margin-top: 12px;
}

.player-card {
  border: 1px solid rgba(148, 163, 184, 0.14);
  border-radius: 8px;
  padding: 14px;
  background: rgba(2, 6, 23, 0.32);
}

.player-card h3 {
  margin-bottom: 6px;
}

.mini-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin: 12px 0;
}

.role-notes {
  margin: 14px 0 0;
  padding-left: 20px;
  color: #cbd5e1;
}

.warning {
  color: #fde68a;
}

.ai-text {
  margin-bottom: 0;
  color: #dbeafe;
  line-height: 1.75;
  white-space: pre-wrap;
}

@media (max-width: 720px) {
  .app-shell {
    padding: 16px;
  }

  .topbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .summary-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .match-row {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 3: Build the UI**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 4: Commit UI**

```bash
git add src/App.tsx src/styles.css
git commit -m "feat: build multiplayer analysis UI" -m "Co-authored-by: TRAE CLI <noreply@bytedance.com>"
```

---

### Task 10: Documentation And End-To-End Verification

**Files:**
- Create: `README.md`
- Modify: `.dev.vars.example`

**Interfaces:**
- Consumes: all earlier app scripts.
- Produces: setup instructions and verified local workflow.

- [ ] **Step 1: Write README**

`README.md`:

```md
# 永恒轮回组队复盘

Cloudflare Pages app for analyzing 1-3 Eternal Return players. It fetches DAKGG match data, excludes Cobalt Protocol, compares shared team matches, and uses DeepSeek for Chinese coaching-style analysis.

## Local Setup

```bash
npm install
cp .dev.vars.example .dev.vars
```

If your shell already has `DEEPSEEK_API_KEY`, create local Pages secrets with:

```bash
printf 'DEEPSEEK_API_KEY=%s\nDEFAULT_SEASON=SEASON_21\nDEEPSEEK_BASE_URL=https://api.deepseek.com\n' "$DEEPSEEK_API_KEY" > .dev.vars
```

Otherwise fill `.dev.vars` manually:

```text
DEEPSEEK_API_KEY=your-key
DEFAULT_SEASON=SEASON_21
DEEPSEEK_BASE_URL=https://api.deepseek.com
```

## Development

```bash
npm run dev
```

For Pages Functions:

```bash
npm run pages:dev
```

## Verification

```bash
npm test
npm run build
```

## Cloudflare Pages

Build command:

```bash
npm run build
```

Build output directory:

```text
dist
```

Required environment variable:

```text
DEEPSEEK_API_KEY
```
```

- [ ] **Step 2: Run full tests**

Run: `npm test`

Expected: PASS for all Vitest suites.

- [ ] **Step 3: Run production build**

Run: `npm run build`

Expected: PASS and `dist/` exists.

- [ ] **Step 4: Run local Pages dev server**

Run: `npm run pages:dev`

Expected: Wrangler starts a local Pages server. Use the printed URL for manual verification.

- [ ] **Step 5: Manual smoke test**

Open the local Pages URL.

Test cases:

- Submit one nickname: `Ptlantern`.
- Submit two nicknames if a known teammate nickname is available.
- Submit empty nickname form and verify validation error.
- Temporarily remove `DEEPSEEK_API_KEY` from `.dev.vars` and verify metrics render with an AI unavailable warning.

- [ ] **Step 6: Commit docs**

```bash
git add README.md .dev.vars.example
git commit -m "docs: add setup and deployment notes" -m "Co-authored-by: TRAE CLI <noreply@bytedance.com>"
```

---

## Self-Review

Spec coverage:

- Cloudflare Pages static frontend plus Pages Function backend is covered by Tasks 1 and 8.
- DAKGG current season, characters, and match fetching are covered by Task 6.
- Cobalt exclusion, less-than-20 behavior, and recent sample rules are covered by Task 3.
- Shared `gameId + teamNumber` matching and lower-confidence fallback are covered by Task 4.
- Metrics and comparison are covered by Task 5.
- DeepSeek compact prompting and server-side key handling are covered by Task 7.
- Multiplayer-first UI is covered by Task 9.
- Setup and verification are covered by Task 10.

Placeholder scan:

- No `TBD`, empty implementation steps, or undefined function names are used.

Type consistency:

- `DakggMatch`, `PlayerMatchSample`, `SharedMatchResult`, `SharedSummary`, `ServerEnv`, and `AnalyzeRequest` are introduced before they are consumed.
