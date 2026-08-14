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
