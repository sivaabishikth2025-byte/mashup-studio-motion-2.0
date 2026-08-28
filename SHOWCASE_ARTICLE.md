# Weekend Showcase Challenge: Infinite Mashup Studio Motion 2.0

**Tag:** `#application`

**Builder tag:** @[your builder handle here]

---

## This is not where the story started

I submitted **Infinite Mashup Studio** to the AWS Creative App Challenge first — ingredients in, illustrated invention out, dossier written from the actual PNG, origin read aloud by Polly. That version shipped. It worked. Judges are still reviewing it, so the original repo and stack stay frozen.

Motion 2.0 is what happened *after* I hit submit and kept thinking: **the invention still feels frozen.**

The still image is the poster. The origin story is the lore. But neither one *moves*. The idea for this showcase entry came directly from that gap — not from bolting video onto a different project, but from asking what the *same* studio would look like if the invention could come alive on screen.

```
  v1 (Creative Challenge)              v2 (Weekend Showcase)
  ───────────────────────              ───────────────────────
  [ chips ] ──► FUSE ──► PNG         [ chips ] ──► FUSE ──► PNG  (same)
                    │                                      │
                    ▼                                      ▼
              Nova Pro dossier                       Nova Pro dossier
                    │                                      │
                    ▼                                      ▼
              Polly origin audio                       Polly origin audio
                    │                                      │
                    ▼                                      ▼
                 THE END                            [ Animate ] ──► MP4
                                                         │
                                                         ▼
                                                   AI score (WAV)
```

---

## What changed from version 1 → Motion 2.0

| | **v1 — Infinite Mashup Studio** | **v2 — Motion 2.0** |
|---|---|---|
| **Output** | Still PNG + dossier + MP3 | Still PNG + dossier + MP3 **+ story video + score** |
| **Story role** | Text on the page | Text drives **shot list** for Nova Reel |
| **Video length** | — | ~6 seconds per story beat (up to ~36s) |
| **UI** | One result panel | Still **always visible** + separate Motion panel |
| **Music** | — | Original AI score synced to clip length |
| **AWS stack** | `infinite-mashup-studio` | New stack: `mashup-studio-motion` |
| **Repo** | Frozen until challenge results | New repo, original untouched |

Version 1 proved the creative loop. Version 2 adds a **time dimension** without throwing away anything that already worked.

---

## Vision and what it does

**The problem:** Most AI art demos give you a pretty picture and a paragraph. Mashup Studio already fixed the credibility problem — Nova Pro writes the dossier *from the illustration*, not from a wish list of ingredients. But after you read the origin story, the invention still sits still on the screen like a museum label next to a painting.

**The solution:** Infinite Mashup Studio Motion 2.0 keeps the full fuse pipeline and adds a second act. Press **Animate** and the origin story becomes a motion reel: Nova Lite reads the story, plans cinematic beats, and Nova Reel renders one six-second shot per beat. A longer origin produces a longer film. An original score is composed to match — Nova picks tempo, key, and mood; a synthesizer renders a unique WAV with no licensed samples.

**How it works end-to-end:**

```
  YOU                    STUDIO                         AWS
  ───                    ──────                         ───

  Pick 2–5 chips  ──►  POST /fuse  ──►  Lambda worker
  (or photos)              │              ├─ paint PNG (Stability / Gemini)
                           │              ├─ dossier (Nova Pro + image bytes)
                           │              ├─ origin audio (Polly)
                           │              └─ store S3 + DynamoDB
                           ▼
                    Still + dossier + Listen
                           │
  Choose style      ──►  POST /mashups/{id}/video
  Click Animate          │
                           ├─ Nova Lite → story beats (JSON)
                           ├─ resize PNG → 1280×720 keyframe
                           ├─ Nova Reel StartAsyncInvoke
                           ├─ poll GetAsyncInvoke
                           ├─ copy output.mp4 → public URL
                           └─ compose AI score WAV
                           ▼
                    Motion panel plays MP4 + score
```

You can download the PNG, MP4, and score separately. Swap the Polly voice without re-fusing. The gallery shows a **Video** badge when a reel exists.

---

## How you built it

I copied the studio into a new folder and refused to touch the creative-challenge Git history. The fuse path is unchanged in spirit: API Gateway returns a `jobId`, a Lambda worker paints, invents, narrates, and stores assets.

Video does **not** ride inside that same paint job. Nova Reel is async and multi-beat stories can take several minutes. So **Animate** is a second job on a dedicated Motion API (`VIDEO_API_URL`). The frontend always shows the still; the Motion panel polls until `videoStatus` is `COMPLETE`.

### Key code: story beats drive video length

Nova Lite splits the origin into a shot list. One Reel clip per beat — not a fixed six-second loop:

```python
def target_shot_count(text: str, max_shots: int = 6) -> int:
    words = len(text.split())
    # One 6-second Nova Reel shot per ~40 words of origin story.
    return max(1, min(max_shots, (words + 39) // 40))

def _nova_story_beats(record: dict, shot_count: int) -> list[str]:
    prompt = (
        f"You are a film director animating an invention called {name}.\n"
        f"Origin story:\n{story}\n\n"
        f"Split this into exactly {shot_count} visual beats..."
    )
    resp = bedrock.converse(modelId=TEXT_MODEL, messages=[...])
    # Returns {"beats": ["shot one", "shot two", ...]}
```

