"""월중 매수·매도 신호 백테스트 (일 단위, 실제 과거 주가).

기본: 매달 첫 거래일에 후보 5개(12-1개월 상승률 상위 + 200일선 위)를 같은 비중으로 산다.
월중 규칙(매일 종가로 판단):
  매도 - 200일선 아래로 마감 / 매수 후 최고가 대비 stop 이상 하락 / 순위 exit_rank 밖
  매수 - 빈자리가 생기면 그날 조건을 만족하는 다음 순위 종목을 산다 (replace=True)
생존 편향 있음(후보 목록을 오늘 기준으로 고름). 비용은 매매 1회 0.2%.
"""
import pandas as pd, numpy as np, pathlib
from universe import STOCKS

px = pd.read_csv(pathlib.Path(__file__).parent / "data" / "prices.csv", index_col=0, parse_dates=True)
st = px[list(STOCKS)].ffill(limit=5)
st = st[st.index >= "2017-01-01"]
ma = st.rolling(200, min_periods=150).mean()
mom = st.shift(21) / st.shift(252) - 1
ret = st.pct_change(fill_method=None).fillna(0)
days = st.index[260:]
first = set(pd.Series(days, index=days).groupby([days.year, days.month]).first())
COST = 0.002

def qualified(t, exclude):
    sc = mom.loc[t].dropna()
    ok = sc[(st.loc[t] > ma.loc[t]).reindex(sc.index).fillna(False)]
    return [s for s in ok.sort_values(ascending=False).index if s not in exclude]

def ranks(t):
    sc = mom.loc[t].dropna().sort_values(ascending=False)
    return {s: i + 1 for i, s in enumerate(sc.index)}

def run(K=5, ma_exit=False, stop=None, exit_rank=None, replace=False):
    hold, peak, eq, curve, trades = {}, {}, 1.0, [], 0
    for i, t in enumerate(days):
        if i > 0:                                   # 오늘 수익 반영 (빈자리는 현금 0%)
            r = sum(ret.at[t, s] for s in hold) / K
            eq *= 1 + r
            for s in hold: peak[s] = max(peak[s], st.at[t, s])
        if t in first:                              # 정기 리밸런싱
            new = set(qualified(t, set())[:K])
            trades += len(set(hold) ^ new); eq *= 1 - COST * len(set(hold) ^ new) / K
            hold = {s: True for s in new}; peak = {s: st.at[t, s] for s in new}; sold = set()
        else:
            rk = ranks(t) if exit_rank else {}
            out = []
            for s in list(hold):
                p = st.at[t, s]
                if (ma_exit and p < ma.at[t, s]) or (stop and p < peak[s] * (1 - stop)) or (exit_rank and rk.get(s, 999) > exit_rank):
                    out.append(s)
            for s in out:
                del hold[s]; del peak[s]; sold.add(s); trades += 1; eq *= 1 - COST / K
            if replace and len(hold) < K:
                for s in qualified(t, set(hold) | sold)[:K - len(hold)]:
                    hold[s] = True; peak[s] = st.at[t, s]; trades += 1; eq *= 1 - COST / K
        curve.append(eq)
    c = pd.Series(curve, index=days)
    yrs = (days[-1] - days[0]).days / 365.25
    m = c.resample("ME").last()
    return dict(cagr=c.iloc[-1] ** (1 / yrs) - 1, mdd=(1 - c / c.cummax()).max(),
                worst12=(m / m.shift(12) - 1).min(), trades=trades / yrs,
                last3=(c.iloc[-1] / c[c.index >= days[-1] - pd.DateOffset(years=3)].iloc[0]) ** (1 / 3) - 1)

if __name__ == "__main__":
    cases = [
        ("A 매달 첫 거래일만", {}),
        ("B +200일선 이탈 매도(현금)", dict(ma_exit=True)),
        ("C +200일선 이탈 매도→대체 매수", dict(ma_exit=True, replace=True)),
        ("D +고점 대비 -10% 매도→대체", dict(stop=.10, replace=True)),
        ("E +고점 대비 -15% 매도→대체", dict(stop=.15, replace=True)),
        ("F +고점 대비 -20% 매도→대체", dict(stop=.20, replace=True)),
        ("G +-15% 매도(현금)", dict(stop=.15)),
        ("H +15위 밖 매도→대체", dict(exit_rank=15, replace=True)),
        ("I +200일선·-15% 매도→대체", dict(ma_exit=True, stop=.15, replace=True)),
    ]
    print(f"{'규칙':<30}{'연평균':>7}{'최대하락':>8}{'최악12개월':>10}{'최근3년':>8}{'연매매':>7}")
    for name, kw in cases:
        r = run(**kw)
        print(f"{name:<30}{r['cagr']:7.1%}{-r['mdd']:8.1%}{r['worst12']:10.1%}{r['last3']:8.1%}{r['trades']:7.0f}회")
