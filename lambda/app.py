import json
import os
import re
import uuid
from datetime import datetime, timezone
from collections import defaultdict

from gemini_image import gemini_image, mashup_image_prompt

import boto3
from botocore.exceptions import ClientError

REGION = os.environ.get("AWS_REGION", "us-east-1")
TEXT_MODEL = os.environ.get("TEXT_MODEL_ID", "amazon.nova-pro-v1:0")
IMAGE_MODEL = os.environ.get("IMAGE_MODEL_ID", "amazon.nova-canvas-v1:0")
BUCKET = os.environ["MASHUP_BUCKET"]
TABLE = os.environ["MASHUP_TABLE"]
ASSET_BASE = os.environ["ASSET_BASE"].rstrip("/")
FUNCTION_NAME = os.environ.get("AWS_LAMBDA_FUNCTION_NAME")
RATE_LIMIT = int(os.environ.get("RATE_LIMIT_PER_HOUR", "12"))
DAILY_LIMIT = int(os.environ.get("DAILY_FUSE_LIMIT", "10"))
MAIL_FROM = (os.environ.get("MAIL_FROM") or "").strip()

ALLOWED_IDS = {
    "shark", "panda", "octopus", "cactus", "owl", "fox", "wolf", "frog", "bee",
    "whale", "axolotl", "raven", "chameleon", "jellyfish", "sloth", "guitar",
    "violin", "umbrella", "clock", "lantern", "typewriter", "telescope",
    "compass", "mirror", "backpack", "pizza", "ice-cream", "coffee", "ramen",
    "avocado", "chili", "honey", "pretzel", "matcha", "volcano", "castle",
    "library", "lighthouse", "jungle", "subway", "oasis", "museum", "reef",
    "spaceship", "submarine", "hot-air-balloon", "train", "skateboard",
    "sailboat", "monorail", "dragon", "phoenix", "unicorn", "golem", "fairy",
    "kraken", "portal", "robot", "satellite", "hologram", "server", "drone",
    "neon-sign", "moon", "nebula", "comet", "black-hole", "asteroid",
    "constellation", "chef", "detective", "astronaut", "librarian",
    "lighthouse-keeper", "cartographer", "beekeeper", "conductor",
}

LABELS = {
    "ice-cream": "Ice Cream",
    "hot-air-balloon": "Hot Air Balloon",
    "neon-sign": "Neon Sign",
    "black-hole": "Black Hole",
    "lighthouse-keeper": "Lighthouse Keeper",
    "server": "Server Farm",
    "reef": "Coral Reef",
    "train": "Night Train",
}

TRANSLATE_LANGS = {
    "en", "es", "fr", "de", "it", "pt", "ja", "ko", "zh", "hi", "ar", "nl",
}

SYSTEM = """You invent one original mashup from the given ingredients.
Return ONLY valid JSON. No markdown. No preamble.
The invention must match the attached illustration exactly. Do not describe a different creature.
Every ingredient is already fused in the picture. Name it, then write the dossier as if the image is canon.
Schema:
{
  "name": "invented proper name",
  "tagline": "one cinematic sentence",
  "origin": "180-220 word origin story",
  "abilities": ["five distinct abilities"],
  "personality": "120-160 words of funny personality",
  "facts": ["five fun facts"],
  "advertisement": "a ridiculous 80-120 word advertisement",
  "warning": "funny safety warning label, 60-90 words",
  "classification": {
    "kingdom": "",
    "species": "",
    "habitat": "",
    "diet": "",
    "lifespan": "",
    "threatLevel": ""
  },
  "patent": "140-180 word mock patent summary",
  "imagePrompt": "detailed visual prompt for a single hero illustration",
  "palette": ["#hex","#hex","#hex"]
}
}
"""

bedrock = boto3.client("bedrock-runtime", region_name=REGION)
bedrock_west = boto3.client("bedrock-runtime", region_name="us-west-2")
s3 = boto3.client("s3", region_name=REGION)
ddb = boto3.resource("dynamodb", region_name=REGION)
table = ddb.Table(TABLE)
polly = boto3.client("polly", region_name=REGION)
translate = boto3.client("translate", region_name=REGION)
lam = boto3.client("lambda", region_name=REGION)
cognito = boto3.client("cognito-idp", region_name=REGION)
ses = boto3.client("ses", region_name=REGION)


