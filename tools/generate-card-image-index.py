#!/usr/bin/env python3
import argparse
import ast
import hashlib
import json
import re
import ssl
import sys
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
SOURCE_PATH = ROOT / "src/features/cardmarket/cardmarket-candidates.data.ts"
OUTPUT_PATH = ROOT / "src/features/scan/generated/card-image-index.ts"
CACHE_DIR = ROOT / "tools/.cache/card-images"
REPORT_PATH = ROOT / "tools/.cache/card-image-index-report.json"

SIGNATURE_VERSION = 1
THUMBNAIL_SIZE = 32
DHASH_WIDTH = 9
DHASH_HEIGHT = 8
HISTOGRAM_BINS = 64
HISTOGRAM_CHANNEL_BINS = 4
PIL_AREA_RESAMPLE = 4

CROP_RATIOS = {
    "artwork": (0, 0, 1, 0.52),
    "full-card": (0, 0, 1, 1),
}


def require_pillow():
    try:
        from PIL import Image, ImageOps
    except ModuleNotFoundError:
        print(
            "Pillow is required for image index generation. Install it with: python3 -m pip install Pillow",
            file=sys.stderr,
        )
        raise SystemExit(1)

    return Image, ImageOps


def normalize_text(value):
    normalized = unicodedata.normalize("NFD", str(value or "").lower())
    normalized = "".join(
        character for character in normalized if unicodedata.category(character) != "Mn"
    )
    normalized = re.sub(r"[^a-z0-9]+", " ", normalized)
    return normalized.strip()


def normalize_collector_number(value):
    first_part = str(value or "").strip().split("/")[0].strip()
    normalized = re.sub(r"[^a-zA-Z0-9*]", "", first_part).upper()

    if re.match(r"^\d{1,2}\*?$", normalized):
        return normalized.zfill(4 if normalized.endswith("*") else 3)

    return normalized


def get_local_card_id(card):
    number = normalize_collector_number(card.get("number", "000")).lower()
    name_key = normalize_text(card.get("name", "")).replace(" ", "-")
    return f"{card.get('setCode', '').lower()}-{number}-{name_key}"


def get_layout(card):
    card_type = str(card.get("type") or "").lower()
    return "landscape" if "battlefield" in card_type else "portrait"


def get_crop_kind(card):
    # Full-card is the primary matching region for V1: it keeps the artwork,
    # frame, name line, set/number zone, and variant treatment in the visual
    # signature. Battlefields already need full-card because their useful
    # visual signal is landscape-wide.
    return "full-card"


def extract_candidates_source():
    source = SOURCE_PATH.read_text()
    match = re.search(
        r"export const cardmarketCandidates: CardmarketProductMapping\[\] = \[(.*)\];",
        source,
        re.DOTALL,
    )

    if not match:
        raise ValueError(f"Could not find cardmarketCandidates in {SOURCE_PATH}")

    return match.group(1)


def parse_object_literals(array_body):
    candidates = []
    depth = 0
    start = None
    in_string = False
    escaped = False

    for index, character in enumerate(array_body):
        if in_string:
            if escaped:
                escaped = False
            elif character == "\\":
                escaped = True
            elif character == '"':
                in_string = False
            continue

        if character == '"':
            in_string = True
        elif character == "{":
            if depth == 0:
                start = index
            depth += 1
        elif character == "}":
            depth -= 1
            if depth == 0 and start is not None:
                candidates.append(array_body[start : index + 1])
                start = None

    return candidates


def parse_candidate(literal):
    normalized = re.sub(r"(\n\s*)([A-Za-z][A-Za-z0-9]*):", r"\1'\2':", literal)
    normalized = normalized.replace("true", "True").replace("false", "False")
    return ast.literal_eval(normalized)


def load_candidates():
    return [parse_candidate(item) for item in parse_object_literals(extract_candidates_source())]


def get_cache_path(url):
    parsed_url = urlparse(url)
    suffix = Path(parsed_url.path).suffix.lower()

    if suffix not in [".jpg", ".jpeg", ".png", ".webp"]:
        suffix = ".jpg"

    return CACHE_DIR / f"{hashlib.sha256(url.encode()).hexdigest()}{suffix}"


