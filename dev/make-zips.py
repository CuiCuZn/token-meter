#!/usr/bin/env python3
# Build the two release packages for token-meter (run from anywhere):
#   token-meter-<ver>.zip        插件包（根目录含 .qoder-plugin/plugin.json）
#   token-panel-skill-<ver>.zip  技能包（根目录含 SKILL.md）
#
# Usage: python dev/make-zips.py [output-dir]   (default: repo's parent directory)

import json
import os
import sys
import zipfile

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.dirname(REPO)
SKIP_DIRS_PLUGIN = {".git", "node_modules", "__pycache__", "dev"}

with open(os.path.join(REPO, ".qoder-plugin", "plugin.json"), encoding="utf-8") as fh:
    VERSION = json.load(fh)["version"]

plugin_zip = os.path.join(OUT_DIR, f"token-meter-{VERSION}.zip")
skill_zip = os.path.join(OUT_DIR, f"token-panel-skill-{VERSION}.zip")


def add_file(zf, full, arcname):
    zf.write(full, arcname)
    return 1


# --- plugin zip: whole repo, minus VCS / caches / maintainer tooling ---
count = 0
with zipfile.ZipFile(plugin_zip, "w", zipfile.ZIP_DEFLATED) as z:
    for root, dirs, files in os.walk(REPO):
        dirs[:] = sorted(d for d in dirs if d not in SKIP_DIRS_PLUGIN)
        for name in sorted(files):
            full = os.path.join(root, name)
            rel = os.path.relpath(full, REPO).replace("\\", "/")
            count += add_file(z, full, rel)
print(f"plugin zip: {plugin_zip} ({count} files, root manifest ok: "
      f"{'.qoder-plugin/plugin.json' in zipfile.ZipFile(plugin_zip).namelist()})")

# --- skill zip: SKILL.md at root + references/ + LICENSE + README ---
skill_src = os.path.join(REPO, "skills", "token-panel")
count = 0
with zipfile.ZipFile(skill_zip, "w", zipfile.ZIP_DEFLATED) as z:
    count += add_file(z, os.path.join(skill_src, "SKILL.md"), "SKILL.md")
    for root, dirs, files in os.walk(os.path.join(skill_src, "references")):
        dirs[:] = sorted(d for d in dirs if d not in SKIP_DIRS_PLUGIN)
        for name in sorted(files):
            full = os.path.join(root, name)
            rel = os.path.relpath(full, skill_src).replace("\\", "/")
            count += add_file(z, full, rel)
    for extra in ("LICENSE", "README.md"):
        path = os.path.join(REPO, extra)
        if os.path.exists(path):
            count += add_file(z, path, extra)
names = zipfile.ZipFile(skill_zip).namelist()
print(f"skill  zip: {skill_zip} ({count} files, root SKILL.md ok: {'SKILL.md' in names})")
