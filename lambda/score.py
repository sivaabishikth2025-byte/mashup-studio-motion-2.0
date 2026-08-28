"""Original AI score for each mashup video.

Nova picks tempo / key / mood from the invention. A small synthesizer then
renders a unique WAV. No song titles, no artist names, no licensed samples —
so the clip is not a copyrighted recording.
"""
from __future__ import annotations

import hashlib
import io
import json
import math
import os
import struct
import wave

TEXT_MODEL = os.environ.get("TEXT_MODEL_ID", "amazon.nova-lite-v1:0")
REGION = os.environ.get("AWS_REGION", "us-east-1")

ROOTS = {
    "C": 261.63,
    "D": 293.66,
    "E": 329.63,
    "F": 349.23,
    "G": 392.00,
    "A": 440.00,
    "B": 493.88,
}

MODES = {
    "major": [0, 2, 4, 5, 7, 9, 11],
    "minor": [0, 2, 3, 5, 7, 8, 10],
    "dorian": [0, 2, 3, 5, 7, 9, 10],
    "pentatonic": [0, 2, 4, 7, 9],
}

STYLE_FALLBACK = {
    "cinematic": {"tempo": 84, "root": "A", "mode": "minor", "brightness": 0.35},
    "playful": {"tempo": 118, "root": "G", "mode": "pentatonic", "brightness": 0.7},
    "ominous": {"tempo": 66, "root": "D", "mode": "minor", "brightness": 0.2},
}


def _recipe_from_nova(record: dict, style: str) -> dict:
    fallback = dict(STYLE_FALLBACK.get(style) or STYLE_FALLBACK["cinematic"])
    try:
        import boto3

        client = boto3.client("bedrock-runtime", region_name=REGION)
        prompt = (
            "Compose an ORIGINAL instrumental recipe for a short film cue. "
            "Do not name songs, artists, or copyrighted works. "
            "Match this invention:\n"
            f"name: {record.get('name')}\n"
            f"tagline: {record.get('tagline')}\n"
            f"personality: {str(record.get('personality') or '')[:400]}\n"
            f"style: {style}\n"
            'Return ONLY JSON: {"tempo":int,"root":"C|D|E|F|G|A|B",'
            '"mode":"major|minor|dorian|pentatonic","brightness":0.0-1.0}'
        )
        result = client.converse(
            modelId=TEXT_MODEL,
            messages=[{"role": "user", "content": [{"text": prompt}]}],
            inferenceConfig={"maxTokens": 200, "temperature": 0.4},
        )
        text = next(
            p["text"] for p in result["output"]["message"]["content"] if "text" in p
        )
        match = json.loads(text[text.find("{") : text.rfind("}") + 1])
        tempo = int(match.get("tempo") or fallback["tempo"])
        root = str(match.get("root") or fallback["root"]).upper()[:1]
        mode = str(match.get("mode") or fallback["mode"]).lower()
        brightness = float(match.get("brightness") if match.get("brightness") is not None else fallback["brightness"])
        if root not in ROOTS:
            root = fallback["root"]
        if mode not in MODES:
            mode = fallback["mode"]
        return {
            "tempo": max(52, min(140, tempo)),
            "root": root,
            "mode": mode,
            "brightness": max(0.15, min(0.9, brightness)),
        }
    except Exception as err:
        print("score_recipe_fallback", err)
        return fallback


def _midi(freq: float, semis: int) -> float:
    return freq * (2 ** (semis / 12.0))


def _env(i: int, n: int, attack: int, release: int) -> float:
    if i < attack:
        return i / max(1, attack)
    if i > n - release:
        return max(0.0, (n - i) / max(1, release))
    return 1.0


