#!/usr/bin/env python3
"""Refresh test/fixtures from the public Azure metadata endpoints. No API key."""

import json
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "test" / "fixtures"
URLS = {
    "math": "https://alxo.azurewebsites.net/api/math?id={}",
    "rgb": "https://alxo.azurewebsites.net/api/RGB?id={}",
    "toon": "https://alxo.azurewebsites.net/api/TOON?id={}",
}
IDS = {
    "math": [0, 1, 11, 69, 101, 650, 5851, 8184, 123456789, 999999999, 10**18],
    "rgb": [0, 1, 2, 50, 100, 187, 188],
    "toon": [1, 505, 1973, 1993, 2502, 101010, 125467],
}


def main():
    for kind, ids in IDS.items():
        for i in ids:
            url = URLS[kind].format(i)
            with urllib.request.urlopen(url, timeout=60) as res:
                body = json.load(res)
            path = ROOT / kind / f"{i}.json"
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps(body, ensure_ascii=False, indent=2) + "\n")
            print(path)


if __name__ == "__main__":
    main()
