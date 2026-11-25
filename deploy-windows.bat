@echo off
rem 우리 앱 최신 버전을 받아서 배포합니다. 더블클릭하면 돼요.
chcp 65001 >nul
title Deploy
set "WORK=%TEMP%\uridul-deploy"
set "ZIPURL=https://github.com/woogunt/woogun/archive/refs/heads/claude/pensive-mccarthy-5wusj0.zip"

echo [1/3] Downloading the latest app...
if exist "%WORK%" rmdir /s /q "%WORK%"
mkdir "%WORK%"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue'; Invoke-WebRequest -Uri '%ZIPURL%' -OutFile '%WORK%\app.zip'; Expand-Archive -Path '%WORK%\app.zip' -DestinationPath '%WORK%' -Force"
if errorlevel 1 goto fail

echo [2/3] Deploying to https://woogunt-a9c74.web.app ...
cd /d "%WORK%\woogun-claude-pensive-mccarthy-5wusj0"
if errorlevel 1 goto fail
rem 앱 왼쪽 위에 보일 배포 시각
powershell -NoProfile -Command "[IO.File]::WriteAllText('version.json', '{\"deployedAt\":\"' + (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ') + '\"}')"
call npx --yes firebase-tools deploy
if errorlevel 1 goto fail

echo.
echo [3/3] Done! Refresh the app on your phone.
pause
exit /b 0

:fail
echo.
echo Something went wrong. Take a screenshot of this window and send it to Claude.
pause
exit /b 1
