"""Nova Reel story video for Mashup Studio Motion.

The still illustration stays. Video is generated FROM the origin story.
Length is 6 seconds per story beat (Nova Reel shot length), so a longer
origin produces a longer clip — not a fixed 6-second loop.
"""
from __future__ import annotations

import base64
import io
import json
import os
import random
import re
import time
import urllib.request

import boto3
from botocore.exceptions import ClientError
from PIL import Image

REGION = os.environ.get("AWS_REGION", "us-east-1")
BUCKET = os.environ["MASHUP_BUCKET"]
ASSET_BASE = os.environ["ASSET_BASE"].rstrip("/")
FUNCTION_NAME = os.environ.get("AWS_LAMBDA_FUNCTION_NAME")
REEL_MODEL = os.environ.get("VIDEO_MODEL_ID", "amazon.nova-reel-v1:1")
TEXT_MODEL = os.environ.get("TEXT_MODEL_ID", "amazon.nova-lite-v1:0")
MAX_SHOTS = int(os.environ.get("VIDEO_MAX_SHOTS", "6"))
VIDEO_OUTPUT_PREFIX = os.environ.get("VIDEO_OUTPUT_PREFIX", "videos")

MOTION_STYLES = {
    "cinematic": (
        "Slow cinematic camera orbit, dramatic rim lighting, subtle atmosphere, "
        "photoreal, one subject, no text, no watermark, no split screen."
    ),
    "playful": (
        "Playful bounce and sparkle, gentle camera push-in, whimsical motion, "
        "photoreal, one subject, no text, no watermark."
    ),
    "ominous": (
        "Slow low-angle push-in through fog, still then a twitch, threatening, "
        "photoreal, one subject, no text, no watermark."
    ),
}

VOICES = {"Ruth", "Matthew", "Joanna", "Danielle", "Stephen"}

bedrock = boto3.client("bedrock-runtime", region_name=REGION)
s3 = boto3.client("s3", region_name=REGION)
lam = boto3.client("lambda", region_name=REGION)
polly = boto3.client("polly", region_name=REGION)


def public_url(key: str) -> str:
    return f"{ASSET_BASE}/{key}"


