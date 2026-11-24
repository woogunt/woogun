# 내 말투로 쓰는 자기소개서 자동화

내가 예전에 쓴 글로 **말투와 글버릇을 분석**하고, 내 **경험 목록**과 **지원 회사·직무·문항**을 넣으면
내가 직접 쓴 것 같은 자기소개서를 만들어 주는 프로그램입니다. (Claude API 사용)

## 동작 방식

```
내가 쓴 글들 ──▶ ① 문체 분석 ──▶ 문체 프로필 (data/style_profile.md, 한 번 만들고 재사용·직접 수정 가능)
                                         │
회사/직무/공고 + 문항 + 경험 ──▶ ② 문항 분석 (평가 의도, 소재 선택, 구성안)
                                         │
                                  ③ 내 말투로 초안 작성
                                         │
                                  ④ 글자 수 보정 (제한의 90~100%, 공백 포함)
```

- 경험 목록에 **없는 경험이나 수치는 지어내지 않도록** 지시합니다.
- 문항이 여러 개면 **소재가 겹치지 않게** 앞 문항에서 쓴 소재를 피합니다.
- "AI가 쓴 티"가 나는 흔한 표현을 피하도록 지시합니다.

## 설치

```bash
pip install -r requirements.txt
export ANTHROPIC_API_KEY="내 API 키"     # https://console.anthropic.com 에서 발급
```

## 준비물

1. **`data/samples/`** — 내가 직접 쓴 글을 `.txt`/`.md`로 넣기 (예전 자소서, 과제, 블로그 등. 3편, 3000자 이상 권장)
   이름이 `_`로 시작하는 파일은 분석에서 빠집니다.
2. **`data/experiences.md`** — 내 경험을 [상황 / 한 일 / 결과 / 느낀 점] 형식으로 정리

## 사용법 ① 웹 화면 (추천)

```bash
streamlit run app.py
```
브라우저에서 1) 문체 분석 → 2) 경험 입력 → 3) 회사·직무·문항 입력 후 생성.
결과마다 글자 수와 "왜 이 소재를 골랐는지" 분석이 함께 나옵니다.

## 사용법 ② 터미널

`applications/example.yaml`을 복사해 회사·문항을 채운 뒤:

```bash
python -m coverletter.cli applications/example.yaml              # 결과는 output/ 폴더에 저장
python -m coverletter.cli applications/example.yaml --analysis   # 문항 분석 포함
python -m coverletter.cli applications/example.yaml --refresh-style  # 글을 추가했을 때 문체 재분석
```

## 더 내 글처럼 만드는 팁

- 문체 프로필(`data/style_profile.md`)을 열어 틀린 부분은 직접 고치세요. 다음 생성부터 바로 반영됩니다.
- 생성된 글을 내가 고친 최종본을 `data/samples/`에 다시 넣고 `--refresh-style` 하면 점점 더 비슷해집니다.
- 프롬프트는 `coverletter/prompts.py`에 모여 있어 원하는 대로 바꿀 수 있습니다.

## 파일 구성

| 파일 | 역할 |
|---|---|
| `coverletter/prompts.py` | 단계별 프롬프트 |
| `coverletter/pipeline.py` | 문체 분석 → 문항 분석 → 초안 → 분량 보정 |
| `coverletter/llm.py` | Claude API 호출 (모델 `claude-opus-5-5`) |
| `coverletter/cli.py` | 터미널 실행 |
| `app.py` | Streamlit 웹 화면 |
