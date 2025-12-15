#!/usr/bin/env bash
set -euo pipefail

BASE="${CREDIHOME_BASE_URL:-https://api-partner.credihome.com.br/v1/production}"

JWT=$(curl -sS -X POST "$BASE/login" \
  -H "Content-Type: application/json" \
  -d "{\"login\":\"$CREDIHOME_LOGIN\",\"password\":\"$CREDIHOME_PASSWORD\"}" \
  | jq -r .token)

CH_HEADER=()
if [[ -n "${CREDIHOME_CHANNEL:-}" ]]; then
  CH_HEADER=(-H "channel: $CREDIHOME_CHANNEL")
fi

curl -i -X POST "$BASE/simulador" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  "${CH_HEADER[@]}" \
  -d '{
    "valorImovel": 400000,
    "valorEntrada": 80000,
    "valorFinanciamento": 320000,
    "prazoPagamento": 360,
    "sistema": "API"
  }'
