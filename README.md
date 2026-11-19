# AniWalls Bot

High-resolution wallpaper search Telegram bot and API powered by Cloudflare Workers and Cloudflare D1.

## Features

- Multi-criteria wallpaper search with resolution filters (1080p, 2K, 4K, 8K)
- Aspect ratio matching (16:9, 21:9 ultrawide, 9:16 vertical, 1:1 square)
- Normalized metadata: original image URL, source post URL, verified artist link
- Original file download with SSRF protection and Telegram file caching
- Per-user favorites persistence in Cloudflare D1
- Search history tracking with deduplication and pruning

## Tech Stack

- Cloudflare Workers (TypeScript)
- Hono web framework
- Cloudflare D1 (SQLite)
- Vitest

## Local Setup

```bash
# Install dependencies
npm install

# Run database migrations locally
npm run d1:migrate:local

# Run tests
npm test

# Run type check
npm run typecheck
```

## Remote Database Migration

```bash
npx wrangler d1 migrations apply aniwalls-db --remote
```

## Deployment

```bash
npx wrangler deploy
```

## License

MIT