Single beat → `TEXT_VIDEO`. Multiple beats → `MULTI_SHOT_MANUAL` with the same illustration as keyframe for every shot.

### Key code: Nova Reel async invoke

```python
invocation = bedrock.start_async_invoke(
    modelId="amazon.nova-reel-v1:1",
    modelInput=model_input,
    outputDataConfig={
        "s3OutputDataConfig": {
            "s3Uri": f"s3://{bucket}/videos/"  # trailing slash required!
        }
    },
)
```

### Decisions and challenges

- **Fork, don't overwrite.** Original challenge entry stays intact. New repo, new SAM stack, new Netlify URL.
- **Still + Motion, not still *or* motion.** Users want the poster and the trailer.
- **Separate stacks.** Fuse on the original API; video on `mashup-studio-motion`. Cross-stack animate accepts the full mashup payload so older inventions can still be animated.
- **S3 URI sharp edge.** Nova Reel rejects `s3://bucket/videos` (no slash). It accepts `s3://bucket/videos/`. Bedrock writes to `videos/{invocation-id}/output.mp4`; the worker copies to `mashups/{id}.mp4`.
- **Fail closed.** No illustration → no dossier theater. Reel failure → `videoError` in the UI, not a silent spinner.

---

## AWS services and architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Infinite Mashup Studio Motion 2.0               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌──────────┐    ┌─────────────────┐    ┌─────────────────────────┐  │
│   │ Next.js  │───►│ API Gateway     │───►│ Lambda (fuse worker)    │  │
│   │ UI       │    │ (original stack)│    │ Stability / Gemini PNG  │  │
│   │ Netlify  │    └─────────────────┘    │ Nova Pro dossier        │  │
│   │          │                           │ Polly MP3               │  │
│   │          │    ┌─────────────────┐    └───────────┬─────────────┘  │
│   │          │───►│ API Gateway     │───►│ Lambda (motion)         │  │
│   │          │    │ (motion stack)  │    │ Nova Lite story beats   │  │
│   └──────────┘    └─────────────────┘    │ Nova Reel async video   │  │
│                                            │ Score synthesizer       │  │
│                                            └───────────┬─────────────┘  │
│                                                        │                │
│                    ┌───────────────────────────────────┼────────────┐   │
│                    ▼                   ▼                 ▼            ▼   │
│              ┌──────────┐      ┌────────────┐   ┌──────────┐  ┌──────┐ │
│              │ S3       │      │ DynamoDB   │   │ Cognito  │  │Polly │ │
│              │ PNG MP4  │      │ jobs       │   │ users    │  │Trans │ │
│              │ MP3 WAV  │      │ mashups    │   └──────────┘  └──────┘ │
│              └──────────┘      └────────────┘                         │
│                                                                         │
│              ┌──────────────────────────────────────────────────────┐   │
│              │ Amazon Bedrock                                     │   │
│              │ Nova Pro · Nova Lite · Nova Reel · Stability       │   │
│              └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

| Service | Role |
|---|---|
| **Amazon API Gateway** (HTTP API) | `/fuse`, `/jobs`, `/mashups`, `/mashups/{id}/video`, `/mashups/{id}/narrate` |
| **AWS Lambda** | Fuse worker, Nova Reel poller, daily digest |
| **Amazon Bedrock** | Stability/Gemini (still), Nova Pro (dossier from PNG), Nova Lite (beats + score), **Nova Reel** (video) |
| **Amazon S3** | PNG, MP3, MP4, WAV, Reel output prefix |
| **Amazon DynamoDB** | Jobs, mashups, `videoStatus`, `videoInvocationArn`, `videoBeats` |
| **Amazon Polly** | Origin narration + voice remake |
| **Amazon Translate** | Dossier in 10 languages |
| **Amazon Cognito** | User accounts and private gallery |
| **AWS SAM / CloudFormation** | Stack `mashup-studio-motion` |

---

## What I learned across the summer

**PricePilot** taught me a model call is not a product until JSON contracts, timeout splits, and retry paths are honest.

**Sift** taught me schedules and memory change the job from “click generate” to “it already ran.”

**Mashup Studio (v1)** taught me creative work on AWS is a pipeline: **pixels first**, then language grounded in those pixels, then audio.

**Motion 2.0** added a fourth beat: **time**. And a rule I will keep — never ship motion as a replacement for the still. Users want both.

The meta-lesson from this showcase: when an entry is still being judged, **fork the product**. New repo, new stack, new URL. Let version 1 stand on its own merit while version 2 shows where you are going next.

---

## Links

| | URL |
|---|---|
| **Live app (Motion 2.0)** | https://main.d2almtxm5nt63u.amplifyapp.com |
| **GitHub repo (Motion 2.0)** | https://github.com/sivaabishikth2025-byte/mashup-studio-motion-2.0 |
| **Motion API** | https://bmtgkqtxz2.execute-api.us-east-1.amazonaws.com |
| **Original app (v1, untouched)** | https://infinite-mashup-studio.netlify.app |
| **Original repo (v1, untouched)** | https://github.com/sivaabishikth2025-byte/infinite-mashup-studio |

---

*Replace `@[your builder handle here]` above with the AWS builder who inspired you before publishing.*

*Word count: ~1,050*
