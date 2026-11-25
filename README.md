# 쇼츠 자동 편집기

긴 영상(강의, 브이로그, 게임, 인터뷰 등) 하나를 넣으면 **자막이 들어간 세로 쇼츠 여러 개**를 자동으로 만들어줍니다.

1. 말 없는 구간(무음)을 잘라내서 템포를 빠르게
2. 45초 안팎(최대 59초)으로 나눠서 쇼츠 여러 개로
3. 9:16 세로(1080x1920) 화면으로 변환
4. 음성을 인식해서 큰 자막을 자동으로 넣음 (한국어 기본)
5. 업로드할 때 쓰기 좋은 `summary.md` (쇼츠별 내용 요약) 생성

## 설치 (처음 한 번)

### Windows
PowerShell을 열고:
```powershell
winget install Python.Python.3.12
winget install Gyan.FFmpeg
```
설치 후 PowerShell을 **껐다 켜고**, 이 폴더에서:
```powershell
pip install -r requirements.txt
```

### Mac
1. **터미널** 열기 (⌘+스페이스 → "터미널" 입력)
2. Homebrew 설치 (이미 있으면 생략, 비밀번호를 물으면 맥 로그인 비밀번호 입력):
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```
   설치가 끝나면 화면에 나오는 `Next steps`의 `echo ... >> ~/.zprofile` 두 줄을 복사해서 실행하세요.
3. 파이썬과 ffmpeg 설치:
   ```bash
   brew install python ffmpeg
   ```
4. 이 저장소를 내려받기: GitHub에서 브랜치 선택 → **Code → Download ZIP** → 압축 풀기

#### 맥에서 실행 (제일 쉬운 방법)
압축을 푼 폴더에서 **`run_mac.command`를 더블클릭**하세요.
- 처음 한 번은 준비(1~3분)를 합니다.
- "확인되지 않은 개발자" 경고가 뜨면: 파일을 **우클릭 → 열기 → 열기**
- "권한 없음"이 뜨면 터미널에서 한 번만: `chmod +x ~/Downloads/woogun-*/run_mac.command`
- 영상 파일을 창에 **끌어다 놓고 엔터** → 제목 입력 → 화면 방식 선택
- 끝나면 결과 폴더가 자동으로 열립니다. **AirDrop으로 아이폰에 보내서** 확인하세요.

#### 터미널로 직접 실행
```bash
cd ~/Downloads/woogun-*        # 압축 푼 폴더로 이동
python3 -m venv .venv          # 처음 한 번만
source .venv/bin/activate      # 터미널을 새로 열 때마다
pip install -r requirements.txt  # 처음 한 번만
python shorts.py 영상.mp4      # 파일은 끌어다 놓으면 경로가 자동 입력됨
open output                    # 결과 폴더 열기
```

## 사용법

```bash
python shorts.py 내영상.mp4
```
결과는 `output/내영상/` 폴더에 `short_01.mp4`, `short_02.mp4`, ... 로 생깁니다.

처음 실행할 때는 음성 인식 모델(약 500MB)을 내려받느라 시간이 좀 걸립니다.
인식 결과는 `transcript.json`에 저장되니, 옵션을 바꿔 다시 돌려도 인식은 다시 하지 않습니다.

### 자주 쓰는 옵션

| 옵션 | 설명 |
|---|---|
| `--mode crop` | 흐린 배경 대신, 가운데를 잘라 화면을 꽉 채움 (사람 얼굴이 가운데 있을 때 추천) |
| `--title "꿀팁 {n}편"` | 화면 위에 제목 고정 (`{n}`은 1, 2, 3...으로 바뀜) |
| `--target-len 30 --max-len 40` | 쇼츠 길이 조절 |
| `--srt 자막.srt` | 이미 있는 자막 파일 사용 (음성 인식 생략) |
| `--no-subs` | 자막 없이 |
| `--no-silence-cut` | 무음 자르지 않기 |
| `--silence-db -45` | 배경 소음이 있어서 무음이 잘 안 잘릴 때 (숫자를 낮추면 더 조용해야 무음으로 판단) |
| `--model medium` | 자막 정확도 높이기 (대신 느림) |
| `--dry-run` | 렌더링 없이 어떻게 나눌지만 미리 보기 |

전체 옵션: `python shorts.py --help`

## 화면 예시

- `blur` (기본): 원본 전체가 가운데에, 위아래는 같은 영상을 흐리게 깐 배경. 가로 영상을 그대로 살릴 때.
- `crop`: 가운데 부분만 잘라서 꽉 채움. 사람이 화면 가운데서 말하는 영상에 적합.

## 주의

- 다른 사람의 영상을 잘라 올리면 저작권 문제가 생깁니다. **내가 찍은 영상**이나 허락받은 영상(외주)만 쓰세요.
- 자동 자막은 틀릴 수 있으니 업로드 전에 한 번 보고, 틀린 부분은 `transcript.json`에서 고친 뒤 다시 실행하세요.

## 테스트

```bash
pip install pytest
python -m pytest tests
```

폰트: 나눔고딕 (SIL Open Font License, `fonts/OFL.txt`)
