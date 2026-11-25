#!/bin/bash
# 맥 자동 업데이트: 새 코드가 올라오면 알아서 앱(https://woogunt-a9c74.web.app)에 배포해요.
#
#   설치:   bash <(curl -fsSL https://github.com/woogunt/woogun/raw/claude/pensive-mccarthy-5wusj0/auto-deploy-mac.sh)
#   끄기:   bash <(curl -fsSL https://github.com/woogunt/woogun/raw/claude/pensive-mccarthy-5wusj0/auto-deploy-mac.sh) uninstall
#   기록:   cat ~/.uridul/deploy.log
#
# 맥이 켜져 있으면 10분마다 GitHub에 새 업데이트가 있는지 확인하고, 있으면 배포 후 알림을 띄워요.

OWNER_REPO="woogunt/woogun"
BRANCH="claude/pensive-mccarthy-5wusj0"
SELF_URL="https://github.com/${OWNER_REPO}/raw/${BRANCH}/auto-deploy-mac.sh"
ZIP_URL="https://github.com/${OWNER_REPO}/archive/refs/heads/${BRANCH}.zip"
HOME_DIR="$HOME/.uridul"
LOG="$HOME_DIR/deploy.log"
LABEL="com.uridul.autodeploy"
PLIST="$HOME/Library/LaunchAgents/${LABEL}.plist"
INTERVAL=600 # 초 (10분)

# 자동 실행될 때는 PATH가 짧아서 node/npx를 못 찾을 수 있음
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

notify() { osascript -e "display notification \"$1\" with title \"우리 앱\"" >/dev/null 2>&1 || true; }
log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*" >> "$LOG"; }

run() {
  mkdir -p "$HOME_DIR"
  # 너무 커진 기록은 줄이기
  [ -f "$LOG" ] && [ "$(wc -l < "$LOG")" -gt 2000 ] && tail -n 500 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"

  # 이미 배포 중이면 건너뜀
  if ! mkdir "$HOME_DIR/lock" 2>/dev/null; then
    if [ -n "$(find "$HOME_DIR/lock" -maxdepth 0 -mmin +30 2>/dev/null)" ]; then rmdir "$HOME_DIR/lock"; mkdir "$HOME_DIR/lock"; else exit 0; fi
  fi
  trap 'rmdir "$HOME_DIR/lock" 2>/dev/null' EXIT

  # 이 프로그램도 최신으로 (다음 확인부터 적용)
  if curl -fsSL -o "$HOME_DIR/auto-deploy.new" "$SELF_URL" 2>/dev/null && bash -n "$HOME_DIR/auto-deploy.new" 2>/dev/null; then
    cmp -s "$HOME_DIR/auto-deploy.new" "$HOME_DIR/auto-deploy.sh" || { mv "$HOME_DIR/auto-deploy.new" "$HOME_DIR/auto-deploy.sh"; chmod +x "$HOME_DIR/auto-deploy.sh"; log "자동 업데이트 프로그램을 최신으로 바꿈"; }
  fi
  rm -f "$HOME_DIR/auto-deploy.new"

  # 최신 버전(커밋) 확인
  latest="$(curl -fsSL -H 'Accept: application/vnd.github.sha' "https://api.github.com/repos/${OWNER_REPO}/commits/${BRANCH}" 2>/dev/null)"
  if [ -z "$latest" ] || [ ${#latest} -ne 40 ]; then log "업데이트 확인 실패 (인터넷 연결?)"; exit 0; fi
  current="$(cat "$HOME_DIR/last-sha" 2>/dev/null)"
  [ "$latest" = "$current" ] && exit 0

  log "새 업데이트 발견: ${latest:0:7} → 배포 시작"
  work="$(mktemp -d)"
  if ! curl -fsSL -o "$work/app.zip" "$ZIP_URL"; then log "다운로드 실패"; rm -rf "$work"; exit 0; fi
  if ! ditto -x -k "$work/app.zip" "$work"; then log "압축 풀기 실패"; rm -rf "$work"; exit 0; fi
  dir="$(find "$work" -maxdepth 1 -type d -name 'woogun-*' | head -n 1)"
  if [ -z "$dir" ]; then log "코드 폴더를 찾지 못함"; rm -rf "$work"; exit 0; fi

  # 앱 왼쪽 위에 보일 배포 시각
  printf '{"deployedAt":"%s","commit":"%s"}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "${latest:0:7}" > "$dir/version.json"
  if (cd "$dir" && npx --yes firebase-tools deploy --non-interactive) >> "$LOG" 2>&1; then
    echo "$latest" > "$HOME_DIR/last-sha"
    log "배포 완료 ✔"
    notify "새 버전으로 업데이트했어요 💕 앱을 다시 열어주세요"
  else
    log "배포 실패 ✘ (위 기록 확인)"
    notify "업데이트 배포에 실패했어요. 터미널에서 'cat ~/.uridul/deploy.log' 로 확인해주세요"
  fi
  rm -rf "$work"
}

install() {
  mkdir -p "$HOME_DIR" "$HOME/Library/LaunchAgents"
  echo "[1/3] 자동 업데이트 프로그램을 받는 중..."
  if ! curl -fsSL -o "$HOME_DIR/auto-deploy.sh" "$SELF_URL"; then echo "받기 실패. 인터넷 연결을 확인해주세요."; exit 1; fi
  chmod +x "$HOME_DIR/auto-deploy.sh"

  echo "[2/3] 10분마다 확인하도록 등록하는 중..."
  cat > "$PLIST" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>${HOME_DIR}/auto-deploy.sh</string>
    <string>run</string>
  </array>
  <key>StartInterval</key><integer>${INTERVAL}</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>${HOME_DIR}/launchd.log</string>
  <key>StandardErrorPath</key><string>${HOME_DIR}/launchd.log</string>
</dict>
</plist>
PL
  launchctl bootout "gui/$(id -u)/${LABEL}" >/dev/null 2>&1 || true
  if ! launchctl bootstrap "gui/$(id -u)" "$PLIST" 2>/dev/null; then
    launchctl load -w "$PLIST" 2>/dev/null || { echo "등록 실패. 이 화면을 캡처해서 보내주세요."; exit 1; }
  fi

  echo "[3/3] Firebase 로그인 확인 중..."
  if ! npx --yes firebase-tools projects:list >/dev/null 2>&1; then
    echo "Firebase 로그인이 필요해요. 브라우저가 열리면 woogunt21@gmail.com 으로 로그인해 주세요."
    npx --yes firebase-tools login
  fi

  echo
  echo "✅ 자동 업데이트를 켰어요!"
  echo "   맥이 켜져 있으면 10분마다 새 업데이트를 확인하고, 있으면 알아서 배포한 뒤 알림을 띄워요."
  echo "   기록 보기:  cat ~/.uridul/deploy.log"
}

uninstall() {
  launchctl bootout "gui/$(id -u)/${LABEL}" >/dev/null 2>&1 || launchctl unload -w "$PLIST" >/dev/null 2>&1 || true
  rm -f "$PLIST"
  rm -rf "$HOME_DIR/lock"
  echo "자동 업데이트를 껐어요. (기록은 ~/.uridul 에 남아 있어요)"
}

case "${1:-install}" in
  run) run ;;
  uninstall) uninstall ;;
  *) install ;;
esac