def cors():
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "content-type,authorization,x-id-token,x-ims-access",
        "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
        "Content-Type": "application/json",
    }


def json_ready(value):
    from decimal import Decimal

    if isinstance(value, Decimal):
        return int(value) if value % 1 == 0 else float(value)
    if isinstance(value, dict):
        return {k: json_ready(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [json_ready(v) for v in value]
    return value


def respond(status, body):
    return {"statusCode": status, "headers": cors(), "body": json.dumps(json_ready(body))}


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def utc_date_key():
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def parse_event(event):
    import base64

    if event.get("digest"):
        return "DIGEST", {}, event
    if event.get("videoWorker") and event.get("mashupId"):
        return "VIDEO_WORKER", {}, event
    if event.get("worker") and event.get("jobId"):
        return "WORKER", {}, event
    rc = event.get("requestContext") or {}
    http = rc.get("http") or {}
    method = http.get("method") or event.get("httpMethod") or "GET"
    path = http.get("path") or event.get("rawPath") or event.get("path") or "/"
    qs = event.get("queryStringParameters") or {}
    body = event.get("body")
    if event.get("isBase64Encoded") and isinstance(body, str):
        body = base64.b64decode(body).decode("utf-8")
    payload = {}
    if isinstance(body, str) and body.strip():
        try:
            payload = json.loads(body)
        except json.JSONDecodeError:
            payload = {}
    elif isinstance(body, dict):
        payload = body
    ip = http.get("sourceIp") or (rc.get("identity") or {}).get("sourceIp") or "unknown"
    headers = {str(k).lower(): v for k, v in (event.get("headers") or {}).items()}
    return method, {"path": path, "qs": qs, "ip": ip, "headers": headers}, payload


def jwt_claims(token: str) -> dict:
    import base64

    if not token or not isinstance(token, str):
        return {}
    if token.lower().startswith("bearer "):
        token = token[7:]
    parts = token.split(".")
    if len(parts) < 2:
        return {}
    payload = parts[1] + "=" * ((4 - len(parts[1]) % 4) % 4)
    try:
        return json.loads(base64.urlsafe_b64decode(payload.encode("utf-8")))
    except Exception:
        return {}


def current_user(meta, payload):
    headers = meta.get("headers") or {}
    qs = meta.get("qs") or {}
    access = (
        headers.get("authorization")
        or headers.get("x-ims-access")
        or payload.get("accessToken")
        or qs.get("accessToken")
        or ""
    )
    id_token = (
        headers.get("x-id-token")
        or payload.get("idToken")
        or qs.get("idToken")
        or ""
    )
    if isinstance(access, str) and access.lower().startswith("bearer "):
        access = access[7:]
    claims = jwt_claims(id_token) or jwt_claims(access)
    if claims.get("sub"):
        return {
            "sub": claims.get("sub"),
            "email": claims.get("email") or claims.get("username") or "",
        }
    if not access:
        return None
    try:
        user = cognito.get_user(AccessToken=access)
        attrs = {a["Name"]: a["Value"] for a in user.get("UserAttributes", [])}
        return {
            "sub": attrs.get("sub") or user["Username"],
            "email": attrs.get("email"),
        }
    except Exception as err:
        print("auth_failed", err)
        return None


def upsert_user(user):
    if not user or not user.get("sub"):
        return
    table.put_item(
        Item={
            "pk": f"USER#{user['sub']}",
            "email": user.get("email") or "",
            "updatedAt": now_iso(),
        }
    )


def send_mail(to_addr, subject, html, text):
    if not MAIL_FROM or not to_addr:
        return
    app_url = (os.environ.get("APP_URL") or "https://master.d1jurjfgyej0xx.amplifyapp.com").rstrip("/")
    unsub = f"{app_url}/profile"
    wrapped_html = f"""<!DOCTYPE html>
<html><body style="margin:0;background:#07060c;color:#f6f3ff;font-family:Georgia,serif;">
  <div style="max-width:560px;margin:0 auto;padding:28px 20px;">
    <p style="letter-spacing:0.28em;font-size:11px;color:#67e8f9;text-transform:uppercase;">Infinite Mashup Studio</p>
    {html}
    <p style="margin-top:28px;font-size:12px;color:#9ca3af;font-family:Arial,sans-serif;">
      This is a transactional notice for an account on Infinite Mashup Studio.
      Manage mail from <a href="{unsub}" style="color:#67e8f9;">your profile</a>.
    </p>
  </div>
</body></html>"""
    try:
        ses.send_email(
            Source=f"Infinite Mashup Studio <{MAIL_FROM}>",
            Destination={"ToAddresses": [to_addr]},
            ReplyToAddresses=[MAIL_FROM],
            Message={
                "Subject": {"Data": subject, "Charset": "UTF-8"},
                "Body": {
                    "Text": {
                        "Data": text + f"\n\nInfinite Mashup Studio\n{unsub}\n",
                        "Charset": "UTF-8",
                    },
                    "Html": {"Data": wrapped_html, "Charset": "UTF-8"},
                },
            },
        )
    except Exception as err:
        print("ses_failed", err)


def extract_json(text: str) -> dict:
    match = re.search(r"\{.*\}", text, re.S)
    if not match:
        raise ValueError("Model did not return JSON.")
    return json.loads(match.group(0))


def invent_from_image(labels: list[str], png: bytes) -> dict:
    prompt = (
        "Look at this illustration. Ingredients used to create it: "
        + ", ".join(labels or ["user camera photos"])
        + ". Write the JSON dossier for THIS exact scene and character. "
        "Do not ignore any visible detail."
    )
    result = bedrock.converse(
        modelId=TEXT_MODEL,
        system=[{"text": SYSTEM}],
        messages=[{
            "role": "user",
            "content": [
                {"image": {"format": "png", "source": {"bytes": png}}},
                {"text": prompt},
            ],
        }],
        inferenceConfig={"maxTokens": 2200, "temperature": 0.7, "topP": 0.9},
    )
    text = next(
        p["text"] for p in result["output"]["message"]["content"] if "text" in p
    )
    data = extract_json(text)
    required = [
        "name", "tagline", "origin", "abilities", "personality", "facts",
        "advertisement", "warning", "classification", "patent", "imagePrompt",
    ]
    for key in required:
        if key not in data:
            raise ValueError(f"Missing field: {key}")
    classification = data["classification"]
    for key in ["kingdom", "species", "habitat", "diet", "lifespan", "threatLevel"]:
        if key not in classification:
            raise ValueError(f"Missing classification.{key}")
    if not isinstance(data["abilities"], list) or len(data["abilities"]) < 3:
        raise ValueError("Need abilities list.")
    if not isinstance(data["facts"], list) or len(data["facts"]) < 3:
        raise ValueError("Need facts list.")
    return data


def prompt_from_photos(labels: list[str], photos: list[bytes]) -> str:
    content = []
    for photo in photos:
        content.append({"image": {"format": "jpeg", "source": {"bytes": photo}}})
    extra = ", ".join(labels) if labels else "no catalog ingredients"
    content.append({
        "text": (
            "These are photos the user captured. Write one detailed cinematic "
            "image-generation prompt that fuses the photos with these ingredients: "
            f"{extra}. Invent one subject in a single 16:9 scene. Return only the prompt."
        )
    })
    result = bedrock.converse(
        modelId=TEXT_MODEL,
        messages=[{"role": "user", "content": content}],
        inferenceConfig={"maxTokens": 400, "temperature": 0.6},
    )
    return next(
        p["text"] for p in result["output"]["message"]["content"] if "text" in p
    )


def paint_real(labels: list[str], photos: list[bytes] | None = None) -> bytes:
    import base64

    photos = photos or []
    if photos:
        prompt = prompt_from_photos(labels, photos)
    else:
        prompt = mashup_image_prompt(labels)
    errors = []

    if photos:
        i2i_body = json.dumps(
            {
                "prompt": prompt[:10000],
                "mode": "image-to-image",
                "image": base64.b64encode(photos[0]).decode("utf-8"),
                "strength": 0.72,
                "output_format": "png",
                "aspect_ratio": "16:9",
            }
        )
        for model_id in (
            "stability.stable-image-ultra-v1:1",
            "stability.sd3-5-large-v1:0",
            "stability.stable-image-core-v1:1",
        ):
            try:
                response = bedrock_west.invoke_model(
                    modelId=model_id,
                    body=i2i_body,
                    accept="application/json",
                    contentType="application/json",
                )
                payload = json.loads(response["body"].read())
                images = payload.get("images") or []
                if images:
                    return base64.b64decode(images[0])
            except Exception as err:
                print("stability_i2i_failed", model_id, err)
                errors.append(f"i2i {model_id}: {err}")

    stability_body = json.dumps(
        {
            "prompt": prompt[:10000],
            "mode": "text-to-image",
            "aspect_ratio": "16:9",
            "output_format": "png",
        }
    )
    for model_id in (
        "stability.stable-image-ultra-v1:1",
        "stability.sd3-5-large-v1:0",
        "stability.stable-image-core-v1:1",
    ):
        try:
            response = bedrock_west.invoke_model(
                modelId=model_id,
                body=stability_body,
                accept="application/json",
                contentType="application/json",
            )
            payload = json.loads(response["body"].read())
            images = payload.get("images") or []
            if not images:
                raise RuntimeError("empty image list")
            return base64.b64decode(images[0])
        except Exception as err:
            print("stability_failed", model_id, err)
            errors.append(f"{model_id}: {err}")

    titan_body = json.dumps(
        {
            "taskType": "TEXT_IMAGE",
            "textToImageParams": {
                "text": prompt[:512],
                "negativeText": "text, watermark, collage, split screen, blurry",
            },
            "imageGenerationConfig": {
                "numberOfImages": 1,
                "quality": "premium",
                "height": 1024,
                "width": 1024,
                "cfgScale": 8.0,
            },
        }
    )
    for model_id in (
        "amazon.titan-image-generator-v2:0",
        os.environ.get("IMAGE_MODEL_ID", "amazon.nova-canvas-v1:0"),
    ):
        try:
            response = bedrock.invoke_model(
                modelId=model_id,
                body=titan_body,
                accept="application/json",
                contentType="application/json",
            )
            payload = json.loads(response["body"].read())
            if payload.get("error"):
                raise RuntimeError(payload["error"])
            return base64.b64decode(payload["images"][0])
        except Exception as err:
            print("bedrock_image_failed", model_id, err)
            errors.append(f"{model_id}: {err}")

    try:
        return gemini_image(prompt)
    except Exception as gemini_err:
        errors.append(f"gemini: {gemini_err}")
        raise RuntimeError(
            "Could not generate a real illustration. " + " | ".join(errors)
        ) from gemini_err


def narrate(text: str) -> bytes:
    spoken = text[:2500]
    result = polly.synthesize_speech(
        Engine="neural",
        OutputFormat="mp3",
        Text=spoken,
        VoiceId="Ruth",
        TextType="text",
    )
    return result["AudioStream"].read()


def public_url(key: str) -> str:
    return f"{ASSET_BASE}/{key}"


def quota_pk(user, ip: str) -> str:
    day = utc_date_key()
    if user and user.get("sub"):
        return f"QUOTA#{user['sub']}#{day}"
    return f"QUOTA#IP#{ip}#{day}"


def mashups_used_today(user) -> int:
    if not user or not user.get("sub"):
        return 0
    result = table.query(
        IndexName="byUser",
        KeyConditionExpression="gsi3pk = :pk",
        ExpressionAttributeValues={":pk": f"USER#{user['sub']}"},
        ScanIndexForward=False,
        Limit=48,
    )
    today = utc_date_key()
    return sum(
        1
        for raw in result.get("Items", [])
        if str(raw.get("createdAt") or "").startswith(today)
    )


def get_quota(user, ip: str):
    if user:
        used = mashups_used_today(user)
    else:
        item = table.get_item(Key={"pk": quota_pk(user, ip)}).get("Item") or {}
        used = int(item.get("count") or 0)
    remaining = max(0, DAILY_LIMIT - used)
    return {
        "used": used,
        "limit": DAILY_LIMIT,
        "remaining": remaining,
        "date": utc_date_key(),
    }


def consume_daily_quota(user, ip: str):
    ttl = int(datetime.now(timezone.utc).timestamp()) + 172800
    try:
        item = table.update_item(
            Key={"pk": quota_pk(user, ip)},
            UpdateExpression="ADD #c :one SET expiresAt = :exp",
            ConditionExpression="attribute_not_exists(#c) OR #c < :max",
            ExpressionAttributeNames={"#c": "count"},
            ExpressionAttributeValues={
                ":one": 1,
                ":max": DAILY_LIMIT,
                ":exp": ttl,
            },
            ReturnValues="UPDATED_NEW",
        )
        used = int(item["Attributes"]["count"])
        return True, max(0, DAILY_LIMIT - used)
    except ClientError as err:
        if err.response.get("Error", {}).get("Code") == "ConditionalCheckFailedException":
            return False, 0
        print("quota_failed", err)
        return True, DAILY_LIMIT


def check_rate(ip: str):
    hour = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H")
    key = f"RATE#{ip}#{hour}"
    try:
        item = table.update_item(
            Key={"pk": key},
            UpdateExpression="ADD #c :one SET expiresAt = :exp",
            ExpressionAttributeNames={"#c": "count"},
            ExpressionAttributeValues={
                ":one": 1,
                ":exp": int(datetime.now(timezone.utc).timestamp()) + 7200,
            },
            ReturnValues="UPDATED_NEW",
        )
        count = int(item["Attributes"]["count"])
        if count > RATE_LIMIT:
            return False
        return True
    except ClientError:
        return True


def decode_photo(data_url: str) -> bytes:
    import base64

    if not isinstance(data_url, str) or "," not in data_url:
        raise ValueError("Invalid camera photo.")
    raw = base64.b64decode(data_url.split(",", 1)[1])
    if len(raw) > 2_400_000:
        raise ValueError("Camera photo is too large.")
    return raw


def start_job(payload, ip, user):
    try:
        ids = payload.get("ingredientIds") or []
        photos = payload.get("photos") or []
        if not isinstance(ids, list):
            return respond(400, {"error": "Choose ingredients or camera photos."})
        if any(i not in ALLOWED_IDS for i in ids):
            return respond(400, {"error": "Unknown ingredient."})
        if len(set(ids)) != len(ids):
            return respond(400, {"error": "Duplicate ingredients."})
        if not isinstance(photos, list) or len(photos) > 2:
            return respond(400, {"error": "Use at most 2 camera photos."})
        if photos:
            if len(ids) > 5:
                return respond(400, {"error": "At most 5 ingredients."})
            if not ids and not photos:
                return respond(400, {"error": "Add photos or ingredients."})
        else:
            if not 2 <= len(ids) <= 5:
                return respond(400, {"error": "Choose 2 to 5 ingredients."})
        if user:
            used = mashups_used_today(user)
            if used >= DAILY_LIMIT:
                return respond(
                    429,
                    {
                        "error": f"Daily limit reached. Each account can fuse {DAILY_LIMIT} mashups per UTC day.",
                        "used": used,
                        "limit": DAILY_LIMIT,
                        "remaining": 0,
                    },
                )
            remaining = DAILY_LIMIT - used - 1
        else:
            allowed, remaining = consume_daily_quota(user, ip)
            if not allowed:
                return respond(
                    429,
                    {
                        "error": f"Daily limit reached. Each account can fuse {DAILY_LIMIT} mashups per UTC day.",
                        "used": DAILY_LIMIT,
                        "limit": DAILY_LIMIT,
                        "remaining": 0,
                    },
                )
        if not check_rate(ip):
            return respond(429, {"error": "Hourly fusion limit reached. Try again later."})

        job_id = str(uuid.uuid4())
        photo_count = 0
        for i, data_url in enumerate(photos):
            raw = decode_photo(data_url)
            s3.put_object(
                Bucket=BUCKET,
                Key=f"jobs/{job_id}/photo-{i}.jpg",
                Body=raw,
                ContentType="image/jpeg",
            )
            photo_count += 1

        if user:
            upsert_user(user)

        table.put_item(
            Item={
                "pk": f"JOB#{job_id}",
                "jobId": job_id,
                "status": "PENDING",
                "ingredientIds": ids,
                "photoCount": photo_count,
                "challengeDate": payload.get("challengeDate") or "sandbox",
                "mode": payload.get("mode") or "daily",
                "createdAt": now_iso(),
                "ip": ip,
                "userId": (user or {}).get("sub") or "",
                "email": (user or {}).get("email") or "",
            }
        )
        lam.invoke(
            FunctionName=FUNCTION_NAME,
            InvocationType="Event",
            Payload=json.dumps({"worker": True, "jobId": job_id}).encode("utf-8"),
        )
        return respond(
            202,
            {
                "jobId": job_id,
                "status": "PENDING",
                "remaining": remaining,
                "limit": DAILY_LIMIT,
            },
        )
    except Exception as err:
        print("start_job", err)
        return respond(500, {"error": str(err)})


def get_job(job_id: str):
    item = table.get_item(Key={"pk": f"JOB#{job_id}"}).get("Item")
    if not item:
        return respond(404, {"error": "Job not found."})
    body = {
        "jobId": job_id,
        "status": item.get("status"),
        "error": item.get("error"),
        "mashupId": item.get("mashupId"),
    }
    return respond(200, body)


def get_mashup(mashup_id: str):
    item = table.get_item(Key={"pk": f"MASHUP#{mashup_id}"}).get("Item")
    if not item:
        try:
            obj = s3.get_object(Bucket=BUCKET, Key=f"mashups/{mashup_id}.json")
            return respond(200, json.loads(obj["Body"].read()))
        except ClientError:
            return respond(404, {"error": "Mashup not found."})
    if item.get("videoStatus") == "PENDING" and item.get("videoInvocationArn"):
        try:
            import video as motion

            item = motion.try_finalize_video(table, item)
        except Exception as err:
            print("video_finalize", err)
    item.pop("pk", None)
    return respond(200, item)


def gallery(date_key: str | None, user=None, mine=False):
    if not user:
        return respond(200, {"items": []})
    result = table.query(
        IndexName="byUser",
        KeyConditionExpression="gsi3pk = :pk",
        ExpressionAttributeValues={":pk": f"USER#{user['sub']}"},
        ScanIndexForward=False,
        Limit=48,
    )
    items = []
    for raw in result.get("Items", []):
        created = raw.get("createdAt") or ""
        if date_key and not str(created).startswith(date_key):
            continue
        items.append(
            {
                "id": raw.get("id"),
                "name": raw.get("name"),
                "tagline": raw.get("tagline"),
                "imageUrl": raw.get("imageUrl"),
                "ingredients": raw.get("ingredients"),
                "createdAt": raw.get("createdAt"),
                "challengeDate": raw.get("challengeDate"),
                "videoUrl": raw.get("videoUrl") or "",
                "canDelete": True,
            }
        )
    return respond(200, {"items": items})


def delete_mashup(mashup_id: str, user):
    if not user:
        return respond(401, {"error": "Sign in to delete mashups."})
    item = table.get_item(Key={"pk": f"MASHUP#{mashup_id}"}).get("Item")
    if not item:
        return respond(404, {"error": "Mashup not found."})
    owner = item.get("userId") or ""
    if owner and owner != user.get("sub"):
        return respond(403, {"error": "You can only delete your own mashups."})
    table.delete_item(Key={"pk": f"MASHUP#{mashup_id}"})
    return respond(200, {"ok": True})


def translate_mashup(mashup_id: str, lang: str):
    if lang not in TRANSLATE_LANGS:
        return respond(400, {"error": "Unsupported language."})
    if lang == "en":
        return get_mashup(mashup_id)
    wrapped = get_mashup(mashup_id)
    payload = json.loads(wrapped["body"])
    if wrapped["statusCode"] != 200:
        return respond(wrapped["statusCode"], payload)

    def tx(text: str) -> str:
        if not text:
            return text
        out = translate.translate_text(
            Text=text[:9000],
            SourceLanguageCode="en",
            TargetLanguageCode="zh" if lang == "zh" else lang,
        )
        return out["TranslatedText"]

    payload["origin"] = tx(payload.get("origin", ""))
    payload["tagline"] = tx(payload.get("tagline", ""))
    payload["personality"] = tx(payload.get("personality", ""))
    payload["advertisement"] = tx(payload.get("advertisement", ""))
    payload["warning"] = tx(payload.get("warning", ""))
    payload["patent"] = tx(payload.get("patent", ""))
    payload["abilities"] = [tx(x) for x in payload.get("abilities", [])]
    payload["facts"] = [tx(x) for x in payload.get("facts", [])]
    payload["language"] = lang
    return respond(200, payload)


def load_job_photos(job_id: str) -> list[bytes]:
    photos = []
    for i in range(2):
        try:
            obj = s3.get_object(Bucket=BUCKET, Key=f"jobs/{job_id}/photo-{i}.jpg")
            photos.append(obj["Body"].read())
        except ClientError:
            break
    return photos


def run_worker(job_id: str):
    job = table.get_item(Key={"pk": f"JOB#{job_id}"}).get("Item")
    if not job:
        return
    ids = job.get("ingredientIds") or []
    labels = [LABELS.get(i, i.replace("-", " ").title()) for i in ids]
    photos = load_job_photos(job_id)
    try:
        png = paint_real(labels, photos)
        invention = invent_from_image(labels, png)
        mp3 = narrate(invention["origin"] + " " + invention["tagline"])
    except Exception as err:
        print(err)
        table.update_item(
            Key={"pk": f"JOB#{job_id}"},
            UpdateExpression="SET #s = :s, #e = :e",
            ExpressionAttributeNames={"#s": "status", "#e": "error"},
            ExpressionAttributeValues={
                ":s": "FAILED",
                ":e": str(err)[:500],
            },
        )
        email = job.get("email")
        send_mail(
            email,
            "Your mashup failed",
            f"<p>Fusion failed: {str(err)[:300]}</p>",
            str(err)[:300],
        )
        return

    mashup_id = str(uuid.uuid4())
    image_key = f"mashups/{mashup_id}.png"
    audio_key = f"mashups/{mashup_id}.mp3"
    json_key = f"mashups/{mashup_id}.json"
    s3.put_object(Bucket=BUCKET, Key=image_key, Body=png, ContentType="image/png")
    s3.put_object(Bucket=BUCKET, Key=audio_key, Body=mp3, ContentType="audio/mpeg")
    created = now_iso()
    today = utc_date_key()
    date_key = job.get("challengeDate") or "sandbox"
    record = {
        "id": mashup_id,
        **invention,
        "imageUrl": public_url(image_key),
        "audioUrl": public_url(audio_key),
        "ingredients": labels,
        "ingredientIds": ids,
        "challengeDate": date_key,
        "mode": job.get("mode") or "daily",
        "createdAt": created,
        "language": "en",
        "userId": job.get("userId") or "",
        "usedCamera": bool(photos),
        "videoStatus": "",
        "videoUrl": "",
        "voiceId": "Ruth",
    }
    s3.put_object(
        Bucket=BUCKET,
        Key=json_key,
        Body=json.dumps(record),
        ContentType="application/json",
    )
    item = {
        "pk": f"MASHUP#{mashup_id}",
        "gsi1pk": f"DATE#{today}",
        "gsi1sk": created,
        "gsi2pk": "DATE#ALL",
        "gsi2sk": created,
        **record,
    }
    if job.get("userId"):
        item["gsi3pk"] = f"USER#{job['userId']}"
        item["gsi3sk"] = created
    table.put_item(Item=item)
    table.update_item(
        Key={"pk": f"JOB#{job_id}"},
        UpdateExpression="SET #s = :s, mashupId = :m",
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={":s": "COMPLETE", ":m": mashup_id},
    )
    app_url = os.environ.get("APP_URL") or "https://localhost:3000"
    send_mail(
        job.get("email"),
        f"Mashup ready — {invention.get('name', 'Untitled')}",
        (
            f"<p>Your fusion <strong>{invention.get('name')}</strong> is ready.</p>"
            f"<p>{invention.get('tagline', '')}</p>"
            f"<p><a href='{app_url}/m/{mashup_id}'>Open mashup</a></p>"
        ),
        f"Ready: {invention.get('name')} {app_url}/m/{mashup_id}",
    )


def run_digest():
    today = utc_date_key()
    result = table.query(
        IndexName="byDate",
        KeyConditionExpression="gsi1pk = :pk",
        ExpressionAttributeValues={":pk": f"DATE#{today}"},
        ScanIndexForward=False,
        Limit=200,
    )
    by_user = defaultdict(list)
    for raw in result.get("Items", []):
        uid = raw.get("userId")
        if uid:
            by_user[uid].append(raw)
    for uid, mashups in by_user.items():
        profile = table.get_item(Key={"pk": f"USER#{uid}"}).get("Item") or {}
        email = profile.get("email")
        if not email:
            continue
        lines = "".join(
            f"<li>{m.get('name')} — {m.get('tagline', '')}</li>" for m in mashups
        )
        send_mail(
            email,
            f"Your Infinite Mashup report for {today}",
            (
                f"<h2>Today you fused {len(mashups)} mashup(s)</h2>"
                f"<ul>{lines}</ul>"
                "<p>That’s everything you generated today.</p>"
            ),
            f"{len(mashups)} mashups on {today}",
        )


def lambda_handler(event, context):
    try:
        method, meta, payload = parse_event(event)
        if method == "WORKER":
            run_worker(payload["jobId"])
            return respond(200, {"ok": True})
        if method == "VIDEO_WORKER":
            import video as motion

            motion.run_video_worker(table, payload["mashupId"])
            return respond(200, {"ok": True})
        if method == "DIGEST":
            run_digest()
            return respond(200, {"ok": True})
        if method == "OPTIONS":
            return respond(200, {"ok": True})

        user = current_user(meta, payload)
        path = meta.get("path") or "/"
        qs = meta.get("qs") or {}
        parts = [p for p in path.split("/") if p]

        if method == "POST" and (
            not parts or parts[-1] in {"fuse", "prod", "stage"} or "fuse" in parts
        ):
            return start_job(payload, meta["ip"], user)

        if method == "POST" and "mashups" in parts and parts[-1] == "video":
            import video as motion

            mashup_id = parts[-2]
            wrapped = get_mashup(mashup_id)
            body = json.loads(wrapped["body"])
            incoming = payload.get("mashup") if isinstance(payload.get("mashup"), dict) else {}
            if wrapped["statusCode"] != 200:
                if not incoming.get("imageUrl"):
                    return respond(wrapped["statusCode"], body)
                body = {**incoming, "id": mashup_id}
                if user and user.get("sub"):
                    body["userId"] = user["sub"]
                motion.patch_mashup(table, body, {})
            elif incoming:
                for key in ("origin", "name", "tagline", "imageUrl", "abilities", "personality"):
                    if incoming.get(key) and not body.get(key):
                        body[key] = incoming[key]
                body["id"] = mashup_id
                if user and user.get("sub") and not body.get("userId"):
                    body["userId"] = user["sub"]
                    motion.patch_mashup(table, body, {})
            style = str(payload.get("style") or "cinematic").lower()
            if style not in motion.MOTION_STYLES:
                style = "cinematic"
            if (body.get("videoStatus") == "COMPLETE" or body.get("videoUrl")) and payload.get("again"):
                body = motion.patch_mashup(
                    table,
                    body,
                    {
                        "videoStatus": "",
                        "videoUrl": "",
                        "videoInvocationArn": "",
                        "videoError": "",
                    },
                )
            code, out = motion.start_video(table, body, style, user)
            return respond(code, out)
        if method == "POST" and "mashups" in parts and parts[-1] == "narrate":
            import video as motion

            mashup_id = parts[-2]
            wrapped = get_mashup(mashup_id)
            body = json.loads(wrapped["body"])
            incoming = payload.get("mashup") if isinstance(payload.get("mashup"), dict) else {}
            if wrapped["statusCode"] != 200:
                if not incoming.get("origin") and not incoming.get("tagline"):
                    return respond(wrapped["statusCode"], body)
                body = {**incoming, "id": mashup_id}
            code, out = motion.remake_narration(
                table, body, str(payload.get("voice") or "Ruth"), user
            )
            return respond(code, out)
        if method == "DELETE" and "mashups" in parts:
            return delete_mashup(parts[-1], user)
        if method == "GET" and "quota" in parts:
            return respond(200, get_quota(user, meta["ip"]))
        if method == "GET" and "jobs" in parts:
            return get_job(parts[-1])
        if method == "GET" and "gallery" in parts:
            mine = str(qs.get("mine") or "").lower() in {"1", "true"}
            return gallery(qs.get("date"), user, mine)
        if method == "GET" and "translate" in parts:
            return translate_mashup(qs.get("id", ""), qs.get("lang", "en"))
        if method == "GET" and "mashups" in parts:
            return get_mashup(parts[-1])
        if method == "GET" and qs.get("id"):
            return get_mashup(qs["id"])
        if method == "GET" and qs.get("jobId"):
            return get_job(qs["jobId"])
        if method == "POST":
            return start_job(payload, meta["ip"], user)

        return respond(404, {"error": "Unknown route."})
    except Exception as err:
        print(err)
        return respond(500, {"error": str(err)})
