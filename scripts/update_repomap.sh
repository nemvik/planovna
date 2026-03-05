#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUT_DIR="$ROOT/.repomap"
OUT_MD="$OUT_DIR/REPOMAP.md"
OUT_JSON="$OUT_DIR/repomap.json"

mkdir -p "$OUT_DIR"

# Tree snapshot (portable, no external deps)
python3 - <<'PY' "$ROOT" "$OUT_MD" "$OUT_JSON"
import json, os, sys, datetime
root, out_md, out_json = sys.argv[1], sys.argv[2], sys.argv[3]
ignore_dirs = {'.git','node_modules','.next','dist','build','coverage','.venv','venv','__pycache__','.repomap'}
max_depth = 4

entries = []
for cur, dirs, files in os.walk(root):
    rel = os.path.relpath(cur, root)
    depth = 0 if rel == '.' else rel.count(os.sep) + 1
    dirs[:] = [d for d in dirs if d not in ignore_dirs and depth < max_depth]
    files = [f for f in files if not f.endswith(('.log','.pyc'))]
    entries.append((rel, sorted(dirs), sorted(files)))

now = datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00', 'Z')
lines = ["# REPOMAP", "", f"Generated: {now}", "", "## Tree (depth<=4)"]
for rel, dirs, files in entries:
    base = '.' if rel == '.' else rel
    lines.append(f"- {base}/")
    for d in dirs:
        lines.append(f"  - {d}/")
    for f in files:
        lines.append(f"  - {f}")

with open(out_md, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines) + '\n')

payload = {
    'generatedAt': now,
    'root': root,
    'maxDepth': max_depth,
    'entries': [
        {'path': rel, 'dirs': dirs, 'files': files}
        for rel, dirs, files in entries
    ],
}
with open(out_json, 'w', encoding='utf-8') as f:
    json.dump(payload, f, ensure_ascii=False, indent=2)
PY

echo "[repomap] updated: $OUT_MD"
