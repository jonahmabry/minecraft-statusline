#!/usr/bin/env bash
# minecraft-statusline — a Minecraft-themed statusline for Claude Code
# https://github.com/jnmabry/minecraft-statusline
#
# Line 1: model (tinted by "material" — netherite/diamond/gold/iron), dir, git branch, cost, elapsed time, cache tokens
# Line 2: hearts = 5-hour rate limit (depletes as usage climbs), food = 7-day rate limit
# Line 3: XP bar = context window fill percentage
#
# Requires: jq (required), git + curl (for branch info / rate limits)

if ! command -v jq > /dev/null 2>&1; then
  echo "minecraft-statusline: jq is required but not installed (see https://jqlang.org)"
  exit 0
fi

input=$(cat)

MODEL=$(echo "$input" | jq -r '.model.display_name')
DIR=$(echo "$input" | jq -r '.workspace.current_dir')
COST=$(echo "$input" | jq -r '.cost.total_cost_usd // 0')
PCT=$(echo "$input" | jq -r '.context_window.used_percentage // 0' | cut -d. -f1)
DURATION_MS=$(echo "$input" | jq -r '.cost.total_duration_ms // 0')
CACHE_READ=$(echo "$input" | jq -r '.cost.cache_read_input_tokens // 0')
CACHE_WRITE=$(echo "$input" | jq -r '.cost.cache_creation_input_tokens // 0')

NETHERITE='\033[0;90m'; DIAMOND='\033[96m'; GOLD='\033[1;33m'; IRON='\x1b[38;5;251m'; CYAN='\033[36m'; MAGENTA='\033[35m'; RESET='\033[0m'

# ---------- helpers ----------
format_countdown() {
  local resets_at="$1" now diff
  now=$(date +%s); diff=$(( resets_at - now ))
  if [ "$diff" -le 0 ]; then echo "now"
  elif [ "$diff" -lt 3600 ]; then echo "$(( diff / 60 ))m"
  elif [ "$diff" -lt 86400 ]; then echo "$(( diff / 3600 ))h$(( (diff % 3600) / 60 ))m"
  else echo "$(( diff / 86400 ))d$(( (diff % 86400) / 3600 ))h"; fi
}

# 10-icon bar that DEPLETES as usage climbs
render_mc_bar() {
  local used="$1" full="$2" empty="$3"
  local remaining=$(( 100 - ${used%.*} ))
  (( remaining < 0 )) && remaining=0; (( remaining > 100 )) && remaining=100
  local filled=$(( (remaining + 5) / 10 ))
  (( filled > 10 )) && filled=10
  if [ "$filled" -eq 0 ] && [ "$remaining" -gt 0 ]; then filled=1; fi
  local empties=$(( 10 - filled )) i out=""
  for ((i=0; i<filled; i++)); do out="${out}${full}"; done
  for ((i=0; i<empties; i++)); do out="${out}${empty}"; done
  printf '%s' "$out"
}

# N-segment bar that FILLS as usage climbs
render_fill_bar() {
  local pct="$1" full="$2" empty="$3" segs="$4" i out=""
  local filled=$(( pct * segs / 100 ))
  (( filled > segs )) && filled=segs
  local empties=$(( segs - filled ))
  for ((i=0; i<filled; i++)); do out="${out}${full}"; done
  for ((i=0; i<empties; i++)); do out="${out}${empty}"; done
  printf '%s' "$out"
}

fmt_tokens() {
  local n="$1"
  if [ "$n" -ge 1000 ]; then printf '%dk' $(( n / 1000 )); else printf '%d' "$n"; fi
}

# ---------- model color (tints the model name in the header) ----------
MODEL_LC=$(echo "$MODEL" | tr '[:upper:]' '[:lower:]')
case "$MODEL_LC" in
  *fable*)  MODEL_COLOR="$NETHERITE" ;;
  *opus*)   MODEL_COLOR="$DIAMOND" ;;
  *sonnet*) MODEL_COLOR="$GOLD" ;;
  *haiku*)  MODEL_COLOR="$IRON" ;;
  *)        MODEL_COLOR="$IRON" ;;
esac

# ---------- XP bar = context window (fills up as the window fills) ----------
XP_SEGS=26
XP_BAR=$(render_fill_bar "$PCT" "🟩" "⬛" "$XP_SEGS")

# ---------- elapsed time ----------
MINS=$((DURATION_MS / 60000)); SECS=$(((DURATION_MS % 60000) / 1000))
TIME_FMT="⏱️ ${MINS}m ${SECS}s"

# ---------- git branch ----------
BRANCH=""
if git -C "$DIR" rev-parse --git-dir > /dev/null 2>&1; then
  BRANCH_NAME=$(git -C "$DIR" branch --show-current 2>/dev/null)
  DIRTY=""
  PORCELAIN=$(git -C "$DIR" status --porcelain 2>/dev/null)
  if [ -n "$PORCELAIN" ]; then
    if echo "$PORCELAIN" | grep -qE '^[^ ?]'; then DIRTY="*"; else DIRTY="!"; fi
  fi
  BRANCH=" | 🌿 ${BRANCH_NAME}${DIRTY}"
fi

# ---------- rate limits: hearts = 5h, food = 7d ----------
FIVE_PCT=$(echo "$input" | jq -r '.rate_limits.five_hour.used_percentage // empty')
FIVE_RESETS=$(echo "$input" | jq -r '.rate_limits.five_hour.resets_at // empty')
WEEK_PCT=$(echo "$input" | jq -r '.rate_limits.seven_day.used_percentage // empty')
WEEK_RESETS=$(echo "$input" | jq -r '.rate_limits.seven_day.resets_at // empty')

HEALTH_SEG=""
if [ -n "$FIVE_PCT" ]; then
  HEALTH=$(render_mc_bar "$FIVE_PCT" "❤️" "🖤")
  HEALTH_SEG="${HEALTH} ${FIVE_PCT%.*}%"
  [ -n "$FIVE_RESETS" ] && HEALTH_SEG="${HEALTH_SEG} ${MAGENTA}$(format_countdown "$FIVE_RESETS")${RESET}"
fi
FOOD_SEG=""
if [ -n "$WEEK_PCT" ]; then
  FOOD=$(render_mc_bar "$WEEK_PCT" "🍗" "🦴")
  FOOD_SEG="${FOOD} ${WEEK_PCT%.*}%"
  [ -n "$WEEK_RESETS" ] && FOOD_SEG="${FOOD_SEG} ${MAGENTA}$(format_countdown "$WEEK_RESETS")${RESET}"
fi

# ---------- cost + cache ----------
COST_FMT=$(printf '$%.2f' "$COST")
CACHE_SEGMENT=""
if [ "$CACHE_READ" -gt 0 ] || [ "$CACHE_WRITE" -gt 0 ]; then
  CACHE_SEGMENT=" | ${CYAN}↩$(fmt_tokens "$CACHE_READ") ↪$(fmt_tokens "$CACHE_WRITE")${RESET}"
fi

# ---------- render the HUD ----------
# Line 1: info (model name tinted by model), cost, and elapsed time
echo -e "${MODEL_COLOR}[$MODEL]${RESET} 📁 ${DIR##*/}$BRANCH | ${GOLD}${COST_FMT}${RESET} | ${TIME_FMT}${CACHE_SEGMENT}"
# Line 2: hearts + food, close together
echo -e "${HEALTH_SEG}   ${FOOD_SEG}"
# Line 3: XP bar = context window, with the percentage at the end
echo -e "${XP_BAR} ${PCT}%"
