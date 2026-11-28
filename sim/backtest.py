"""개별 종목 선정 규칙 백테스트 (실제 과거 주가, 월 단위).

규칙: 매달 말, 최근 12개월 수익률(최근 1개월 제외)이 높은 순으로 줄을 세우고,
200일 평균선 위에 있는 종목 중 상위 K개를 같은 비중으로 한 달 보유.
주의: 후보 목록을 '오늘' 골랐기 때문에 생존 편향이 있다(망한 종목이 빠져 있음). 수익은 각 시장 통화 기준.
"""
import pandas as pd, numpy as np, pathlib
from universe import STOCKS

px = pd.read_csv(pathlib.Path(__file__).parent / "data" / "prices.csv", index_col=0, parse_dates=True)
st = px[list(STOCKS)].ffill(limit=5)
ma200 = st.rolling(200, min_periods=150).mean()
me = st.resample("ME").last(); ma_me = ma200.resample("ME").last()
mret = me.pct_change(fill_method=None)
mom = me.shift(1) / me.shift(12) - 1

def run(K, use_filter=True, cost=0.002):
    out, prev = [], set()
    for i in range(13, len(me) - 1):
        t = me.index[i]
        sc = mom.loc[t].dropna()
        if use_filter: sc = sc[(me.loc[t] > ma_me.loc[t]).reindex(sc.index).fillna(False)]
        pick = set(sc.sort_values(ascending=False).index[:K])
        nxt = mret.iloc[i + 1]
        r = nxt[list(pick)].mean() if pick else 0.0
        turnover = len(pick ^ prev) / max(2 * K, 1)
        out.append((me.index[i + 1], r - turnover * cost * 2)); prev = pick
    return pd.Series(dict(out))

def ew():
    r = mret.iloc[14:].mean(axis=1); return r

def stats(r, name):
    eq = (1 + r.fillna(0)).cumprod(); yrs = len(r) / 12
    cagr = eq.iloc[-1] ** (1 / yrs) - 1; mdd = (1 - eq / eq.cummax()).max()
    vol = r.std() * np.sqrt(12); worst12 = (eq / eq.shift(12) - 1).min()
    print(f"{name:<26} 연평균 {cagr:6.1%}  변동성 {vol:5.1%}  최대하락 {-mdd:6.1%}  최악 12개월 {worst12:6.1%}  기간 {r.index[0]:%Y-%m}~{r.index[-1]:%Y-%m}")
    return cagr

if __name__ == "__main__":
    stats(ew(), "후보 전체 같은 비중")
    for K in (3, 5, 10):
        stats(run(K), f"모멘텀 상위 {K} + 200일선")
    stats(run(5, False), "모멘텀 상위 5 (필터 없음)")
    # 최근 3년만
    r = run(5); stats(r[r.index >= r.index[-1] - pd.DateOffset(years=3)], "  └ 상위5, 최근 3년")
    e = ew(); stats(e[e.index >= e.index[-1] - pd.DateOffset(years=3)], "  └ 전체 같은비중, 최근 3년")
    for s, n in [("^KS11", "코스피 지수"), ("^KQ11", "코스닥 지수"), ("^IXIC", "나스닥 지수"), ("^GSPC", "S&P500 지수")]:
        stats(px[s].resample("ME").last().pct_change(fill_method=None).iloc[14:], n)
