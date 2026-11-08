#!/usr/bin/env bash
#
# One-command deployment: ./deploy.sh   (or: npm run deploy)
#
#   ./deploy.sh                deploy the current commit
#   ./deploy.sh --allow-dirty  deploy uncommitted changes (/health still reports the HEAD commit)
#   ./deploy.sh --allow-downgrade  deploy a commit that does not contain what production runs
#   ./deploy.sh --help         show this help
#
# Steps: preflight -> auth -> current state -> local build -> migrations -> publish -> verify.
# Each step stops the run with a clear message and its own exit code:
#
#   0  deployed and verified
#   2  preflight: missing tool, variable or invalid argument
#   3  Railway, Vercel or GitHub not reachable / not authenticated
#   4  uncommitted changes in what gets published, the commit is not pushed to GitHub, or it
#      would take production back to an older version
#   5  local build failed (nothing was published)
#   6  database migrations failed (nothing was published)
#   7  API publish failed (production keeps the previous API)
#   8  frontend publish failed (rolled back)
#   9  post-deploy verification failed (rolled back)
#  10  rollback did not complete: production needs manual attention
#
# Safe to run again: migrations only apply what is pending, and publishing the same commit
# replaces the previous deployment instead of duplicating anything.
#
# Rollback rehearsal: DEPLOY_SIMULATE_FAILURE=verify ./deploy.sh publishes for real, forces the
# final verification to fail and runs the real rollback.
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

ALLOW_DIRTY=0
ALLOW_DOWNGRADE=0
for arg in "$@"; do
  case "$arg" in
    --allow-dirty) ALLOW_DIRTY=1 ;;
    --allow-downgrade) ALLOW_DOWNGRADE=1 ;;
    -h | --help)
      sed -n '2,29p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      printf 'FAILED  unknown argument: %s (see ./deploy.sh --help)\n' "$arg" >&2
      exit 2
      ;;
  esac
done

REPORTED=0
ROLLBACK_TREE=".deploy/rollback"

step() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
ok() { printf '    ok    %s\n' "$*"; }
warn() { printf '    \033[33mwarn\033[0m  %s\n' "$*"; }
fail() {
  REPORTED=1
  printf '\n\033[31mFAILED\033[0m  %s\n' "$1" >&2
  exit "${2:-1}"
}

cleanup() {
  local code=$?
  if [ -d "$ROLLBACK_TREE" ]; then
    git worktree remove --force "$ROLLBACK_TREE" >/dev/null 2>&1 || true
  fi
  # any failure that did not go through fail() still ends with a readable message
  if [ "$code" -ne 0 ] && [ "$REPORTED" -eq 0 ]; then
    printf '\n\033[31mFAILED\033[0m  unexpected error (exit code %s), see the output above.\n' "$code" >&2
  fi
}
trap cleanup EXIT

# prints one field of a JSON document (dot path); prints nothing when it is absent or invalid
json_field() {
  node -e '
const [doc, path] = process.argv.slice(1);
try {
  const value = path.split(".").reduce((acc, key) => (acc == null ? acc : acc[key]), JSON.parse(doc));
  if (value != null) process.stdout.write(String(value));
} catch {}
' "$1" "$2"
}

# ---------------------------------------------------------------------------
step "1/7 Preflight: tools and environment variables"

