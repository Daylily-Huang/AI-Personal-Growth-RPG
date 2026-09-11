#!/usr/bin/env bash
# Phase 7 Round 3 — §19 browser/emulation matrix capture.
#
# Runs a DEDICATED headless Chrome instance (own --user-data-dir) only.
# It never enumerates, signals, or terminates any other browser process.
#
# For every (route, preference, width) the script records:
#   - DOM snapshot            -> dumps/<idx>-<route>__<width>__<pref>.html
#   - SHA-256 of that DOM     -> for byte-level parity comparison per route/width
#   - full-page screenshot    -> shots/<idx>-<route>__<width>__<pref>.png
# and a machine-readable results.tsv plus a summary.
#
# Physical device, VoiceOver, NVDA and JAWS are NOT exercised here.

set -u
CHROME="/mnt/c/Program Files/Google/Chrome/Application/chrome.exe"
BASE="${MATRIX_BASE_URL:-http://127.0.0.1:3124}"
M=/mnt/d/AI_Personal_Growth_RPG/.codex/r3fix
OUT="$M/matrix"
PROF='D:\AI_Personal_Growth_RPG\.codex\r3fix\matrix-profile'
DUMP="$OUT/dumps"
SHOTS="$OUT/shots"
WIN_SHOTS='D:\AI_Personal_Growth_RPG\.codex\r3fix\matrix\shots'

mkdir -p "$DUMP" "$SHOTS"
: > "$OUT/results.tsv"
printf "idx\troute\twidth\tpref\thttp\tdom_bytes\tdom_sha256\tshot_bytes\n" >> "$OUT/results.tsv"

ROUTES=(
  "/|root"
  "/login|login"
  "/dashboard|dashboard"
  "/quests|quests"
  "/skills|skills"
  "/skills?view=table|skills-table"
  "/knowledge|knowledge"
  "/knowledge?view=table|knowledge-table"
  "/artifacts|artifacts"
)
WIDTHS=(375 768 1024 1440)
PREFS=("no-preference" "reduce")

idx=0
for entry in "${ROUTES[@]}"; do
  route="${entry%%|*}"
  name="${entry##*|}"
  for pref in "${PREFS[@]}"; do
    for width in "${WIDTHS[@]}"; do
      idx=$((idx + 1))
      id=$(printf "%03d" "$idx")
      tag="${name}__${width}__${pref}"

      extra=()
      if [ "$pref" = "reduce" ]; then extra+=(--force-prefers-reduced-motion); fi

      html="$DUMP/${id}-${tag}.html"
      png="$SHOTS/${id}-${tag}.png"

      # DOM: stdout redirection is resolved on the WSL side, so a Linux path is fine.
      timeout 180 "$CHROME" --headless=new --disable-gpu --no-first-run \
        --no-default-browser-check --user-data-dir="$PROF" \
        --window-size="${width},900" --virtual-time-budget=14000 \
        "${extra[@]+"${extra[@]}"}" \
        --dump-dom "$BASE$route" > "$html" 2>/dev/null

      # Screenshot: Chrome runs on Windows, so it needs a Windows path.
      timeout 180 "$CHROME" --headless=new --disable-gpu --no-first-run \
        --no-default-browser-check --user-data-dir="$PROF" \
        --window-size="${width},900" --virtual-time-budget=14000 \
        "${extra[@]+"${extra[@]}"}" \
        --screenshot="$WIN_SHOTS\\${id}-${tag}.png" "$BASE$route" >/dev/null 2>&1

      http=$(timeout 30 curl -s -o /dev/null -w "%{http_code}" "$BASE$route")
      bytes=$(wc -c < "$html" | tr -d ' ')
      sha=$(sha256sum "$html" | cut -d' ' -f1)
      shot=0
      [ -f "$png" ] && shot=$(wc -c < "$png" | tr -d ' ')
      [ "$shot" = "0" ] && png=""

      printf "%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n" \
        "$id" "$route" "$width" "$pref" "$http" "$bytes" "$sha" "$shot" >> "$OUT/results.tsv"
      echo "[$id] ${name}@${width}/${pref} http=$http dom=${bytes}B shot=${shot}B"
    done
  done
done

echo
echo "=== 语义一致性核对：同 route+width 下两种偏好的 DOM 是否逐字节相同 ==="
python3 - <<'PY'
import csv, collections
rows = list(csv.DictReader(open("/mnt/d/AI_Personal_Growth_RPG/.codex/r3fix/matrix/results.tsv"), delimiter="\t"))
groups = collections.defaultdict(dict)
for r in rows:
    groups[(r["route"], r["width"])][r["pref"]] = (r["dom_sha256"], r["dom_bytes"])
diff = 0
blank = 0
for (route, width), prefs in sorted(groups.items()):
    a = prefs.get("no-preference"); b = prefs.get("reduce")
    if not a or not b:
        continue
    if int(a[1]) < 5000:
        blank += 1
        print(f"  EMPTY? {route}@{width}: {a[1]}B")
    if a[0] != b[0]:
        diff += 1
        print(f"  DIFF   {route}@{width}: normal={a[1]}B reduce={b[1]}B")
print(f"cells compared={len(groups)}  dom-differs={diff}  suspiciously-small={blank}")
PY
