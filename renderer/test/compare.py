#!/usr/bin/env python3
"""Compare a renderer data URI to a saved Azure metadata snapshot."""

import base64
import json
import math
import sys


def decode_data(uri, mime):
    prefix = f"data:{mime};base64,"
    if not uri.startswith(prefix):
        raise SystemExit(f"expected {prefix}, got {uri[:80]!r}")
    return base64.b64decode(uri[len(prefix):])


def utf_suffix(n):
    """The three code-point readings Azure appends and the renderer drops."""
    hex64 = f"{n:064x}"

    def keep(ch):
        if ch == "":
            return True
        o = ord(ch)
        if ch in ['"', "\\", "\b", "\f", "\n", "\r", "\t"]:
            return True
        if o < 0x20:
            return False
        units = 2 if o > 0xFFFF else 1
        return units + 2 < 8

    def one(k):
        width = k // 4
        out = []
        for i in range(0, 64, width):
            cp = int(hex64[i : i + width], 16)
            ch = "" if cp > 0x10FFFF else chr(cp)
            if keep(ch):
                out.append(ch)
        return "".join(out)

    return "\n\n" + "\n\n".join(one(k) for k in (8, 16, 32))


def attrs(items):
    return [(a["trait_type"], a["value"]) for a in items]


def close(a, b):
    return math.isclose(float(a), float(b), rel_tol=0, abs_tol=1e-6)


def main():
    uri, path = sys.argv[1], sys.argv[2]
    got = json.loads(decode_data(uri, "application/json"))
    azure = json.load(open(path))
    svg = decode_data(got["image"], "image/svg+xml").decode("utf-8")
    errors = []

    if svg != azure["image_data"]:
        n = min(len(svg), len(azure["image_data"]))
        i = next((k for k in range(n) if svg[k] != azure["image_data"][k]), n)
        errors.append(
            f"svg mismatch at {i}: {svg[max(0,i-40):i+40]!r} vs {azure['image_data'][max(0,i-40):i+40]!r}"
        )

    if "external_url" in got or "image_data" in got:
        errors.append(f"unexpected keys {sorted(got)}")

    if "name" in azure or "name" in got:
        if got.get("name") != azure.get("name"):
            errors.append(f"name {got.get('name')!r} != {azure.get('name')!r}")

    if "background_color" in azure or "background_color" in got:
        if got.get("background_color") != azure.get("background_color"):
            errors.append(
                f"background_color {got.get('background_color')!r} != {azure.get('background_color')!r}"
            )

    if "description" in azure:
        desc = got.get("description", "")
        suffix = utf_suffix(int(azure["name"]))
        if azure["description"] != desc + suffix:
            errors.append("description is not azure's text with the utf sections removed")
            errors.append(f"got tail {desc[-20:]!r}")
            errors.append(f"azure head {azure['description'][:80]!r}")

    ga, aa = attrs(got["attributes"]), attrs(azure["attributes"])
    if len(ga) != len(aa):
        errors.append(f"attribute count {len(ga)} != {len(aa)}")
    for (gt, gv), (at, av) in zip(ga, aa):
        if gt != at:
            errors.append(f"trait {gt!r} != {at!r}")
        elif gt == "digit_mean":
            if not close(gv, av):
                errors.append(f"digit_mean {gv} != {av}")
        elif gv != av:
            errors.append(f"{gt} {gv!r} != {av!r}")

    want = {"image", "attributes"}
    if "name" in azure:
        want.add("name")
    if "description" in azure:
        want.add("description")
    if "background_color" in azure:
        want.add("background_color")
    if set(got) != want:
        errors.append(f"keys {sorted(got)} != {sorted(want)}")

    if errors:
        sys.stdout.write("\n".join(errors))
    else:
        sys.stdout.write("ok")


if __name__ == "__main__":
    main()