def target_shot_count(text: str, max_shots: int = MAX_SHOTS) -> int:
    words = len(text.split())
    # One 6-second Nova Reel shot per ~40 words of origin story.
    return max(1, min(max_shots, (words + 39) // 40))


def _nova_story_beats(record: dict, shot_count: int) -> list[str]:
    origin = str(record.get("origin") or "").strip()
    tagline = str(record.get("tagline") or "").strip()
    name = str(record.get("name") or "The invention")
    story = origin or tagline or f"{name} comes to life."
    prompt = (
        f"You are a film director animating an invention called {name}.\n"
        f"Origin story:\n{story}\n\n"
        f"Split this into exactly {shot_count} visual beats for a short film. "
        "Each beat is one 6-second shot: concrete motion, camera, and atmosphere. "
        "Stay faithful to the story order. No dialogue, no on-screen text.\n"
        'Return ONLY JSON: {"beats":["shot one","shot two",...]}'
    )
    resp = bedrock.converse(
        modelId=TEXT_MODEL,
        messages=[{"role": "user", "content": [{"text": prompt}]}],
        inferenceConfig={"maxTokens": 900, "temperature": 0.35},
    )
    raw = ""
    for block in resp.get("output", {}).get("message", {}).get("content", []):
        if block.get("text"):
            raw += block["text"]
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if not match:
        return []
    payload = json.loads(match.group(0))
    beats = [str(b).strip() for b in payload.get("beats") or [] if str(b).strip()]
    if not beats:
        return []
    if len(beats) > shot_count:
        return beats[:shot_count]
    if len(beats) < shot_count:
        extra = story_beats_from_text(story, shot_count)
        for beat in extra:
            if beat not in beats:
                beats.append(beat)
            if len(beats) >= shot_count:
                break
    return beats[:shot_count]


def story_beats_from_text(text: str, max_shots: int = MAX_SHOTS) -> list[str]:
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]
    if not sentences:
        sentences = [text]
    n = target_shot_count(text, max_shots)
    if n >= len(sentences):
        return sentences[:max_shots]
    chunk = max(1, (len(sentences) + n - 1) // n)
    beats = []
    for i in range(0, len(sentences), chunk):
        beats.append(" ".join(sentences[i : i + chunk]))
    return beats[:max_shots]


def story_beats(record: dict, max_shots: int = MAX_SHOTS) -> list[str]:
    origin = str(record.get("origin") or "").strip()
    tagline = str(record.get("tagline") or "").strip()
    name = str(record.get("name") or "The invention")
    text = origin or tagline or f"{name} comes to life."
    shot_count = target_shot_count(text, max_shots)
    try:
        beats = _nova_story_beats(record, shot_count)
        if beats:
            return beats
    except Exception as err:
        print("nova_beats", err)
    return story_beats_from_text(text, max_shots)


def shot_prompt(record: dict, beat: str, style: str) -> str:
    motion = MOTION_STYLES.get(style) or MOTION_STYLES["cinematic"]
    name = str(record.get("name") or "the invention")
    prefix = f"{name}. "
    room = max(40, 510 - len(prefix) - len(motion))
    beat_part = beat[:room].rstrip()
    return f"{prefix}{beat_part} {motion}"[:512]


def reel_keyframe(png: bytes) -> bytes:
    im = Image.open(io.BytesIO(png)).convert("RGB")
    target_w, target_h = 1280, 720
    src_w, src_h = im.size
    scale = max(target_w / src_w, target_h / src_h)
    new_w, new_h = max(1, int(src_w * scale)), max(1, int(src_h * scale))
    im = im.resize((new_w, new_h), Image.Resampling.LANCZOS)
    left = max(0, (new_w - target_w) // 2)
    top = max(0, (new_h - target_h) // 2)
    im = im.crop((left, top, left + target_w, top + target_h))
    if im.size != (target_w, target_h):
        canvas = Image.new("RGB", (target_w, target_h), (7, 6, 14))
        canvas.paste(im, ((target_w - im.size[0]) // 2, (target_h - im.size[1]) // 2))
        im = canvas
    out = io.BytesIO()
    im.save(out, format="PNG")
    return out.getvalue()


def _png_from_mashup(record: dict) -> bytes:
    mashup_id = record["id"]
    try:
        obj = s3.get_object(Bucket=BUCKET, Key=f"mashups/{mashup_id}.png")
        return obj["Body"].read()
    except ClientError:
        pass
    url = str(record.get("imageUrl") or "")
    if not url:
        raise RuntimeError("No illustration to animate.")
    req = urllib.request.Request(url, headers={"User-Agent": "mashup-studio-motion/1.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read()


def _ddb_ok(value):
    from decimal import Decimal

    if isinstance(value, float):
        return Decimal(str(value))
    if isinstance(value, dict):
        return {k: _ddb_ok(v) for k, v in value.items() if v is not None}
    if isinstance(value, list):
        return [_ddb_ok(v) for v in value]
    return value


def patch_mashup(table, record: dict, extra: dict):
    mashup_id = record["id"]
    key = {"pk": f"MASHUP#{mashup_id}"}
    existing = table.get_item(Key=key).get("Item") or {}
    skip = {"pk"}
    merged = {**existing, **{k: v for k, v in record.items() if k not in skip}, **extra}
    merged["pk"] = f"MASHUP#{mashup_id}"
    merged["id"] = mashup_id
    merged = {k: v for k, v in merged.items() if v is not None}
    table.put_item(Item=_ddb_ok(merged))
    return merged


def _ensure_score(table, record: dict, style: str, seconds: float) -> dict:
    try:
        import score as scoremod

        return scoremod.attach_score(
            s3, table, BUCKET, ASSET_BASE, record, style, seconds=seconds
        )
    except Exception as err:
        print("score_failed", err)
        return record


def _model_input(record: dict, style: str, frame_b64: str, seed: int):
    beats = story_beats(record)
    image = {"format": "png", "source": {"bytes": frame_b64}}
    duration = 6 * len(beats)
    if len(beats) == 1:
        return {
            "taskType": "TEXT_VIDEO",
            "textToVideoParams": {
                "text": shot_prompt(record, beats[0], style),
                "images": [image],
            },
            "videoGenerationConfig": {
                "durationSeconds": 6,
                "fps": 24,
                "dimension": "1280x720",
                "seed": seed,
            },
        }, duration, beats
    return {
        "taskType": "MULTI_SHOT_MANUAL",
        "multiShotManualParams": {
            "shots": [
                {"text": shot_prompt(record, beat, style), "image": image}
                for beat in beats
            ]
        },
        "videoGenerationConfig": {
            "fps": 24,
            "dimension": "1280x720",
            "seed": seed,
        },
    }, duration, beats


def start_video(table, record: dict, style: str, user: dict | None):
    mashup_id = record["id"]
    owner = record.get("userId") or ""
    if owner and user and owner != user.get("sub"):
        return 403, {"error": "You can only animate your own mashups."}
    if record.get("videoStatus") == "COMPLETE" and record.get("videoUrl"):
        if not record.get("musicUrl"):
            seconds = float(record.get("videoSeconds") or 6)
            record = _ensure_score(table, record, style, seconds)
        return 200, {
            "status": "COMPLETE",
            "videoUrl": record.get("videoUrl"),
            "musicUrl": record.get("musicUrl") or "",
            "style": record.get("videoStyle") or style,
            "mashupId": mashup_id,
            "seconds": int(record.get("videoSeconds") or 6),
        }
    if record.get("videoStatus") == "PENDING" and record.get("videoInvocationArn"):
        return 202, {
            "status": "PENDING",
            "mashupId": mashup_id,
            "style": record.get("videoStyle") or style,
            "seconds": int(record.get("videoSeconds") or 6),
        }
    png = _png_from_mashup(record)
    try:
        s3.put_object(
            Bucket=BUCKET,
            Key=f"mashups/{mashup_id}.png",
            Body=png,
            ContentType="image/png",
        )
    except Exception as err:
        print("png_cache", err)
    frame = reel_keyframe(png)
    frame_b64 = base64.b64encode(frame).decode("utf-8")
    seed = random.randint(0, 2147483646)
    model_input, duration, beats = _model_input(record, style, frame_b64, seed)
    _ensure_video_output_prefix()
    invocation = bedrock.start_async_invoke(
        modelId=REEL_MODEL,
        modelInput=model_input,
        outputDataConfig={
            "s3OutputDataConfig": {"s3Uri": reel_output_uri()}
        },
    )
    arn = invocation["invocationArn"]
    record = patch_mashup(
        table,
        record,
        {
            "videoStatus": "PENDING",
            "videoInvocationArn": arn,
            "videoStyle": style,
            "videoError": "",
            "videoSeed": seed,
            "videoSeconds": duration,
            "videoBeats": beats,
        },
    )
    if FUNCTION_NAME:
        lam.invoke(
            FunctionName=FUNCTION_NAME,
            InvocationType="Event",
            Payload=json.dumps({"videoWorker": True, "mashupId": mashup_id}).encode(
                "utf-8"
            ),
        )
    record = _ensure_score(table, record, style, float(duration))
    return 202, {
        "status": "PENDING",
        "mashupId": mashup_id,
        "style": style,
        "seconds": duration,
        "beats": len(beats),
        "musicUrl": record.get("musicUrl") or "",
    }


def reel_output_uri() -> str:
    # Nova Reel rejects s3://bucket/prefix without a trailing slash.
    prefix = VIDEO_OUTPUT_PREFIX.strip("/")
    if prefix:
        return f"s3://{BUCKET}/{prefix}/"
    return f"s3://{BUCKET}"


def _ensure_video_output_prefix():
    prefix = VIDEO_OUTPUT_PREFIX.strip("/")
    if not prefix:
        return
    try:
        s3.put_object(Bucket=BUCKET, Key=f"{prefix}/", Body=b"")
    except Exception as err:
        print("video_prefix", err)


def _output_mp4_location(resp: dict) -> tuple[str, str] | None:
    base = (
        resp.get("outputDataConfig", {})
        .get("s3OutputDataConfig", {})
        .get("s3Uri", "")
    )
    if not base.startswith("s3://"):
        return None
    rest = base[5:]
    if "/" in rest:
        bucket, prefix = rest.split("/", 1)
        key = f"{prefix.rstrip('/')}/output.mp4"
    else:
        bucket, key = rest, "output.mp4"
    return bucket, key


def _copy_output_mp4(resp: dict, mashup_id: str, invocation_arn: str = "") -> str | None:
    located = _output_mp4_location(resp)
    if located:
        src_bucket, src_key = located
        try:
            s3.head_object(Bucket=src_bucket, Key=src_key)
            dest = f"mashups/{mashup_id}.mp4"
            s3.copy_object(
                Bucket=BUCKET,
                CopySource={"Bucket": src_bucket, "Key": src_key},
                Key=dest,
                ContentType="video/mp4",
                MetadataDirective="REPLACE",
            )
            return dest
        except ClientError:
            pass
    invocation_id = ""
    if invocation_arn and "/" in invocation_arn:
        invocation_id = invocation_arn.rsplit("/", 1)[-1]
    candidates: list[str] = []
    if invocation_id:
        candidates.append(f"{VIDEO_OUTPUT_PREFIX.strip('/')}/{invocation_id}/output.mp4")
    prefix = f"{VIDEO_OUTPUT_PREFIX.strip('/')}/"
    token = None
    while True:
        kwargs = {"Bucket": BUCKET, "Prefix": prefix}
        if token:
            kwargs["ContinuationToken"] = token
        listed = s3.list_objects_v2(**kwargs)
        for obj in listed.get("Contents") or []:
            key = obj["Key"]
            if key in candidates or key.endswith("output.mp4"):
                dest = f"mashups/{mashup_id}.mp4"
                s3.copy_object(
                    Bucket=BUCKET,
                    CopySource={"Bucket": BUCKET, "Key": key},
                    Key=dest,
                    ContentType="video/mp4",
                    MetadataDirective="REPLACE",
                )
                return dest
        if not listed.get("IsTruncated"):
            break
        token = listed.get("NextContinuationToken")
    return None


def try_finalize_video(table, record: dict) -> dict:
    mashup_id = record["id"]
    arn = record.get("videoInvocationArn")
    if not arn:
        return record
    resp = bedrock.get_async_invoke(invocationArn=arn)
    status = resp.get("status")
    if status == "InProgress":
        return record
    if status == "Failed":
        failure = resp.get("failureMessage") or "Video generation failed."
        return patch_mashup(
            table, record, {"videoStatus": "FAILED", "videoError": str(failure)[:400]}
        )
    dest = _copy_output_mp4(resp, mashup_id, arn)
    if not dest:
        record["videoStatus"] = "PENDING"
        return record
    url = public_url(dest)
    seconds = float(record.get("videoSeconds") or 6)
    record = patch_mashup(
        table,
        record,
        {"videoStatus": "COMPLETE", "videoUrl": url, "videoError": ""},
    )
    if not record.get("musicUrl"):
        record = _ensure_score(
            table, record, record.get("videoStyle") or "cinematic", seconds
        )
    return record


def run_video_worker(table, mashup_id: str):
    item = table.get_item(Key={"pk": f"MASHUP#{mashup_id}"}).get("Item")
    if not item:
        return
    for _ in range(80):
        item = try_finalize_video(table, item)
        if item.get("videoStatus") in {"COMPLETE", "FAILED"}:
            return
        time.sleep(10)


def remake_narration(table, record: dict, voice: str, user: dict | None):
    owner = record.get("userId") or ""
    if owner and user and owner != user.get("sub"):
        return 403, {"error": "You can only re-voice your own mashups."}
    if voice not in VOICES:
        return 400, {"error": "Unknown voice."}
    spoken = f"{record.get('origin', '')} {record.get('tagline', '')}"[:2500]
    result = polly.synthesize_speech(
        Engine="neural",
        OutputFormat="mp3",
        Text=spoken,
        VoiceId=voice,
        TextType="text",
    )
    audio = result["AudioStream"].read()
    mashup_id = record["id"]
    key = f"mashups/{mashup_id}.mp3"
    s3.put_object(Bucket=BUCKET, Key=key, Body=audio, ContentType="audio/mpeg")
    url = public_url(key)
    patch_mashup(table, record, {"audioUrl": url, "voiceId": voice})
    return 200, {"audioUrl": url, "voiceId": voice}
