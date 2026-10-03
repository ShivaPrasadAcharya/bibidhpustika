#!/usr/bin/env python3
"""Validate the manually maintained links.json and build the static catalogue."""
import argparse
import json
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]


def load_entries():
    try:
        rows = json.loads((ROOT / "links.json").read_text(encoding="utf-8-sig"))
    except (OSError, ValueError) as error:
        raise ValueError(f"Cannot read links.json: {error}") from error
    if not isinstance(rows, list):
        raise ValueError("links.json must contain a JSON array of subject/url entries.")
    entries = []
    for number, row in enumerate(rows, 1):
        if not isinstance(row, dict) or set(row) != {"subject", "url"}:
            raise ValueError(f"Entry {number}: provide only subject and url; SN is automatic.")
        if not isinstance(row["subject"], str) or not row["subject"].strip():
            raise ValueError(f"Entry {number}: subject must be nonempty text.")
        value = row["url"]
        if not isinstance(value, str):
            raise ValueError(f"Entry {number}: url must be text.")
        value = value.strip()
        try:
            url = urlsplit(value)
            valid = (url.scheme in {"http", "https"} and bool(url.hostname)
                     and not url.username and not url.password
                     and not re.search(r"[\s\x00-\x1f\x7f]", value))
            url.port  # Validate a supplied port, if present.
        except ValueError:
            valid = False
        if not valid:
            raise ValueError(f"Entry {number}: use a complete http:// or https:// URL without spaces or login details.")
        entries.append({"subject": row["subject"].strip(), "url": value})
    return entries


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--site", action="store_true", help="Package the public site in _site.")
    args = parser.parse_args()
    try:
        entries = load_entries()
    except ValueError as error:
        parser.exit(1, f"{error}\n")
    data = {"entries": entries, "generatedAt": datetime.now(timezone.utc).isoformat()}
    (ROOT / "links-index.js").write_text(
        "/* Generated from links.json. Edit links.json to add or change links. */\n"
        + "window.BIBIDH_INDEX = " + json.dumps(data, ensure_ascii=False, indent=2) + ";\n",
        encoding="utf-8")
    if args.site:
        site = ROOT / "_site"
        if site.exists():
            shutil.rmtree(site)
        site.mkdir()
        for name in ("index.html", "links-index.js", "links.json", ".nojekyll"):
            shutil.copy2(ROOT / name, site / name)
        shutil.copytree(ROOT / "assets", site / "assets")
    print(f"Indexed {len(entries)} links. SN is assigned automatically in entry order.")


if __name__ == "__main__":
    main()
