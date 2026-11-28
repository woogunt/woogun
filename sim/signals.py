"""오늘의 시장 정보 + 매수·매도 신호를 sim/signals.json으로 저장.

- 시장판: 지수·환율·금리·원자재 현재가와 전일 대비
- 지수 ETF: 200일 평균선 위/아래 (추세)
- 개별 종목: 12개월(최근 1개월 제외) 수익률 순위 + 200일선 필터
"""
import json, time, pathlib, datetime as dt
import pandas as pd, numpy as np
from fetch import fetch
from universe import INDEXES, ETFS, STOCKS, market_of

HERE = pathlib.Path(__file__).parent
BOARD = [  # (심볼, 이름, 단위 표시)
    ("^KS11", "코스피", ""), ("^KQ11", "코스닥", ""), ("^IXIC", "나스닥", ""), ("^GSPC", "S&P500", ""),
    ("^DJI", "다우", ""), ("^SOX", "필라델피아 반도체", ""), ("KRW=X", "원/달러 환율", "원"),
    ("JPYKRW=X", "원/100엔", "원"), ("^TNX", "미국 10년 금리", "%"), ("^VIX", "VIX 공포지수", ""),
    ("GC=F", "금 (온스)", "$"), ("CL=F", "WTI 유가", "$"), ("BTC-USD", "비트코인", "$"),
]
# 공격형 계획 (26세, 매달 20만원)
PLAN = [
    ("133690.KS", "나스닥100 ETF", 6), ("360750.KS", "S&P500 ETF", 5), ("069500.KS", "코스피200 ETF", 3),
    ("229200.KS", "코스닥150 ETF", 1), ("PICKS", "개별 종목 (모멘텀 상위)", 3), ("BOND", "국고채 ETF·현금", 2),
]

def board():
    rows = []
    for sym, name, unit in BOARD:
        try:
            s, meta = fetch(sym, "5d")
            s = s.dropna()
            price = meta.get("regularMarketPrice") or float(s.iloc[-1])
            prev = float(s.iloc[-2]) if len(s) >= 2 else meta.get("chartPreviousClose")
            if meta.get("regularMarketChangePercent") is not None:   # 거래소가 준 전일 대비 값을 우선 사용
                prev = price / (1 + meta["regularMarketChangePercent"] / 100)
            if sym == "JPYKRW=X": price, prev = price * 100, prev * 100
            rows.append(dict(sym=sym, name=name, unit=unit, price=price, chg=price - prev, pct=price / prev - 1,
                             time=dt.datetime.fromtimestamp(meta.get("regularMarketTime", 0), dt.timezone.utc).isoformat()))
        except Exception as e:
            rows.append(dict(sym=sym, name=name, unit=unit, error=str(e)))
        time.sleep(0.25)
    return rows

def trend(px, sym):
    s = px[sym].dropna(); last = s.iloc[-1]; ma = s.rolling(200).mean().iloc[-1]
    hi = s.iloc[-252:].max()
    return dict(price=float(last), ma200=float(ma), gap=float(last / ma - 1), from_high=float(last / hi - 1),
                r1m=float(last / s.iloc[-22] - 1), r3m=float(last / s.iloc[-64] - 1), above=bool(last > ma))

def picks(px, top=10):
    rows = []
    for sym, name in STOCKS.items():
        s = px[sym].dropna()
        if len(s) < 260: continue
        last = s.iloc[-1]; ma = s.rolling(200).mean().iloc[-1]
        mom = s.iloc[-22] / s.iloc[-252] - 1
        rows.append(dict(sym=sym, name=name, market=market_of(sym), mom=float(mom), gap=float(last / ma - 1),
                         r1m=float(last / s.iloc[-22] - 1), above=bool(last > ma)))
    rows.sort(key=lambda r: r["mom"], reverse=True)
    for i, r in enumerate(rows): r["rank"] = i + 1
    ok = [r for r in rows if r["above"]]
    return rows[:top], [r["sym"] for r in ok[:3]], [r for r in rows if not r["above"]][:5]

if __name__ == "__main__":
    px = pd.read_csv(HERE / "data" / "prices.csv", index_col=0, parse_dates=True).ffill(limit=5)
    top, buy3, below = picks(px)
    idx = {sym: dict(name=name, **trend(px, sym)) for sym, name in INDEXES.items()}
    etf = {sym: dict(name=n, index=i, **trend(px, sym)) for sym, (n, i) in ETFS.items()}
    out = dict(
        generated=dt.datetime.now(dt.timezone.utc).isoformat(), data_until=str(px.index[-1].date()),
        board=board(), indexes=idx, etfs=etf, top=top, buy=buy3, below=below,
        plan=[dict(sym=s, name=n, man=m) for s, n, m in PLAN],
        rules=dict(buy="매달 첫 거래일에 계획 금액대로 지수 ETF 적립. 개별 종목 3만원은 '매수 후보 3개' 중 보유 비중이 가장 작은 1개에.",
                   sell="보유 개별 종목이 순위 10위 밖으로 밀리거나 200일 평균선 아래로 내려가면 다음 거래일에 매도.",
                   index="지수 ETF는 팔지 않고 적립 유지. 200일선 아래인 지수는 추가 매수 없이 정기 금액만."),
    )
    (HERE / "signals.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))
    print("데이터 기준일", out["data_until"])
    for b in out["board"]:
        print(f"  {b['name']:<12} " + (f"{b['price']:>12,.2f} {b['pct']:+.2%}" if "price" in b else "실패 " + b["error"][:60]))
    for s, t in idx.items(): print(f"  {t['name']:<7} 200일선 대비 {t['gap']:+.1%}  52주 고점 대비 {t['from_high']:+.1%}  1개월 {t['r1m']:+.1%}")
    print("모멘텀 상위 10:")
    for r in top: print(f"  {r['rank']:>2}. {r['name']:<12} {r['market']:<3} 12-1개월 {r['mom']:+.0%}  200일선 {r['gap']:+.0%}  최근1개월 {r['r1m']:+.0%}")
    print("이번 달 매수 후보:", [STOCKS[s] for s in buy3])
