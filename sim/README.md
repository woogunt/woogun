# 시뮬레이션·신호 스크립트

| 파일 | 하는 일 |
|---|---|
| `fetch.py` | Yahoo Finance에서 10년치 일별 수정주가를 받아 `data/prices.csv`에 저장 |
| `signals.py` | 시장판(지수·환율·금리·원자재), 지수 추세(200일선), 개별 종목 모멘텀 순위와 매수 후보를 `signals.json`에 저장 |
| `build_page.py` | `signals.json`을 `../ai-office.html`에 넣음 |
| `backtest.py` | 개별 종목 선정 규칙의 과거 성과 (생존 편향 있음) |
| `simulate.py`, `dca.py` | 가정 기반 몬테카를로 (일시금 / 매달 적립) |

갱신 순서: `python3 fetch.py && python3 signals.py && python3 build_page.py`

규칙
- 매달 첫 거래일: 나스닥100 ETF 6만, S&P500 ETF 5만, 코스피200 ETF 3만, 코스닥150 ETF 1만, 개별 종목 3만, 국고채·현금 2만.
- 개별 종목 매수 후보: 12개월(최근 1개월 제외) 상승률 상위이면서 200일 평균선 위인 3개.
- 매도: 보유 개별 종목이 순위 10위 밖이거나 200일선 아래로 내려가면 다음 거래일에 매도. 지수 ETF는 팔지 않음.

투자 권유가 아니며, 과거 성과와 시뮬레이션은 미래 수익을 보장하지 않는다.