# values already exported in the shell win over .env, so CI can inject secrets
if [ -f .env ]; then
  while IFS='=' read -r key value; do
    [[ "$key" =~ ^[A-Z_][A-Z0-9_]*$ ]] || continue
    # strip one pair of surrounding quotes: KEY="value" and KEY='value' mean value
    if [[ "$value" =~ ^\"(.*)\"$ || "$value" =~ ^\'(.*)\'$ ]]; then value="${BASH_REMATCH[1]}"; fi
    [ -n "${!key:-}" ] || export "$key=$value"
  done < <(grep -E '^[A-Z_][A-Z0-9_]*=' .env | sed 's/\r$//')
  ok "variables read from .env"
else
  warn "no .env file: using only the variables exported in this shell"
fi

API_SERVICE="${RAILWAY_API_SERVICE:-api}"
DB_SERVICE="${RAILWAY_DB_SERVICE:-Postgres}"
RAILWAY_ENV="${RAILWAY_ENV:-production}"
SIMULATE="${DEPLOY_SIMULATE_FAILURE:-}"

# collect every missing precondition first, so a single run lists all of them
problems=()
for name in PUBLIC_API_URL PUBLIC_WEB_URL RAILWAY_PROJECT_ID VERCEL_PROJECT_NAME; do
  [ -n "${!name:-}" ] || problems+=("variable $name")
done
for tool in node npm git curl railway vercel; do
  command -v "$tool" >/dev/null 2>&1 || problems+=("tool $tool")
done
if [ -n "$SIMULATE" ] && [ "$SIMULATE" != "verify" ]; then
  problems+=("DEPLOY_SIMULATE_FAILURE='$SIMULATE' (only valid value: verify)")
fi
if [ "${#problems[@]}" -gt 0 ]; then
  printf '    missing  %s\n' "${problems[@]}" >&2
  fail "Preflight incomplete (${#problems[@]} problem(s)). Variables are documented in .env.example, tools in the README." 2
fi

PUBLIC_API_URL="${PUBLIC_API_URL%/}"
PUBLIC_WEB_URL="${PUBLIC_WEB_URL%/}"
RAILWAY_SCOPE=(--project "$RAILWAY_PROJECT_ID" --environment "$RAILWAY_ENV")
ok "tools and variables present (node $(node -v))"
if [ -n "$SIMULATE" ]; then
  warn "rehearsal: the final verification will fail on purpose (DEPLOY_SIMULATE_FAILURE=verify)"
fi

# ---------------------------------------------------------------------------
step "2/7 Authentication"

railway whoami >/dev/null 2>&1 ||
  fail "Railway is not authenticated. Run 'railway login' or export RAILWAY_API_TOKEN." 3
ok "Railway: $(railway whoami 2>/dev/null | head -n1)"

vercel whoami >/dev/null 2>&1 ||
  fail "Vercel is not authenticated. Run 'vercel login' or export VERCEL_TOKEN." 3
ok "Vercel: $(vercel whoami 2>/dev/null | tail -n1)"

(cd apps/web && vercel link --yes --project "$VERCEL_PROJECT_NAME" >/dev/null 2>&1) ||
  fail "Could not link the Vercel project '$VERCEL_PROJECT_NAME'. Check the name in .env." 3

# the API refuses to start without its login accounts: check them before building anything
API_VARS="$(railway variable list --service "$API_SERVICE" "${RAILWAY_SCOPE[@]}" --json 2>/dev/null)" ||
  fail "Could not read the variables of the '$API_SERVICE' service in Railway." 3
missing_auth=()
for name in AUTH_TOKEN_SECRET AUTH_SUPERVISOR_USERNAME AUTH_SUPERVISOR_PASSWORD_HASH AUTH_OPERATOR_USERNAME AUTH_OPERATOR_PASSWORD_HASH; do
  [ -n "$(json_field "$API_VARS" "$name")" ] || missing_auth+=("$name")
done
if [ "${#missing_auth[@]}" -gt 0 ]; then
  printf '    missing  %s\n' "${missing_auth[@]}" >&2
  fail "The API has no login accounts configured in Railway. Generate them with
       AUTH_PASSWORD='...' npm --prefix apps/api run auth:hash
       and set them with: railway variable set NAME=value --service $API_SERVICE" 2
fi
ok "login accounts configured in Railway"

# ---------------------------------------------------------------------------
step "3/7 Version and current production state"

VERSION="$(git rev-parse --short HEAD)"
# only what gets published has to match the commit
if [ -n "$(git status --porcelain -- apps scripts deploy.sh)" ]; then
  if [ "$ALLOW_DIRTY" -eq 0 ]; then
    fail "There are uncommitted changes in apps/, scripts/ or deploy.sh: what gets published would not be $VERSION.
       Commit them, or run ./deploy.sh --allow-dirty." 4
  fi
  warn "dirty tree: publishing the current files, /health will report $VERSION"
fi

# what goes live must also be on GitHub, so the repository always shows what production runs
git fetch --quiet origin 2>/dev/null ||
  fail "Could not reach GitHub (git fetch origin) to check that $VERSION is pushed. Check the connection and retry." 3
if [ -z "$(git branch --remotes --contains HEAD 2>/dev/null)" ]; then
  fail "Commit $VERSION is not on GitHub yet: production would run code the repository does not have.
       Push it first (git push), then run ./deploy.sh again." 4
fi
ok "version to publish: $VERSION (pushed to GitHub)"

# what is live right now is the rollback target; an unreachable service just has none
PREV_API_VERSION="$(json_field "$(curl -fsS -m 15 "$PUBLIC_API_URL/health" 2>/dev/null || true)" version)"
PREV_WEB_DEPLOYMENT="$(json_field "$(cd apps/web && vercel inspect "${PUBLIC_WEB_URL#https://}" --json 2>/dev/null || true)" url)"

if [ -n "$PREV_API_VERSION" ] && git cat-file -e "${PREV_API_VERSION}^{commit}" 2>/dev/null; then
  ok "API in production: $PREV_API_VERSION (rollback target)"
else
  PREV_API_VERSION=""
  warn "API in production has no known version in this repo: no API rollback available (first deploy?)"
fi
if [ -n "$PREV_WEB_DEPLOYMENT" ]; then
  ok "web in production: $PREV_WEB_DEPLOYMENT (rollback target)"
else
  warn "no current frontend deployment found: no frontend rollback available (first deploy?)"
fi

# never take production backwards by accident: migrations are forward-only, so publishing code
# older than what is live leaves the database ahead of the code (for example, data of a type the
# old frontend cannot draw). Same commit and descendants pass; the rollback uses its own path.
ancestor=0
if [ -n "$PREV_API_VERSION" ]; then
  # 0: production is part of this history; 1: it is not (downgrade); anything else: git could
  # not compare them (shallow clone, missing objects). Unverifiable is refused too: fail closed.
  git merge-base --is-ancestor "$PREV_API_VERSION" HEAD || ancestor=$?
fi
if [ "$ancestor" -gt 1 ] && [ "$ALLOW_DOWNGRADE" -eq 0 ]; then
  fail "Could not verify that $VERSION contains the production version $PREV_API_VERSION (git exit $ancestor).
       Fetch the full history (git fetch --unshallow origin) and retry, or run ./deploy.sh --allow-downgrade." 4
elif [ "$ancestor" -gt 1 ]; then
  warn "could not compare $VERSION with production $PREV_API_VERSION: continuing on purpose (--allow-downgrade)"
elif [ "$ancestor" -eq 1 ]; then
  if [ "$ALLOW_DOWNGRADE" -eq 0 ]; then
    fail "Production runs $PREV_API_VERSION, which is not part of the history of $VERSION:
       publishing it would take production back while its database keeps the newer migrations.
       Update your branch (git switch main && git pull), or, if going back is intended,
       run ./deploy.sh --allow-downgrade." 4
  fi
  warn "downgrade on purpose: production runs $PREV_API_VERSION, publishing $VERSION (--allow-downgrade)"
fi

# ---------------------------------------------------------------------------
step "4/7 Local build (nothing is published if this fails)"

(cd apps/api && npm ci --no-audit --no-fund >/dev/null && npm run build >/dev/null) ||
  fail "API build failed. Run 'npm --prefix apps/api run build' to see the error.
       EPERM on Windows means a running dev server or test still holds node_modules: stop it and retry." 5
ok "API built"

(cd apps/web && npm ci --no-audit --no-fund >/dev/null && VITE_API_URL="$PUBLIC_API_URL" npm run build >/dev/null) ||
  fail "Frontend build failed. Run 'npm --prefix apps/web run build' to see the error.
       EPERM on Windows means a running dev server or test still holds node_modules: stop it and retry." 5
ok "frontend built (VITE_API_URL=$PUBLIC_API_URL)"

# ---------------------------------------------------------------------------
step "5/7 Database migrations"

DB_VARS="$(railway variable list --service "$DB_SERVICE" "${RAILWAY_SCOPE[@]}" --json 2>/dev/null)" ||
  fail "Could not read the variables of the '$DB_SERVICE' service in Railway." 6
# the public URL goes through Railway's TCP proxy; older templates only expose its parts
# shellcheck disable=SC2016 # ${...} below is a JavaScript template literal, not bash
DB_URL="$(node -e '
const v = JSON.parse(process.argv[1]);
if (v.DATABASE_PUBLIC_URL) process.stdout.write(v.DATABASE_PUBLIC_URL);
else if (v.RAILWAY_TCP_PROXY_DOMAIN && v.RAILWAY_TCP_PROXY_PORT && v.PGUSER && v.PGPASSWORD && v.PGDATABASE) {
  const auth = `${encodeURIComponent(v.PGUSER)}:${encodeURIComponent(v.PGPASSWORD)}`;
  process.stdout.write(`postgresql://${auth}@${v.RAILWAY_TCP_PROXY_DOMAIN}:${v.RAILWAY_TCP_PROXY_PORT}/${v.PGDATABASE}`);
}
' "$DB_VARS" 2>/dev/null || true)"
[ -n "$DB_URL" ] ||
  fail "The '$DB_SERVICE' service has no public database URL. Enable its public TCP proxy:
       railway tcp-proxy create --port 5432 --service $DB_SERVICE" 6

(cd apps/api && DATABASE_URL="$DB_URL" npx prisma migrate deploy) ||
  fail "Migrations failed (see Prisma's output above). Nothing was published." 6
ok "migrations applied (only pending ones run, so this is safe to repeat)"

# ---------------------------------------------------------------------------
# publish helpers

RAILWAY_STATUS=""

# waits until one Railway deployment (by id) finishes; returns 0 on SUCCESS
wait_railway() {
  local id="$1" deadline=$((SECONDS + 600)) list status
  while :; do
    list="$(railway deployment list --service "$API_SERVICE" "${RAILWAY_SCOPE[@]}" --json 2>/dev/null || true)"
    status="$(node -e '
try {
  const found = JSON.parse(process.argv[1]).find((d) => d.id === process.argv[2]);
  process.stdout.write(found ? found.status : "PENDING");
} catch { process.stdout.write("UNKNOWN"); }
' "$list" "$id")"
    case "$status" in
      SUCCESS) return 0 ;;
      FAILED | CRASHED | REMOVED | SKIPPED)
        RAILWAY_STATUS="$status"
        return 1
        ;;
    esac
    if [ "$SECONDS" -ge "$deadline" ]; then
      RAILWAY_STATUS="timeout (last status: $status)"
      return 1
    fi
    sleep 5
  done
}

