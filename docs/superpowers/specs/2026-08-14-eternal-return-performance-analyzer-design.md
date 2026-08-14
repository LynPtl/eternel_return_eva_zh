# Eternal Return Performance Analyzer Design

## Goal

Build a Cloudflare Pages web app that analyzes Eternal Return match history for 1 to 3 player nicknames. The app focuses on multiplayer shared-match analysis first, then individual performance, and uses DeepSeek to generate a Chinese coaching-style review.

The first version should be usable without account login, persistent storage, or union-team data. Users type nicknames, run analysis, and receive structured metrics plus an AI summary.

## Scope

The app will analyze up to 3 players at a time.

For each player, the backend fetches recent matches from DAKGG using the current season and all match modes:

```text
GET https://er.dakgg.io/api/v1/players/{nickname}/matches?season={season}&matchingMode=ALL&teamMode=ALL&page={page}
```

The sample rule is:

- Exclude Cobalt Protocol matches where `matchingMode === 6`.
- Keep up to the latest 20 non-Cobalt matches per player.
- If fewer than 20 non-Cobalt matches are available, analyze all available matches.
- Continue paging while useful data is still available, with a practical max-page guard to avoid runaway requests.
- Report both the analyzed sample count and excluded Cobalt count.

The current season is loaded from:

```text
GET https://er.dakgg.io/api/v1/data/seasons?hl=zh-CN
```

Use the season whose `isCurrent` field is true. If this lookup fails, fall back to a configured default season.

Character names are loaded from:

```text
GET https://er.dakgg.io/api/v1/data/characters?hl=zh-CN
```

## Non-Goals

- Do not use `union-teams`.
- Do not require user login.
- Do not store long-term player history in the first version.
- Do not include Cobalt Protocol in performance metrics.
- Do not send full raw DAKGG match JSON to DeepSeek.

## Architecture

Use Cloudflare Pages with a static frontend and Pages Functions backend.

Frontend:

- Single-page app.
- First screen is the analyzer tool itself.
- Inputs for 1 to 3 nicknames.
- One primary analyze button.
- Results split into overview, shared matches, per-player metrics, comparison, and AI review.

Backend:

- `POST /api/analyze`
- Validates nicknames and query shape.
- Fetches current season and static character mapping.
- Fetches each player's recent matches.
- Filters Cobalt Protocol.
- Computes metrics.
- Calls DeepSeek using a server-side environment variable.
- Returns structured metrics and AI text.

Secrets:

- `DEEPSEEK_API_KEY` is stored as a Cloudflare Pages environment variable.
- The browser never receives the API key.

## Data Model

Request:

```json
{
  "players": ["Ptlantern", "TeammateA", "TeammateB"]
}
```

Response:

```json
{
  "season": {
    "key": "SEASON_21",
    "name": "赛季 S12"
  },
  "players": [
    {
      "nickname": "Ptlantern",
      "sampleCount": 20,
      "excludedCobaltCount": 2,
      "summary": {
        "avgRank": 3.4,
        "wins": 5,
        "kills": 20,
        "assists": 48,
        "deaths": 15,
        "avgDamageToPlayer": 15000,
        "avgDamageFromPlayer": 9000,
        "avgMonsterKill": 55,
        "avgVisionContribution": 30,
        "avgCcTime": 80
      },
      "characters": [
        {
          "characterNum": 12,
          "name": "慧珍",
          "games": 8
        }
      ]
    }
  ],
  "shared": {
    "matchCount": 6,
    "matches": [
      {
        "gameId": 63754510,
        "startDtm": "2026-08-14T03:29:06.006+0900",
        "mode": "普通",
        "rank": 1,
        "participants": [
          {
            "nickname": "Ptlantern",
            "characterName": "埃琳娜",
            "kills": 1,
            "assists": 11,
            "deaths": 1,
            "damageToPlayer": 12040
          }
        ]
      }
    ],
    "summary": {
      "avgRank": 2.8,
      "wins": 2,
      "avgTeamKill": 14
    }
  },
  "comparison": {
    "damageLeader": "PlayerA",
    "survivalRisk": "PlayerB",
    "visionLeader": "PlayerC",
    "roleNotes": [
      "PlayerA tends to carry damage.",
      "PlayerB tends to absorb more pressure."
    ]
  },
  "aiReview": "中文复盘文本"
}
```