def download_image(url):
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_path = get_cache_path(url)

    if cache_path.exists():
        return cache_path

    request = Request(url, headers={"User-Agent": "riftbound-app-card-image-index/1.0"})

    try:
        with urlopen(request, timeout=30) as response:
            cache_path.write_bytes(response.read())
    except (ssl.SSLCertVerificationError, URLError) as error:
        if "CERTIFICATE_VERIFY_FAILED" not in str(error):
            raise

        # macOS Python installs can lack a configured CA bundle. This generator
        # only downloads public card images into a local cache, so fall back here
        # instead of making every contributor repair their Python install first.
        with urlopen(
            request,
            timeout=30,
            context=ssl._create_unverified_context(),
        ) as response:
            cache_path.write_bytes(response.read())

    return cache_path


def crop_image(image, crop_kind):
    ratio = CROP_RATIOS[crop_kind]
    width, height = image.size
    left = round(width * ratio[0])
    top = round(height * ratio[1])
    right = left + round(width * ratio[2])
    bottom = top + round(height * ratio[3])
    return image.crop((left, top, right, bottom))


def rgb_tiny(image):
    resized = image.resize((THUMBNAIL_SIZE, THUMBNAIL_SIZE), resample=PIL_AREA_RESAMPLE)
    return [channel for pixel in resized.convert("RGB").getdata() for channel in pixel]


def difference_hash(image):
    resized = image.convert("L").resize(
        (DHASH_WIDTH, DHASH_HEIGHT), resample=PIL_AREA_RESAMPLE
    )
    pixels = list(resized.getdata())
    bits = []

    for y in range(DHASH_HEIGHT):
        row_offset = y * DHASH_WIDTH
        for x in range(DHASH_WIDTH - 1):
            bits.append(
                "1" if pixels[row_offset + x] > pixels[row_offset + x + 1] else "0"
            )

    return "".join(
        f"{int(''.join(bits[index:index + 4]), 2):x}"
        for index in range(0, len(bits), 4)
    ).rjust(16, "0")


