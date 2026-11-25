#!/bin/bash
# 우리 앱 최신 버전을 받아서 배포합니다. 더블클릭하면 돼요.
ZIPURL="https://github.com/woogunt/woogun/archive/refs/heads/claude/pensive-mccarthy-5wusj0.zip"
WORK="$(mktemp -d)"
cd "$WORK" || exit 1

fail() { echo; echo "문제가 생겼어요. 이 창을 캡처해서 Claude에게 보내주세요."; read -r -p "엔터를 누르면 닫혀요"; exit 1; }

echo "[1/3] 최신 앱을 받는 중..."
curl -fsSL -o app.zip "$ZIPURL" || fail
# 맥 기본 도구(ditto)로 풀기: unzip은 한글 파일 이름에서 멈출 수 있음
ditto -x -k app.zip . || fail
cd woogun-claude-pensive-mccarthy-5wusj0 || fail

echo "[2/3] https://woogunt-a9c74.web.app 에 배포하는 중..."
# 앱 왼쪽 위에 보일 배포 시각
printf '{"deployedAt":"%s"}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > version.json
npx --yes firebase-tools deploy || fail

echo
echo "[3/3] 끝! 폰에서 앱을 새로고침하세요."
read -r -p "엔터를 누르면 닫혀요"
