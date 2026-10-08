#!/usr/bin/env python3
# Build the skill package for token-panel (run from anywhere).
# Zip root contains SKILL.md (+ references/, LICENSE, README.md).
# Usage: python dev/make-zip.py [output.zip]

import os
import re
import sys
import zipfile

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

with open(os.path.join(REPO, "SKILL.md"), encoding="utf-8") as fh:
    match = re.search(r"^version:\s*([0-9.]+)\s*$", fh.read(), re.MULTILINE)
VERSION = match.group(1) if match else "0.0.0"

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
    os.path.dirname(REPO), f"token-panel-{VERSION}.zip"
)
SKIP_DIRS = {".git", "__pycache__", "references-ignored"}

count = 0
with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
    for root, dirs, files in os.walk(REPO):
        dirs[:] = sorted(d for d in dirs if d not in SKIP_DIRS)
        for name in sorted(files):
            full = os.path.join(root, name)
            rel = os.path.relpath(full, REPO).replace("\\", "/")
            if rel.startswith("dev/"):
                continue
            z.write(full, rel)
            count += 1

names = zipfile.ZipFile(OUT).namelist()
print(f"wrote {OUT} ({count} files, root SKILL.md: {'SKILL.md' in names}, "
      f"references/: {any(n.startswith('references/') for n in names)})")