def render_wav(recipe: dict, seed_text: str, seconds: float = 6.5, sr: int = 22050) -> bytes:
    n = int(sr * seconds)
    samples = [0.0] * n
    rng = int(hashlib.sha256(seed_text.encode("utf-8")).hexdigest()[:8], 16)
    root = ROOTS[recipe["root"]]
    steps = MODES[recipe["mode"]]
    tempo = recipe["tempo"]
    beat = 60.0 / tempo
    brightness = recipe["brightness"]

    def tone(t: float, freq: float, harmonics: int) -> float:
        s = 0.0
        for h in range(1, harmonics + 1):
            amp = (1.0 / h) * (brightness if h > 1 else 1.0)
            s += amp * math.sin(2 * math.pi * freq * h * t)
        return s

    # Drone
    drone = _midi(root, -12)
    for i in range(n):
        t = i / sr
        samples[i] += 0.22 * tone(t, drone, 3) * _env(i, n, int(0.12 * sr), int(0.4 * sr))

    # Fifth pad
    fifth = _midi(root, 7)
    for i in range(n):
        t = i / sr
        samples[i] += 0.12 * tone(t, fifth, 2) * _env(i, n, int(0.2 * sr), int(0.45 * sr))

    # Arpeggio unique to this mashup
    notes = [steps[(rng + k * 3) % len(steps)] for k in range(8)]
    step = max(1, int(beat * 0.5 * sr))
    for idx, semi in enumerate(notes * 8):
        start = idx * step
        if start >= n:
            break
        freq = _midi(root, semi + (12 if idx % 4 == 3 else 0))
        length = min(int(step * 1.4), n - start)
        for j in range(length):
            t = j / sr
            samples[start + j] += 0.16 * math.sin(2 * math.pi * freq * t) * _env(j, length, 80, 400)

    # Lead motif (hash-derived, not a known tune)
    motif = [notes[0], notes[2], notes[4 % len(notes)], notes[1], notes[3], notes[0] + 12]
    lead_step = max(1, int(beat * sr))
    start_lead = int(0.35 * sr)
    for idx, semi in enumerate(motif):
        start = start_lead + idx * lead_step
        if start >= n:
            break
        freq = _midi(root, semi + 12)
        length = min(int(lead_step * 0.9), n - start)
        for j in range(length):
            t = j / sr
            samples[start + j] += 0.2 * math.sin(2 * math.pi * freq * t) * _env(j, length, 60, 500)

    peak = max(1e-6, max(abs(x) for x in samples))
    scale = 0.72 / peak
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sr)
        frames = b"".join(struct.pack("<h", int(max(-1.0, min(1.0, x * scale)) * 32767)) for x in samples)
        wav.writeframes(frames)
    return buf.getvalue()


def compose_score(record: dict, style: str, seconds: float = 6.5) -> tuple[bytes, dict]:
    recipe = _recipe_from_nova(record, style)
    seed = f"{record.get('id')}|{record.get('name')}|{style}|{recipe}"
    wav = render_wav(recipe, seed, seconds=max(6.0, seconds))
    return wav, recipe


def attach_score(s3, table, bucket: str, asset_base: str, record: dict, style: str, seconds: float = 6.5) -> dict:
    mashup_id = record["id"]
    wav, recipe = compose_score(record, style, seconds=seconds)
    key = f"mashups/{mashup_id}-score.wav"
    s3.put_object(Bucket=bucket, Key=key, Body=wav, ContentType="audio/wav")
    url = f"{asset_base.rstrip('/')}/{key}"
    ddb_key = {"pk": f"MASHUP#{mashup_id}"}
    existing = table.get_item(Key=ddb_key).get("Item") or {}
    existing.update(
        {
            "pk": f"MASHUP#{mashup_id}",
            "id": mashup_id,
            "musicUrl": url,
            "musicRecipe": json.dumps(recipe),
        }
    )
    table.put_item(Item=existing)
    record["musicUrl"] = url
    record["musicRecipe"] = json.dumps(recipe)
    return record


if __name__ == "__main__":
    import pathlib

    out = pathlib.Path(__file__).resolve().parents[1] / "public"
    out.mkdir(exist_ok=True)
    fake = {
        "id": "preview",
        "name": "Lantern Kraken",
        "tagline": "A tide that learned to hold a light.",
        "personality": "shy, luminous, tidal",
    }
    for style in ("cinematic", "playful", "ominous"):
        wav, recipe = compose_score(fake, style)
        path = out / f"preview-{style}.wav"
        path.write_bytes(wav)
        print(path, recipe, "bytes", len(wav))
