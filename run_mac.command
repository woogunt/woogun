#!/bin/bash
# 맥에서 더블클릭으로 실행하는 쇼츠 자동 편집기
cd "$(dirname "$0")" || exit 1

pause() { read -r -p "엔터를 누르면 창이 닫힙니다..."; }

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "❌ ffmpeg가 없습니다. 터미널에서 아래 명령을 먼저 실행하세요:"
  echo "   brew install python ffmpeg"
  pause; exit 1
fi

if [ ! -x .venv/bin/python ]; then
  echo "⏳ 처음 실행이라 준비 중입니다 (1~3분)..."
  python3 -m venv .venv && .venv/bin/pip install -q -r requirements.txt || {
    echo "❌ 설치에 실패했습니다. 위 오류 메시지를 확인하세요."; pause; exit 1; }
fi

echo ""
echo "🎬 편집할 영상 파일을 이 창에 끌어다 놓고 엔터를 누르세요:"
read -r VIDEO
# 끌어다 놓을 때 생기는 \ 이스케이프, 따옴표, 끝 공백 제거
VIDEO=$(printf '%s' "$VIDEO" | sed -e 's/[[:space:]]*$//' -e "s/^'\(.*\)'$/\1/" -e 's/^"\(.*\)"$/\1/' -e 's/\\\(.\)/\1/g')
if [ ! -f "$VIDEO" ]; then
  echo "❌ 파일을 찾을 수 없습니다: $VIDEO"; pause; exit 1
fi

echo "✏️  화면 위에 넣을 제목 (예: 꿀팁 {n}편, 없으면 그냥 엔터):"
read -r TITLE
echo "📐 화면 방식: 1) 흐린 배경(기본)  2) 가운데 꽉 채우기  [1/2, 엔터=1]"
read -r MODE

ARGS=("$VIDEO")
[ -n "$TITLE" ] && ARGS+=(--title "$TITLE")
[ "$MODE" = "2" ] && ARGS+=(--mode crop)

.venv/bin/python shorts.py "${ARGS[@]}" || { echo "❌ 편집 중 오류가 났습니다."; pause; exit 1; }

NAME=$(basename "$VIDEO"); NAME="${NAME%.*}"
command -v open >/dev/null 2>&1 && open "output/$NAME"
echo "📱 결과 폴더가 열렸습니다. 영상을 AirDrop으로 아이폰에 보내 확인해보세요."
pause
