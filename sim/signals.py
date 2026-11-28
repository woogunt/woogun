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
# 26세 공격형, 매달 50만원 = ISA 30만원(지수 ETF) + 일반 계좌 20만원(개별 종목)
ISA = [("133690.KS", "TIGER 미국나스닥100", 10), ("360750.KS", "TIGER 미국S&P500", 10),
       ("069500.KS", "KODEX 200", 7), ("229200.KS", "KODEX 코스닥150", 3)]
PICK_BUDGET, PICK_N = 20, 5
EXIT_RANK, WARN_DROP = 20, 0.15   # 월중 매도: 순위 20위 밖 / 주의: 200일선 아래 또는 매수 후 고점 대비 -15%

def live_book():
    """이번 달 첫 거래일부터 오늘까지 규칙을 그대로 따라가 현재 보유 종목과 월중 신호를 계산한다.
    (intramonth.py 백테스트에서 기본보다 나았던 규칙: 순위 20위 밖이면 매도하고, 조건을 맞는 다음 종목으로 교체)"""
    from intramonth import qualified, ranks, st, ma
    last = st.index[-1]
    month = st.index[(st.index.year == last.year) & (st.index.month == last.month)]
    d0 = month[0]
    hold = {s: dict(since=str(d0.date()), entry=float(st.at[d0, s]), peak=float(st.at[d0, s])) for s in qualified(d0, set())[:PICK_N]}
    sold, events = set(), []
    for t in month[1:]:
        rk = ranks(t)
        for s in hold: hold[s]["peak"] = max(hold[s]["peak"], float(st.at[t, s]))
        for s in [s for s in hold if rk.get(s, 999) > EXIT_RANK]:
            events.append(dict(date=str(t.date()), kind="sell", sym=s, name=STOCKS[s], why=f"순위 {rk.get(s, '-')}위로 {EXIT_RANK}위 밖"))
            del hold[s]; sold.add(s)
        for s in qualified(t, set(hold) | sold)[:PICK_N - len(hold)]:
            events.append(dict(date=str(t.date()), kind="buy", sym=s, name=STOCKS[s], why=f"빈자리 대체, 순위 {rk.get(s, '-')}위"))
            hold[s] = dict(since=str(t.date()), entry=float(st.at[t, s]), peak=float(st.at[t, s]))
    rk = ranks(last); rows = []
    for s, h in hold.items():
        p = float(st.at[last, s]); m = float(ma.at[last, s])
        warn = []
        if p < m: warn.append("200일선 아래")
        if p < h["peak"] * (1 - WARN_DROP): warn.append(f"고점 대비 {p / h['peak'] - 1:.0%}")
        rows.append(dict(sym=s, name=STOCKS[s], market=market_of(s), since=h["since"], chg=p / h["entry"] - 1, rank=rk.get(s), warn=warn))
    return dict(month_start=str(d0.date()), asof=str(last.date()), hold=rows, events=events,
                today=[e for e in events if e["date"] == str(last.date())])


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
    return rows[:top], [r["sym"] for r in ok[:PICK_N]], [r for r in rows if not r["above"]][:5], ok[:PICK_N]

if __name__ == "__main__":
    px = pd.read_csv(HERE / "data" / "prices.csv", index_col=0, parse_dates=True).ffill(limit=5)
    top, buy3, below, chosen = picks(px)
    idx = {sym: dict(name=name, **trend(px, sym)) for sym, name in INDEXES.items()}
    etf = {sym: dict(name=n, index=i, **trend(px, sym)) for sym, (n, i) in ETFS.items()}
    out = dict(
        generated=dt.datetime.now(dt.timezone.utc).isoformat(), data_until=str(px.index[-1].date()),
        book=live_book(), board=board(), indexes=idx, etfs=etf, top=top, buy=buy3, below=below, picks=chosen,
        isa=[dict(sym=s, name=n, man=m) for s, n, m in ISA], pick_budget=PICK_BUDGET, pick_n=PICK_N,
        rules=dict(buy=f"매달 첫 거래일: ISA에서 지수 ETF 4개를 정해진 금액대로 적립. 일반 계좌에서는 매수 후보 {PICK_N}개를 같은 금액으로 맞춰 보유.",
                   sell=f"매달 첫 거래일에 다시 고르고, 월중에는 순위 {EXIT_RANK}위 밖으로 밀리면 매도 신호, 그 빈자리에 조건을 맞는 다음 종목을 매수 신호.",
                   warn=f"200일선 아래로 마감하거나 매수 후 고점 대비 {WARN_DROP:.0%} 넘게 빠지면 주의 알림만(백테스트상 바로 팔면 손해였음).",
                   index="ISA 지수 ETF는 팔지 않고 계속 적립."),
    )
    (HERE / "signals.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))
    print("데이터 기준일", out["data_until"])
    for b in out["board"]:
        print(f"  {b['name']:<12} " + (f"{b['price']:>12,.2f} {b['pct']:+.2%}" if "price" in b else "실패 " + b["error"][:60]))
    for s, t in idx.items(): print(f"  {t['name']:<7} 200일선 대비 {t['gap']:+.1%}  52주 고점 대비 {t['from_high']:+.1%}  1개월 {t['r1m']:+.1%}")
    print("모멘텀 상위 10:")
    for r in top: print(f"  {r['rank']:>2}. {r['name']:<12} {r['market']:<3} 12-1개월 {r['mom']:+.0%}  200일선 {r['gap']:+.0%}  최근1개월 {r['r1m']:+.0%}")
    b = out["book"]
    print(f"보유 ({b['month_start']} 매수 기준):", [(h["name"], f"{h['chg']:+.1%}", h["rank"], h["warn"]) for h in b["hold"]])
    print("이번 달 월중 신호:", [(e["date"], e["kind"], e["name"], e["why"]) for e in b["events"]] or "없음")
    print("다음 정기 매수 후보:", [STOCKS[s] for s in buy3], f"(각 {PICK_BUDGET / PICK_N:g}만원)")
