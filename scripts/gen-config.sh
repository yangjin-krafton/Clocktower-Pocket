#!/bin/bash
# .env 파일에서 config.js 생성
# 사용법: bash scripts/gen-config.sh

ENV_FILE=".env"
OUT_FILE="src/js/config.js"

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ .env 파일이 없습니다."
  exit 1
fi

source "$ENV_FILE"

cat > "$OUT_FILE" << JSEOF
// ⚠️ 이 파일은 자동 생성됩니다. 직접 수정하지 마세요.
export const MQTT_CONFIG = {
    relayUrl: '${EMQX_URL}',
    username: '${EMQX_USERNAME}',
    password: '${EMQX_PASSWORD}',
}
JSEOF

echo "✅ $OUT_FILE 생성 완료"