# publishes an apps/api directory as the given version and waits until Railway reports SUCCESS
publish_api() {
  local dir="$1" version="$2" out id
  railway variable set "APP_VERSION=$version" "WEB_ORIGIN=$PUBLIC_WEB_URL" \
    --service "$API_SERVICE" "${RAILWAY_SCOPE[@]}" --skip-deploys >/dev/null || return 1
  out="$(railway up "$dir" --path-as-root --service "$API_SERVICE" "${RAILWAY_SCOPE[@]}" --detach --json)" || return 1
  id="$(json_field "$out" deploymentId)"
  [ -n "$id" ] || return 1
  printf '    ...   API build %s uploaded (%s), waiting for Railway\n' "$id" "$version"
  wait_railway "$id"
}

verify() {
  PUBLIC_API_URL="$PUBLIC_API_URL" PUBLIC_WEB_URL="$1" EXPECTED_VERSION="$2" \
    VERIFY_SCOPE="${3:-all}" VERIFY_ATTEMPTS="${4:-6}" VERIFY_LOGIN="${5:-1}" node scripts/verify-deploy.mjs
}

API_PUBLISHED=0
WEB_PROMOTED=0

# restores the previous API commit and frontend deployment, then verifies the restored state
rollback() {
  local reason="$1" code="$2" restored=1
  step "Rollback"

  if [ "$API_PUBLISHED" -eq 1 ]; then
    if [ -z "$PREV_API_VERSION" ]; then
      warn "API: no previous version to restore"
      restored=0
    elif git worktree add --force --detach "$ROLLBACK_TREE" "$PREV_API_VERSION" >/dev/null 2>&1 &&
      publish_api "$ROLLBACK_TREE/apps/api" "$PREV_API_VERSION"; then
      ok "API restored to $PREV_API_VERSION"
    else
      warn "API: could not restore $PREV_API_VERSION ${RAILWAY_STATUS:+(Railway: $RAILWAY_STATUS)}"
      restored=0
    fi
  fi

  if [ "$WEB_PROMOTED" -eq 1 ]; then
    if [ -n "$PREV_WEB_DEPLOYMENT" ] &&
      (cd apps/web && vercel promote "$PREV_WEB_DEPLOYMENT" --yes >/dev/null 2>&1); then
      ok "web: previous deployment promoted again ($PREV_WEB_DEPLOYMENT)"
    else
      warn "web: could not go back to the previous deployment"
      restored=0
    fi
  fi

  if [ "$restored" -eq 1 ] && [ -n "$PREV_API_VERSION" ]; then
    printf '    verifying the restored state\n'
    # the restored version may predate the login, so its check is skipped here
    verify "$PUBLIC_WEB_URL" "$PREV_API_VERSION" all 6 0 || restored=0
  fi

  if [ "$restored" -eq 1 ]; then
    fail "$reason
       Rollback complete: production is back on ${PREV_API_VERSION:-the previous version} and healthy." "$code"
  fi
  fail "$reason
       Rollback did NOT complete: production needs manual attention (railway logs / vercel ls)." 10
}

