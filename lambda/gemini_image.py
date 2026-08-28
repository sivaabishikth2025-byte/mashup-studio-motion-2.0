import base64
import json
import os
import urllib.error
import urllib.request

MODELS = [
    "gemini-3.1-flash-image",
    "gemini-3.1-flash-lite-image",
    "gemini-3-pro-image",
    "gemini-2.5-flash-image",
    "gemini-3.1-flash-image-preview",
]


def gemini_image(prompt: str) -> bytes:
    key = os.environ.get("GEMINI_API_KEY") or ""
    if not key.strip():
        raise RuntimeError(
            "GEMINI_API_KEY is missing. Nova Canvas is blocked on this AWS account, "
            "so Fuse needs a Gemini API key from https://aistudio.google.com/apikey"
        )

    last_error = "Gemini image generation failed."
    for model in MODELS:
        url = (
            "https://generativelanguage.googleapis.com/v1beta/models/"
            f"{model}:generateContent?key={key}"
        )
        body = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "responseModalities": ["TEXT", "IMAGE"],
                "imageConfig": {"aspectRatio": "16:9"},
            },
        }
        req = urllib.request.Request(
            url,
            data=json.dumps(body).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as err:
            last_error = err.read().decode("utf-8", errors="ignore")[:400]
            continue
        except Exception as err:
            last_error = str(err)
            continue

        for candidate in payload.get("candidates") or []:
            for part in (candidate.get("content") or {}).get("parts") or []:
                inline = part.get("inlineData") or part.get("inline_data") or {}
                data = inline.get("data")
                if data:
                    return base64.b64decode(data)
        last_error = f"{model} returned no image."
    raise RuntimeError(last_error)


def mashup_image_prompt(labels: list[str]) -> str:
    joined = ", ".join(labels)
    return (
        "Create one highly detailed storybook illustration of a SINGLE original character "
        "or object that fuses ALL of these ingredients into one being and one scene: "
        f"{joined}. "
        "Every ingredient must be clearly visible and physically combined, not a collage "
        "and not separate objects side by side. Rich textures, cinematic lighting, "
        "cozy magical atmosphere, professional concept art. No text, no watermark, "
        "no split screen, no caption."
    )
