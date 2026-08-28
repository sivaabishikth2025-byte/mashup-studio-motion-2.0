"""Smoke-test Nova Reel start via motion Lambda video route."""
import json
import uuid

import boto3

API = "https://bmtgkqtxz2.execute-api.us-east-1.amazonaws.com"
# Public sample image from motion bucket if any; fallback tiny png data URL host
IMAGE = (
    "https://mashup-studio-motion-mashupbucket-wvfds69aspqx.s3.us-east-1.amazonaws.com/"
    "mashups/614715c1-3e99-4001-aaa3-bbab25819103.png"
)
mashup_id = "614715c1-3e99-4001-aaa3-bbab25819103"
payload = {
    "style": "cinematic",
    "again": True,
    "mashup": {
        "id": mashup_id,
        "name": "Test Invention",
        "tagline": "A test device",
        "origin": (
            "Born in a garage workshop, this invention hums to life when sunlight "
            "hits its crystal core. It spins slowly, casting rainbow shadows across "
            "the walls as curious onlookers gather."
        ),
        "imageUrl": IMAGE,
    },
}

lam = boto3.client("lambda", region_name="us-east-1")
event = {
    "requestContext": {"http": {"method": "POST", "path": f"/mashups/{mashup_id}/video"}},
    "rawPath": f"/mashups/{mashup_id}/video",
    "body": json.dumps(payload),
    "headers": {"content-type": "application/json"},
}
resp = lam.invoke(
    FunctionName="mashup-motion-fuse",
    Payload=json.dumps(event).encode("utf-8"),
)
body = json.loads(resp["Payload"].read())
print(json.dumps(body, indent=2)[:2000])
