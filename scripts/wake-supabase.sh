#!/bin/bash
# =========================================================================
# SmartLink Git Quiz — Supabase Keep-Alive Ping
# Pings Supabase REST API to prevent project auto-pause before the webinar.
# =========================================================================

SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-https://placeholder-project.supabase.co}"
ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY:-placeholder-anon-key}"

echo "📡 Waking up Supabase project: $SUPABASE_URL"

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY" \
  "$SUPABASE_URL/rest/v1/events?select=id&limit=1" || echo "000")

if [ "$HTTP_STATUS" -eq 200 ] || [ "$HTTP_STATUS" -eq 206 ]; then
  echo "✅ Supabase is ACTIVE and responding (HTTP $HTTP_STATUS)"
else
  echo "⚠️ Supabase responded with HTTP $HTTP_STATUS (or using local fallback)"
fi