def color_histogram(rgb_values):
    histogram = [0] * HISTOGRAM_BINS
    pixel_count = len(rgb_values) // 3

    for index in range(pixel_count):
        source_index = index * 3
        red_bin = min(HISTOGRAM_CHANNEL_BINS - 1, rgb_values[source_index] // 64)
        green_bin = min(HISTOGRAM_CHANNEL_BINS - 1, rgb_values[source_index + 1] // 64)
        blue_bin = min(HISTOGRAM_CHANNEL_BINS - 1, rgb_values[source_index + 2] // 64)
        histogram_index = (
            red_bin * HISTOGRAM_CHANNEL_BINS * HISTOGRAM_CHANNEL_BINS
            + green_bin * HISTOGRAM_CHANNEL_BINS
            + blue_bin
        )
        histogram[histogram_index] += 1

    return [value / pixel_count for value in histogram]


def create_signature(image_path, crop_kind):
    Image, ImageOps = require_pillow()

    with Image.open(image_path) as image:
        image = ImageOps.exif_transpose(image).convert("RGB")
        cropped = crop_image(image, crop_kind)
        tiny = rgb_tiny(cropped)

        return {
            "rgbTiny": tiny,
            "dHash": difference_hash(cropped),
            "colorHistogram": color_histogram(tiny),
        }


def render_string(value):
    return json.dumps(value or "")


def render_number_array(values):
    return "[" + ",".join(f"{value:.8g}" if isinstance(value, float) else str(value) for value in values) + "]"


def render_entry(entry):
    signature = entry["signature"]

    return f"""  {{
    cardId: {render_string(entry["cardId"])},
    externalId: {render_string(entry.get("externalId"))},
    name: {render_string(entry["name"])},
    setCode: {render_string(entry["setCode"])},
    number: {render_string(entry["number"])},
    imageUrl: {render_string(entry["imageUrl"])},
    signatureVersion: 1,
    cropKind: {render_string(entry["cropKind"])},
    layout: {render_string(entry["layout"])},
    thumbnailSize: 32,
    histogramBins: 64,
    signature: {{
      rgbTiny: {render_number_array(signature["rgbTiny"])},
      dHash: {render_string(signature["dHash"])},
      colorHistogram: {render_number_array(signature["colorHistogram"])},
    }},
  }},"""


def render_index(entries):
    rows = "\n".join(render_entry(entry) for entry in entries)

    return f"""import type {{ CardImageIndexEntry }} from "../scan-logic/scan-image-signature.types";

// Generated by tools/generate-card-image-index.py.
export const CARD_IMAGE_SIGNATURE_VERSION = 1;

export const CARD_IMAGE_INDEX: CardImageIndexEntry[] = [
{rows}
];
"""


def parse_args():
    parser = argparse.ArgumentParser(
        description="Generate the offline Riftbound card image signature index."
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Generate only the first N image-backed candidates. Useful for compatibility checks.",
    )
    parser.add_argument(
        "--only",
        action="append",
        default=[],
        help="Only generate cards matching a Riftbound id, local card id, or normalized name fragment. May be passed more than once.",
    )
    return parser.parse_args()


def candidate_matches_filters(card, filters):
    if not filters:
        return True

    haystack = " ".join(
        [
            str(card.get("riftboundId") or ""),
            get_local_card_id(card),
            normalize_text(card.get("name", "")),
            str(card.get("setCode") or ""),
            normalize_collector_number(card.get("number", "")),
        ]
    ).lower()

    return any(normalize_text(value).replace(" ", "-") in haystack for value in filters)


def get_generation_candidates(candidates, args):
    filtered_candidates = [
        candidate
        for candidate in candidates
        if candidate.get("imageUrl") and candidate_matches_filters(candidate, args.only)
    ]

    if args.limit > 0:
        return filtered_candidates[: args.limit]

    return filtered_candidates


def main():
    args = parse_args()
    require_pillow()

    candidates = load_candidates()
    generation_candidates = get_generation_candidates(candidates, args)
    entries = []
    errors = []
    skipped = [
        {
            "riftboundId": card.get("riftboundId"),
            "name": card.get("name"),
            "reason": "missing imageUrl",
        }
        for card in candidates
        if not card.get("imageUrl")
    ]

    for card in generation_candidates:
        image_url = card.get("imageUrl")

        try:
            crop_kind = get_crop_kind(card)
            image_path = download_image(image_url)
            entries.append(
                {
                    "cardId": get_local_card_id(card),
                    "externalId": card.get("riftboundId"),
                    "name": card.get("name", ""),
                    "setCode": card.get("setCode", ""),
                    "number": normalize_collector_number(card.get("number", "")),
                    "imageUrl": image_url,
                    "signatureVersion": SIGNATURE_VERSION,
                    "cropKind": crop_kind,
                    "layout": get_layout(card),
                    "thumbnailSize": THUMBNAIL_SIZE,
                    "histogramBins": HISTOGRAM_BINS,
                    "signature": create_signature(image_path, crop_kind),
                }
            )
        except Exception as error:
            errors.append(
                {
                    "riftboundId": card.get("riftboundId"),
                    "name": card.get("name"),
                    "imageUrl": image_url,
                    "error": str(error),
                }
            )

    entries.sort(key=lambda entry: (entry["setCode"], entry["name"], entry["number"]))

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(render_index(entries))
    REPORT_PATH.write_text(
        json.dumps(
            {
                "generatedAt": datetime.now(timezone.utc).isoformat(),
                "signatureVersion": SIGNATURE_VERSION,
                "source": str(SOURCE_PATH.relative_to(ROOT)),
                "output": str(OUTPUT_PATH.relative_to(ROOT)),
                "totalCandidates": len(candidates),
                "generationCandidates": len(generation_candidates),
                "limit": args.limit,
                "only": args.only,
                "indexed": len(entries),
                "skipped": skipped,
                "errors": errors,
                "countBySet": {
                    set_code: sum(1 for entry in entries if entry["setCode"] == set_code)
                    for set_code in sorted({entry["setCode"] for entry in entries})
                },
                "countByLayout": {
                    layout: sum(1 for entry in entries if entry["layout"] == layout)
                    for layout in ["portrait", "landscape"]
                },
                "countByCropKind": {
                    crop_kind: sum(1 for entry in entries if entry["cropKind"] == crop_kind)
                    for crop_kind in ["artwork", "full-card"]
                },
            },
            indent=2,
        )
    )

    print(
        f"Wrote {len(entries)} card image index entries "
        f"from {len(generation_candidates)} generation candidates to {OUTPUT_PATH}."
    )
    print(f"Wrote report to {REPORT_PATH}.")

    if errors:
        print(f"{len(errors)} image(s) failed. See report for details.", file=sys.stderr)


if __name__ == "__main__":
    main()
