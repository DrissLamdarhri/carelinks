# Script to set Supabase anon key
# Usage: .\setup-supabase-key.ps1 "your-anon-key-here"

param(
    [Parameter(Mandatory=$true)]
    [string]$AnonKey
)

$envFile = "C:\carelink\mobile-app\.env.local"

if (-not (Test-Path $envFile)) {
    Write-Host "ERROR: File not found: $envFile" -ForegroundColor Red
    exit 1
}

$content = @"
EXPO_PUBLIC_SUPABASE_URL=https://wjhzrovmktekfcjohhrw.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=$AnonKey
"@

Set-Content -Path $envFile -Value $content -Encoding UTF8 -NoNewline

Write-Host "✓ Updated: $envFile" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:"
Write-Host "1. The dev server will reload automatically"
Write-Host "2. If not, restart with: cd C:\carelink\mobile-app && pnpm start"
