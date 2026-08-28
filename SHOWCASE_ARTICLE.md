# Weekend Showcase Challenge: Infinite Mashup Studio Motion 2.0

**Tag:** `#application`

**Builder tag:** @[your builder handle here]

---

## Vision and what it does

Infinite Mashup Studio was my summer creative challenge: pick two to five ingredients, fuse one invention that should not exist, and walk away with a painted illustration, a full dossier, and a spoken origin story. It worked. People loved the stills. What it did not do was *move*.

**Infinite Mashup Studio Motion 2.0** is the answer to that gap — without replacing what already shipped. The still image stays front and center. The origin story still drives the lore. What is new is a second act: press **Animate** and Nova Reel turns the illustration plus the written origin into a **story-length motion reel**, not a generic six-second loop.

The problem I kept hearing was familiar from every “AI art” demo: you get a pretty picture and a wall of text, but nothing feels like a finished artifact. Mashup Studio already fixed the text problem by grounding Nova Pro’s dossier in the actual PNG (the model sees the image, not just the ingredient list). Motion 2.0 extends that pipeline into time. Nova Lite reads your origin story, splits it into cinematic beats, and Nova Reel shoots one six-second clip per beat — so a longer origin becomes a longer film, up to roughly thirty-six seconds. An original AI score is composed to match that length: Nova picks tempo, key, and mood; a small synthesizer renders a unique WAV with no licensed samples.

How you use it: compose chips (or upload photos), hit **Fuse**, wait for the illustration and dossier, listen to Polly read the origin, then choose a motion style — cinematic, playful, or ominous — and animate. Download the PNG, MP4, and score separately. Swap the origin voice without re-fusing. The gallery shows a **Video** badge when a reel exists.

The original Infinite Mashup Studio app, repo, and AWS stack remain frozen until that challenge’s results are posted. Motion 2.0 is a separate codebase, a separate SAM stack (`mashup-studio-motion`), and a deliberate fork so judges can see an evolution, not a rewrite.

---

## How you built it

I copied the studio into a new folder and refused to touch the creative-challenge GitHub history. The fuse path is unchanged in spirit: API Gateway accepts a fuse request, returns a `jobId`, and a Lambda worker paints the PNG (Stability / Gemini), writes the dossier with Nova Pro via Converse (image bytes in the prompt), synthesizes origin audio with Polly, and stores assets in S3 with metadata in DynamoDB.

Video does not belong inside that same long-running paint job. Nova Reel is asynchronous — `StartAsyncInvoke` and `GetAsyncInvoke` — and multi-beat stories can take several minutes. So **Animate** is a second job on a dedicated Motion API (`VIDEO_API_URL`). The frontend always shows the still; the Motion panel polls until `videoStatus` is `COMPLETE`.

Key implementation details:

- **Story beats:** Nova Lite returns a JSON shot list from the origin text. One Reel shot per beat (~forty words), capped at six shots. Single beat uses `TEXT_VIDEO`; multiple beats use `MULTI_SHOT_MANUAL` with the same 1280×720 keyframe.
- **S3 output:** Nova Reel is strict about output URIs — the destination must be `s3://bucket/` or `s3://bucket/prefix/` with a trailing slash. Bedrock writes under `videos/{invocation-id}/output.mp4`; the worker copies to `mashups/{id}.mp4` for public playback.
- **Cross-stack mashups:** Fuses can still run on the original API. The Motion stack accepts the full mashup payload on `POST /mashups/{id}/video` so you can animate inventions created before the fork.
- **Original score:** `lambda/score.py` asks Nova for musical parameters, then renders WAV procedurally — no copyrighted recordings.
- **Fail closed:** If illustration generation fails, there is no dossier theater. If Reel fails, `videoError` surfaces in the UI instead of a silent spinner.

Challenges worth naming: Reel only accepts 1280×720 RGB PNG keyframes; IAM must allow `bedrock.amazonaws.com` to `PutObject` under `videos/*`; regenerating a clip must clear the previous invocation ARN or the UI sticks on PENDING.

---

## AWS services used and architecture overview

| Service | Role |
|---|---|
| Amazon API Gateway (HTTP API) | `/fuse`, `/jobs`, `/mashups`, `/mashups/{id}/video`, `/mashups/{id}/narrate` |
| AWS Lambda | Fuse worker, Nova Reel poller, digest |
| Amazon Bedrock | Stability / Gemini (still), Nova Pro (dossier from PNG), Nova Lite (story beats + score recipe), **Nova Reel** (video) |
| Amazon S3 | PNG, MP3, MP4, WAV, Reel output prefix |
| Amazon DynamoDB | Jobs, mashups, `videoStatus`, `videoInvocationArn`, `videoBeats` |
| Amazon Polly | Origin narration + voice remake |
| Amazon Translate | Dossier languages |
| Amazon Cognito | User accounts |
| AWS SAM / CloudFormation | Stack `mashup-studio-motion` |

```text
Browser --POST /fuse--> Original API --> Lambda worker
  paint PNG --> Nova Pro (image in Converse) --> Polly --> S3 + DynamoDB

Browser --POST /mashups/{id}/video--> Motion API --> Lambda
  Nova Lite story beats --> resize PNG 1280x720
  --> Bedrock StartAsyncInvoke (Nova Reel, MULTI_SHOT_MANUAL)
  --> poll GetAsyncInvoke --> copy output.mp4 --> mashups/{id}.mp4
  --> Nova score recipe --> synthesizer WAV
```

Motion API (deployed): `https://bmtgkqtxz2.execute-api.us-east-1.amazonaws.com`

---

## What I learned across the summer

PricePilot taught me that a model call is not a product until timeouts, JSON contracts, and retry paths are honest. Sift taught me schedules and memory change the job from “click generate” to “it already ran.” Mashup Studio taught me creative AWS work is a pipeline: pixels first, language grounded in those pixels, audio third.

Motion 2.0 added a fourth lesson: **do not ship motion as a replacement for the still.** Users want the poster *and* the trailer. It also reinforced something operational — Bedrock’s async video API has sharp edges (S3 URI validation, invocation folders, multi-minute polls) that belong in a separate stack, not bolted onto a fuse worker that already has ninety seconds of work to do.

The showcase meta-lesson: when an entry is still being judged, fork the product. New repo, new stack, new URL. Let the original stand on its own merit.

---

## Links

- **Motion 2.0 repo:** https://github.com/sivaabishikth2025-byte/mashup-studio-motion-2.0
- **Motion API:** https://bmtgkqtxz2.execute-api.us-east-1.amazonaws.com
- **Original app (untouched):** https://infinite-mashup-studio.netlify.app
- **Original repo (untouched):** https://github.com/sivaabishikth2025-byte/infinite-mashup-studio

To run the UI locally: clone the Motion 2.0 repo, copy `env.example` to `.env.local`, set `FUSE_API_URL` to the original Mashup API and `VIDEO_API_URL` to the Motion API, then `npm install && npm run dev`.

---

*Word count: ~780*
