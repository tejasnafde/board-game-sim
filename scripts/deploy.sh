#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# All config is EXPLICIT — never rely on gcloud/vercel personal defaults.
: "${BGS_GCP_PROJECT:?set BGS_GCP_PROJECT (gcloud project id)}"
: "${BGS_GCP_REGION:?set BGS_GCP_REGION (e.g. asia-south1)}"
: "${BGS_GCP_ACCOUNT:?set BGS_GCP_ACCOUNT (gcloud account email — personal, not work)}"
SERVICE="${BGS_SERVICE:-board-game-sim}"
# 0 = scale to zero (free-ish, in-memory games die on idle); 1 = games survive idle.
MIN_INSTANCES="${BGS_MIN_INSTANCES:-0}"

echo "▶ playability gates (vitest incl. self-play)"
npm test

echo "▶ backend → Cloud Run ($BGS_GCP_PROJECT / $BGS_GCP_REGION / $SERVICE)"
# max-instances=1 is NOT an optimization: sessions are in-memory, a second
# instance would split players into parallel universes.
gcloud run deploy "$SERVICE" \
  --source . \
  --account "$BGS_GCP_ACCOUNT" \
  --project "$BGS_GCP_PROJECT" \
  --region "$BGS_GCP_REGION" \
  --allow-unauthenticated \
  --max-instances 1 \
  --min-instances "$MIN_INSTANCES" \
  --session-affinity \
  --timeout 3600 \
  --quiet

RUN_URL=$(gcloud run services describe "$SERVICE" \
  --account "$BGS_GCP_ACCOUNT" --project "$BGS_GCP_PROJECT" --region "$BGS_GCP_REGION" \
  --format 'value(status.url)')
WS_URL="wss://${RUN_URL#https://}/realtime"
echo "▶ backend live: $RUN_URL"

echo "▶ frontend build (VITE_WS_URL=$WS_URL)"
VITE_WS_URL="$WS_URL" npm run build:web

echo "▶ frontend → Vercel"
(cd packages/web-client/app/dist && vercel link --yes --project board-game-sim && vercel deploy --prod --yes)

echo "✅ done — share the Vercel URL. New games need nothing extra: just rerun this."
