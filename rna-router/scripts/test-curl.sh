#!/bin/bash
# RNA Router Curl Test — dummy key for demo
BASE="https://your-app.vercel.app"
echo "=== RNA Router Test ==="
echo "1. List models (search deepseek):"
curl -s -H "Content-Type: application/json" "$BASE/api/v1/models?q=deepseek" | head -c 500
echo -e "\n\n2. Chat with dummy key (no JWT, x-api-key only):"
curl -s -X POST "$BASE/api/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "x-api-key: rna-user-demo-01" \
  -d '{"model":"muse-spark-1.2-free","messages":[{"role":"user","content":"Halo RNA Router"}],"temperature":0.7}' | head -c 600
echo -e "\n\n3. Chat with stream=true (SSE):"
curl -s -N -X POST "$BASE/api/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "x-api-key: rna-user-demo-01" \
  -d '{"model":"deepseek-chat","messages":[{"role":"user","content":"Ceritakan tentang AI gateway"}],"stream":true,"temperature":0.7}' | head -n 20
echo -e "\n=== Done ==="
