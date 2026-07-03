param(
  [string]$SupabaseRef = $env:SUPABASE_REF
)

if (-not $SupabaseRef) {
  Write-Error "SUPABASE_REF is required (pass -SupabaseRef or set env SUPABASE_REF)"
  exit 1
}

Write-Host "Deploying Edge Functions to Supabase project: $SupabaseRef"

# Deploy functions (requires supabase CLI installed & authenticated)
supabase functions deploy server --project-ref $SupabaseRef
supabase functions deploy send-approval-email --project-ref $SupabaseRef
supabase functions deploy send-rejection-email --project-ref $SupabaseRef

Write-Host "Edge Functions deployed.\nSet secrets (SERVICE ROLE key, RESEND key, APP_URL) using the supabase CLI:" -ForegroundColor Green
Write-Host "  supabase secrets set SUPABASE_SERVICE_ROLE_KEY=`$SUPABASE_SERVICE_ROLE_KEY RESEND_API_KEY=`$RESEND_API_KEY APP_URL=`$APP_URL --project-ref $SupabaseRef" -ForegroundColor Yellow
Write-Host "Note: authenticate the supabase CLI with 'supabase login' before running this script." -ForegroundColor Cyan
