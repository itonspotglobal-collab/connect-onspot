#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# validate-og.sh  — Validate Open Graph metadata across OnSpot public routes
#
# Usage:
#   ./scripts/validate-og.sh              # tests localhost:5000 (default)
#   ./scripts/validate-og.sh https://onspotglobal.com   # tests production
#
# Exit code: 0 = all checks passed, 1 = one or more failures
# ──────────────────────────────────────────────────────────────────────────────

BASE_URL="${1:-http://localhost:5000}"
PASS=0
FAIL=0
OLD_TITLE="Superhuman Outsourcing System"
BOT_UA="facebookexternalhit/1.1"

# Colour helpers (no-op if not a terminal)
RED="\033[0;31m"; GREEN="\033[0;32m"; YELLOW="\033[1;33m"; RESET="\033[0m"
ok()   { echo -e "  ${GREEN}✓${RESET} $*"; ((PASS++)); }
fail() { echo -e "  ${RED}✗${RESET} $*"; ((FAIL++)); }
info() { echo -e "${YELLOW}▶${RESET} $*"; }

# ── Helper: fetch a page and run checks ──────────────────────────────────────
check_page() {
  local url="$1"
  local expected_title="$2"

  info "$url"
  local body
  body=$(curl -s -A "$BOT_UA" "$url")

  # Old title must not appear
  if echo "$body" | grep -q "$OLD_TITLE"; then
    fail "Old title '${OLD_TITLE}' still present"
  else
    ok "No old title"
  fi

  # og:image must exist and be absolute HTTPS
  local og_img
  og_img=$(echo "$body" | grep -oP 'property="og:image"\s+content="\K[^"]+')
  if [[ -z "$og_img" ]]; then
    fail "og:image missing"
  elif [[ "$og_img" != https://* ]]; then
    fail "og:image is not an absolute HTTPS URL: $og_img"
  else
    ok "og:image = $og_img"
  fi

  # og:image:width / height
  if echo "$body" | grep -q 'og:image:width.*1200'; then
    ok "og:image:width = 1200"
  else
    fail "og:image:width != 1200"
  fi

  # title tag must not be empty
  local title_tag
  title_tag=$(echo "$body" | grep -oP '<title>\K[^<]+')
  if [[ -z "$title_tag" ]]; then
    fail "title tag is empty"
  else
    ok "title = $title_tag"
  fi

  # twitter:card
  if echo "$body" | grep -q 'twitter:card.*summary_large_image'; then
    ok "twitter:card = summary_large_image"
  else
    fail "twitter:card missing or wrong"
  fi

  # No duplicate og:title
  local count
  count=$(echo "$body" | grep -c 'property="og:title"' || true)
  if [[ "$count" -le 1 ]]; then
    ok "No duplicate og:title ($count found)"
  else
    fail "Duplicate og:title ($count found)"
  fi

  echo ""
}

# ── Helper: verify image URL ──────────────────────────────────────────────────
check_image() {
  local url="$1"
  info "Image: $url"

  local status content_type
  status=$(curl -s -o /dev/null -w "%{http_code}" "$url")
  content_type=$(curl -s -o /dev/null -w "%{content_type}" "$url")
  local first_bytes
  first_bytes=$(curl -s "$url" | head -c 8 | xxd -p 2>/dev/null || true)

  if [[ "$status" == "200" ]]; then
    ok "HTTP $status"
  else
    fail "HTTP $status (expected 200)"
  fi

  if echo "$content_type" | grep -q "image/"; then
    ok "Content-Type: $content_type"
  else
    fail "Content-Type: $content_type (expected image/*)"
  fi

  # PNG magic bytes: 89504e47
  if echo "$first_bytes" | grep -qi "89504e47"; then
    ok "Valid PNG signature"
  else
    fail "Not a valid PNG (first bytes: $first_bytes)"
  fi

  echo ""
}

# ── Run checks ────────────────────────────────────────────────────────────────
echo ""
echo "OnSpot OG Metadata Validator"
echo "Base URL: $BASE_URL"
echo "────────────────────────────────────────────────"
echo ""

check_page "$BASE_URL/"                               "OnSpot – Work Without Limits"
check_page "$BASE_URL/find-work/jobs"                 "Remote Jobs | OnSpot"
check_page "$BASE_URL/find-work"                      "Find Work | OnSpot"
check_page "$BASE_URL/insights"                       "Insights | OnSpot"
check_page "$BASE_URL/hire-talent"                    "Hire Talent | OnSpot"
check_page "$BASE_URL/faq"                            "FAQ | OnSpot"
check_page "$BASE_URL/pricing"                        "Pricing | OnSpot"
check_page "$BASE_URL/?preview=v3"                    "OnSpot – Work Without Limits"

check_image "https://onspotglobal.com/onspot-social-preview-v3.png"

# ── Summary ───────────────────────────────────────────────────────────────────
echo "────────────────────────────────────────────────"
echo -e "Results: ${GREEN}${PASS} passed${RESET}  ${RED}${FAIL} failed${RESET}"
echo ""

if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
