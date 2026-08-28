import hashlib
import io
import random

from PIL import Image, ImageDraw, ImageFilter, ImageFont


def _hex_rgb(value: str) -> tuple[int, int, int]:
    raw = value.strip().lstrip("#")
    if len(raw) != 6:
        return (168, 85, 247)
    return tuple(int(raw[i : i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]


def _font(size: int) -> ImageFont.ImageFont:
    for path in (
        "/var/task/fonts/DejaVuSans-Bold.ttf",
        "fonts/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
    ):
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def render_poster(name: str, tagline: str, labels: list[str], palette: list[str]) -> bytes:
    seed = int(hashlib.sha256(name.encode()).hexdigest()[:8], 16)
    rng = random.Random(seed)
    colors = [_hex_rgb(c) for c in (palette or [])[:5]]
    while len(colors) < 3:
        colors.append((rng.randint(40, 220), rng.randint(20, 180), rng.randint(80, 255)))

    w = h = 1024
    base = Image.new("RGB", (w, h), (7, 6, 14))
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer, "RGBA")

    for i in range(18):
        r, g, b = colors[i % len(colors)]
        cx = rng.randint(-80, w + 80)
        cy = rng.randint(-80, h + 80)
        rad = rng.randint(140, 420)
        alpha = rng.randint(50, 120)
        draw.ellipse(
            (cx - rad, cy - rad, cx + rad, cy + rad),
            fill=(r, g, b, alpha),
        )

    glow = layer.filter(ImageFilter.GaussianBlur(42))
    art = Image.alpha_composite(base.convert("RGBA"), glow)

    grain = Image.new("L", (w, h), 0)
    gdraw = ImageDraw.Draw(grain)
    for _ in range(9000):
        gdraw.point((rng.randint(0, w - 1), rng.randint(0, h - 1)), fill=rng.randint(0, 55))
    art = Image.composite(
        Image.new("RGBA", (w, h), (255, 255, 255, 18)),
        art,
        grain,
    )

    ink = ImageDraw.Draw(art)
    ink.rectangle((48, 48, w - 48, h - 48), outline=(255, 255, 255, 40), width=2)
    title = _font(72)
    sub = _font(28)
    chips = _font(22)
    ink.text((72, 120), name[:28], font=title, fill=(255, 246, 232, 255))
    ink.text((72, 220), (tagline or "")[:72], font=sub, fill=(226, 210, 255, 230))
    x = 72
    y = 920
    for label in labels[:5]:
        tw = ink.textlength(label, font=chips)
        ink.rounded_rectangle((x, y, x + tw + 28, y + 44), radius=22, fill=(0, 0, 0, 120))
        ink.text((x + 14, y + 8), label, font=chips, fill=(255, 255, 255, 255))
        x += int(tw) + 40

    out = io.BytesIO()
    art.convert("RGB").save(out, format="PNG", optimize=True)
    return out.getvalue()