The implementation should keep this top-level response shape. Additional derived fields are allowed, but the frontend must render from structured fields and must not parse prose to recover metrics.

## Metric Rules

Individual metrics:

- Average rank.
- Win count and top-three count.
- Kills, assists, deaths, and KDA-like ratio.
- Average player damage and damage taken.
- Average monster kills and monster damage.
- Average camera placement, console usage, and view contribution.
- Average credit gain and credit use.
- Average crowd-control time.
- Character pool frequency using Chinese names.
- Mode split for Normal and Ranked.

Shared-match metrics:

- Intersect players by `gameId` and require matching `teamNumber` when every compared player has team data for that game.
- If `teamNumber` is missing for any compared record, fall back to `gameId` intersection and mark the shared-match confidence as lower.
- Only use matches that remain after Cobalt filtering.
- If there are no shared matches, still show individual metrics and ask DeepSeek to avoid making team synergy claims.
- For shared matches, compare each player's role by damage, damage taken, deaths, vision, control, and farming.
- Treat shared-match analysis as the primary product value: surface team rhythm, complementary roles, pressure distribution, and concrete duo/trio improvement advice before generic personal summaries.

Mode labels:

- `matchingMode === 2`: 普通
- `matchingMode === 3`: 排位
- `matchingMode === 6`: 钴协议, excluded
- Unknown values: 其他模式

## DeepSeek Prompting

The backend sends a compact JSON summary to DeepSeek, not raw match payloads.

The AI should answer in Chinese and cover:

- Overall recent form.
- Shared-match performance when there are shared matches.
- Each player's likely role tendency.
- Strengths.
- Concrete problems.
- Practical improvement suggestions for the next games.

The system prompt should explicitly say:

- Do not overclaim if shared-match sample size is small.
- Do not judge Cobalt Protocol because it was excluded.
- Mention sample size.
- Keep advice practical and tied to metrics.

## Error Handling

Frontend states:

- Idle.
- Loading.
- Partial result.
- Error.

Backend errors:

- Invalid request: return 400 with a clear message.
- Nickname not found or DAKGG failure for one player: return a per-player error.
- DAKGG timeout or rate limit: return a retryable error message.
- DeepSeek failure: return computed metrics with `aiReview` empty and an AI unavailable warning.
- No analyzed matches: explain that no non-Cobalt matches were available.

## UX

The page should feel like a focused multiplayer match-analysis tool, not a landing page.

Use `adina-lab.com` as a functional reference, not as a strict frontend style reference:

- Tool-first layout.
- A prominent input panel near the top.
- Clear 1 / 2 / 3 player analysis selection.
- Numbered nickname inputs so users understand the 1 to 3 player order.
- Clear helper text about sample rules, including Cobalt Protocol exclusion.
- Result sections that emphasize shared-match analysis, team comparison, and AI coaching.

Do not copy Korean copy, branding, exact visual assets, or overall visual styling. The app should be Chinese-first and should use its own product name and visual identity.

Layout:

- Top compact form band with nickname inputs and analyze button.
- Summary strip showing season, sample counts, excluded Cobalt counts, shared-match count, and shared-match confidence.
- Shared match analysis section as the primary result area.
- Per-player comparison section.
- AI review section.

Design style:

- Dense but readable.
- Use a dark, game-adjacent palette with restrained accents and clear metric grouping.
- Use stable card/table dimensions so loading and results do not jump.
- Avoid decorative hero sections.
- Avoid oversized gradients or purely decorative effects that reduce readability.

## Testing And Verification

Implementation should include:

- Unit tests for match filtering and aggregation.
- Unit tests for shared `gameId` intersection.
- Unit tests for Cobalt exclusion and less-than-20 sample behavior.
- Manual local test with `Ptlantern`.
- Manual test with two or three nicknames if available.
- DeepSeek failure simulation to verify metrics still render.

## Deployment

Use Cloudflare Pages.

Required environment variable:

```text
DEEPSEEK_API_KEY
```

The first version does not require KV, D1, R2, or Durable Objects.
