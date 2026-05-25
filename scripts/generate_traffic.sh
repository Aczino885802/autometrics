#!/bin/bash
# AutoMetrics - Script de tráfico sintético (Bash)
# Uso: bash generate_traffic.sh

BASE_URL="http://localhost:3000"
ENDPOINTS=("/" "/api/servicios" "/api/autos" "/api/citas" "/api/stats" "/api/lento")

echo "========================================"
echo "  AutoMetrics - Tráfico sintético (Bash)"
echo "========================================"
echo "  Target: $BASE_URL"
echo "  Ctrl+C para detener"
echo ""

CICLO=0
while true; do
  CICLO=$((CICLO + 1))
  echo "── Ciclo $CICLO ──"

  # 5 requests aleatorios
  for i in {1..5}; do
    IDX=$((RANDOM % ${#ENDPOINTS[@]}))
    EP="${ENDPOINTS[$IDX]}"
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$EP")
    echo "  GET $EP → $STATUS"
    sleep 0.3
  done

  # Cada 3 ciclos POST una cita
  if (( CICLO % 3 == 0 )); then
    echo "  POST /api/citas"
    curl -s -o /dev/null -X POST "$BASE_URL/api/citas" \
      -H "Content-Type: application/json" \
      -d '{"auto_id":1,"servicio_id":2,"notas":"Tráfico sintético"}'
    echo " → cita creada"
  fi

  PAUSA=$((RANDOM % 3 + 2))
  echo "  Pausa ${PAUSA}s..."
  sleep $PAUSA
done