# ---------------------------------------------------------------------------
step "6/7 Publish"

if ! publish_api apps/api "$VERSION"; then
  # Railway keeps serving the previous deployment when a new one fails: production is intact,
  # only the version variable has to go back for the next restart
  if [ -n "$PREV_API_VERSION" ]; then
    railway variable set "APP_VERSION=$PREV_API_VERSION" --service "$API_SERVICE" "${RAILWAY_SCOPE[@]}" \
      --skip-deploys >/dev/null 2>&1 || true
  fi
  railway logs --service "$API_SERVICE" "${RAILWAY_SCOPE[@]}" --lines 40 2>/dev/null || true
  fail "Railway could not publish the API (${RAILWAY_STATUS:-rejected}). Production keeps ${PREV_API_VERSION:-the previous version}." 7
fi
API_PUBLISHED=1
ok "API: deployment SUCCESS"

# the frontend goes up without its public domain, is checked, and only then promoted
WEB_OUT="$(cd apps/web && vercel deploy --prod --skip-domain --yes --json \
  --build-env "VITE_API_URL=$PUBLIC_API_URL" 2>/dev/null)" || WEB_OUT=""
# shellcheck disable=SC2016 # ${...} below is a JavaScript template literal, not bash
WEB_CANDIDATE="$(node -e '
const out = process.argv[1];
let url = "";
try {
  const doc = JSON.parse(out);
  url = doc.url ?? doc.deployment?.url ?? "";
} catch {}
if (!url) url = out.match(/https:\/\/[a-z0-9-]+\.vercel\.app/i)?.[0] ?? "";
if (url && !url.startsWith("https://")) url = `https://${url}`;
if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(url)) process.stdout.write(url);
' "$WEB_OUT")"
[ -n "$WEB_CANDIDATE" ] || rollback "Vercel did not return the frontend deployment URL (or rejected it)." 8
ok "web: candidate $WEB_CANDIDATE (not public yet)"

