#!/usr/bin/env bash
set -euo pipefail

# Usage:
#  SUPABASE_REF=<project-ref> SUPABASE_SERVICE_ROLE_KEY=... RESEND_API_KEY=... APP_URL=... ./scripts/deploy-edge-functions.sh
# Requires: supabase CLI (authenticated)

if [ -z "${SUPABASE_REF:-}" ]; then
  echo "ERROR: SUPABASE_REF environment variable is required (your project ref)"
  exit 1
fi

echo "Deploying Edge Functions to Supabase project: $SUPABASE_REF"

# Deploy the main server orchestrator (make-server-aa5d1aa6)
supabase functions deploy server --project-ref "$SUPABASE_REF"

# Deploy email helpers
supabase functions deploy send-approval-email --project-ref "$SUPABASE_REF"
supabase functions deploy send-rejection-email --project-ref "$SUPABASE_REF"

echo
echo "Edge Functions deployed. Now set secrets (SERVICE ROLE key, RESEND key, APP_URL)"
echo "Example (interactive):"
echo "  supabase secrets set SUPABASE_SERVICE_ROLE_KEY=\$SUPABASE_SERVICE_ROLE_KEY RESEND_API_KEY=\$RESEND_API_KEY APP_URL=\$APP_URL --project-ref $SUPABASE_REF"

echo
echo "Notes:"
echo "- Authenticate the supabase CLI with 'supabase login' before running this script."
echo "- SUPABASE_SERVICE_ROLE_KEY is your Service Role key (keep it secret)."
exit 0
