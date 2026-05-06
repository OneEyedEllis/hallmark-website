#!/usr/bin/env python3
import csv
import json
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path


def to_float(value):
    if value is None:
        return None
    text = str(value).strip().replace("$", "").replace(",", "")
    if not text:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def first_nonempty(row, keys):
    for key in keys:
        val = row.get(key)
        if val is not None and str(val).strip():
            return str(val).strip()
    return ""


def extract_year(text):
    if not text:
        return ""
    m = re.search(r"\b(19\d{2}|20\d{2})\b", text)
    return m.group(1) if m else ""


def extract_code(text):
    if not text:
        return ""
    m = re.search(r"\b(?:QXC|QDB|DB)\d{4}\b", text, re.IGNORECASE)
    return m.group(0).upper() if m else ""


def infer_series(name, description, code, source):
    hay = f"{name} {description} {code}".lower()
    if "barbie" in hay:
        return "Barbie"
    if "christmas window" in hay:
        return "Christmas Windows"
    if "nativity" in hay or "holy family" in hay or "magi" in hay:
        return "Nativity"
    if "frosty friends" in hay:
        return "Frosty Friends"
    if "toymaker santa" in hay:
        return "Toymaker Santa"
    if "father christmas" in hay:
        return "Father Christmas"
    if source == "koc" or "koc" in hay or "club" in hay:
        return "KOC"
    return "General"


def resolve_and_copy_photo(filename, photo_sources, out_photo_dir):
    if not filename:
        return "", ""
    for folder in photo_sources:
        candidate = folder / filename
        if candidate.exists():
            out_path = out_photo_dir / filename
            if not out_path.exists():
                shutil.copy2(candidate, out_path)
            rel = out_path.relative_to(out_photo_dir.parent.parent).as_posix()
            return rel, str(candidate.relative_to(folder.parent))
    return "", ""


def build():
    website_dir = Path(__file__).resolve().parent
    root_dir = website_dir.parent

    koc_csv = root_dir / "catalog_koc_mergedandcorrected.csv"
    upc_csv = root_dir / "catalog_upc_nokoc.csv"

    output_json = website_dir / "data.json"
    output_csv = website_dir / "catalog_all_ornaments.csv"
    out_photo_dir = website_dir / "assets" / "photos"
    out_photo_dir.mkdir(parents=True, exist_ok=True)
    # Rebuild image set from scratch to avoid stale/wrong files from older source mixes.
    for existing in out_photo_dir.iterdir():
        if existing.is_file():
            existing.unlink()

    photo_sources = [
        root_dir / "photos_koc",
        root_dir / "photos_upc",
        root_dir / "uncategorized_photos",
    ]

    ornaments = []

    # Source 1: catalog_koc_mergedandcorrected.csv
    with koc_csv.open("r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for idx, row in enumerate(reader, start=1):
            name = first_nonempty(row, ["name", "official_name", "title"])
            description = first_nonempty(row, ["description"])
            code = first_nonempty(row, ["koc_code", "code"])
            upc = first_nonempty(row, ["upc"])
            photo_filename = first_nonempty(row, ["photo_filename", "image_filename"])
            image_path, image_source = resolve_and_copy_photo(
                photo_filename, photo_sources, out_photo_dir
            )
            year = first_nonempty(row, ["year"]) or extract_year(name)
            approx_value = to_float(first_nonempty(row, ["approx_retail_usd", "approx_value_usd"]))
            series = first_nonempty(row, ["series"]) or infer_series(
                name, description, code, "koc"
            )

            ornaments.append(
                {
                    "id": f"koc-{idx}",
                    "source": "catalog_koc",
                    "code": code,
                    "upc": upc,
                    "name": name or "(Unnamed Ornament)",
                    "year": year,
                    "series": series,
                    "approx_retail_usd": approx_value,
                    "photo_filename": photo_filename,
                    "image_path": image_path,
                    "image_source": image_source,
                    "description": description,
                    "details": row,
                }
            )

    # Source 2: catalog_upc_nokoc.csv
    with upc_csv.open("r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for idx, row in enumerate(reader, start=1):
            title = first_nonempty(row, ["title", "name", "official_name"])
            description = first_nonempty(row, ["description"])
            code = extract_code(f"{title} {description}")
            upc = first_nonempty(row, ["upc"])
            photo_filename = first_nonempty(row, ["photo_filename", "image_filename"])
            image_path, image_source = resolve_and_copy_photo(
                photo_filename, photo_sources, out_photo_dir
            )
            year = first_nonempty(row, ["year"]) or extract_year(f"{title} {description}")
            approx_value = to_float(first_nonempty(row, ["approx_retail_usd", "approx_value_usd"]))
            series = first_nonempty(row, ["series"]) or infer_series(
                title, description, code, "upc"
            )

            ornaments.append(
                {
                    "id": f"upc-{idx}",
                    "source": "catalog_upc_nokoc",
                    "code": code,
                    "upc": upc,
                    "name": title or "(Untitled Ornament)",
                    "year": year,
                    "series": series,
                    "approx_retail_usd": approx_value,
                    "photo_filename": photo_filename,
                    "image_path": image_path,
                    "image_source": image_source,
                    "description": description,
                    "details": row,
                }
            )

    payload = {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "sources": [koc_csv.name, upc_csv.name],
        "count": len(ornaments),
        "ornaments": ornaments,
    }

    with output_json.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    csv_fields = [
        "id",
        "source",
        "code",
        "upc",
        "name",
        "year",
        "series",
        "approx_retail_usd",
        "photo_filename",
        "image_path",
        "description",
    ]
    with output_csv.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=csv_fields)
        writer.writeheader()
        for ornament in ornaments:
            writer.writerow({key: ornament.get(key, "") for key in csv_fields})

    print(f"Wrote {output_json}")
    print(f"Wrote {output_csv}")
    print(f"Total ornaments: {len(ornaments)}")
    print(f"Copied/resolved photos into: {out_photo_dir}")


if __name__ == "__main__":
    build()