candidate_code=0
verify "$WEB_CANDIDATE" "$VERSION" web 3 || candidate_code=$?
case "$candidate_code" in
  0) ok "web: candidate verified" ;;
  3)
    # Vercel Deployment Protection puts a login in front of preview URLs: it can only be
    # checked once it is on the public domain, where the final verification still guards it
    warn "web: the candidate is behind Vercel Deployment Protection, it is verified after promotion"
    ;;
  *) rollback "The frontend candidate failed verification: it was not promoted." 8 ;;
esac

(cd apps/web && vercel promote "$WEB_CANDIDATE" --yes >/dev/null 2>&1) ||
  rollback "Vercel could not promote the candidate to production." 8
WEB_PROMOTED=1
ok "web: promoted to $PUBLIC_WEB_URL"

# ---------------------------------------------------------------------------
step "7/7 Verify both services"

EXPECTED="$VERSION"
ATTEMPTS=6
if [ "$SIMULATE" = "verify" ]; then
  EXPECTED="rehearsal-failure"
  ATTEMPTS=1
fi

verify "$PUBLIC_WEB_URL" "$EXPECTED" all "$ATTEMPTS" ||
  rollback "Post-deploy verification failed: what was published is not healthy." 9

printf '\n\033[32mDeploy %s verified.\033[0m\n' "$VERSION"
printf '  Web     %s\n' "$PUBLIC_WEB_URL"
printf '  API     %s\n' "$PUBLIC_API_URL"
printf '  Health  %s/health\n' "$PUBLIC_API_URL"
