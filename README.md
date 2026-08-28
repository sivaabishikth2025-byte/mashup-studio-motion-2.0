# Infinite Mashup Studio Motion 2.0

Showcase evolution of [Infinite Mashup Studio](https://infinite-mashup-studio.netlify.app). The original weekend-challenge app and GitHub repo are **left unchanged**.

Motion 2.0 keeps the full fuse pipeline — ingredients → illustration → dossier → spoken origin — and adds **story-driven video** plus an **original AI score**.

## What is new in 2.0

- **Story-length motion reels** — Nova reads the origin story, plans cinematic beats, and Nova Reel renders ~6 seconds per beat (up to ~36s total)
- **Still + Motion UI** — the illustration always stays visible; video plays in a separate Motion panel
- **Original AI score** — Nova picks tempo/key/mood; a synthesizer renders a unique WAV matched to clip length
- **Motion styles:** cinematic, playful, ominous
- **Download** PNG, MP4, and score WAV
- **Origin voice picker** (Polly neural)
- Gallery **Video** badge when a reel exists

## Architecture

| Stack | Purpose |
|---|---|
| Original Mashup API | Fuse, jobs, gallery (unchanged) |
| `mashup-studio-motion` SAM stack | Video (`/mashups/{id}/video`), score, narration |

## Deploy the Motion stack

```bash
cd infra
sam build
sam deploy --guided --stack-name mashup-studio-motion
```

Enable **Amazon Nova Reel** (`amazon.nova-reel-v1:1`) in Bedrock (us-east-1).

## Local dev

```bash
cp env.example .env.local
# Set FUSE_API_URL (original Mashup API) and VIDEO_API_URL (Motion API)
npm install
npm run dev
```

See `SHOWCASE_ARTICLE.md` for the full Builder Center write-up (`#application`).

## Links

- **This repo:** https://github.com/sivaabishikth2025-byte/mashup-studio-motion-2.0
- **Original app:** https://infinite-mashup-studio.netlify.app
- **Original repo:** https://github.com/sivaabishikth2025-byte/infinite-mashup-studio
