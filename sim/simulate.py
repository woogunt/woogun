"""AI 오피스 운용 시뮬레이션 (몬테카를로, 월 단위).

실제 시세가 아니라 아래 ASSUMPTIONS 가정으로 만든 가상 경로 10,000개에서
직원별 규칙(전략)을 돌려 '연 6%' 목표 달성 확률과 손실 위험을 비교한다.
"""
import numpy as np

rng = np.random.default_rng(2026)
N, YEARS, BURN = 10_000, 3, 12          # 경로 수, 운용 기간(년), 이동평균용 사전 12개월
M = YEARS * 12

# ---- 가정 (연 복리 기대수익, 연 변동성, 원화 기준) — 실제 시세가 아닌 가정 ----
ASSUMPTIONS = {
    "국내주식(코스피200 ETF)": (0.07, 0.22),
    "미국주식(S&P500 ETF)":   (0.07, 0.17),
    "국내채권(국고채 ETF)":   (0.035, 0.045),
    "현금(파킹통장/MMF)":     (0.028, 0.0),
}
names = list(ASSUMPTIONS)
mu = np.array([v[0] for v in ASSUMPTIONS.values()])
vol = np.array([v[1] for v in ASSUMPTIONS.values()])
corr = np.array([[1, .6, -.1, 0], [.6, 1, -.1, 0], [-.1, -.1, 1, 0], [0, 0, 0, 1]])
cov_m = np.outer(vol, vol) * corr / 12
L = np.linalg.cholesky(cov_m + np.eye(4) * 1e-12)

# 꼬리가 두꺼운 수익률 (t분포, 자유도 5) → 폭락 달이 정규분포보다 자주 나옴
df = 5
z = rng.standard_t(df, size=(N, BURN + M, 4)) / np.sqrt(df / (df - 2))
ret = np.log1p(mu) / 12 + z @ L.T          # mu = 연 복리(기하) 기대수익
ret = np.expm1(ret)                       # 월 단순수익률
price = np.cumprod(1 + ret, axis=1)        # 자산별 가격 지수

EQ = [0, 1]
def run(strategy, target):
    w_t = np.array(target, float)
    val = np.ones(N); hold = np.tile(w_t, (N, 1)); peak = np.ones(N); mdd = np.zeros(N)
    trades = np.zeros(N); yr1 = None
    for t in range(BURN, BURN + M):
        m = t - BURN
        if strategy != "buyhold" and m % 3 == 0:      # 분기 점검일
            want = np.tile(w_t, (N, 1))
            if strategy in ("trend", "trend_dip"):
                # 호성: 주가가 10개월 평균 아래면 그 주식 몫은 채권으로 피신
                ma = price[:, t - 10:t, :].mean(axis=1)
                below = price[:, t - 1, :] < ma
                for a in EQ:
                    want[below[:, a], 2] += want[below[:, a], a]
                    want[below[:, a], a] = 0
            if strategy == "trend_dip":
                # 미나: 주식이 고점 대비 15% 이상 빠지면 채권에서 5%p를 주식으로 분할 이동
                hi = price[:, t - 12:t, :].max(axis=1)
                dip = price[:, t - 1, 1] / hi[:, 1] < 0.85
                move = np.minimum(0.05, want[:, 2]) * dip
                want[:, 1] += move; want[:, 2] -= move
            drift = np.abs(hold - want).sum(axis=1) / 2
            do = drift > 0.05                              # 성호: 5%p 넘게 틀어졌을 때만 매매
            hold[do] = want[do]; trades += do
            val -= do * drift * 0.003                      # 왕복 비용 0.3% 가정
        r = (hold * ret[:, t, :]).sum(axis=1)
        val *= 1 + r
        hold = hold * (1 + ret[:, t, :]); hold /= hold.sum(axis=1, keepdims=True)
        peak = np.maximum(peak, val); mdd = np.maximum(mdd, 1 - val / peak)
        if m == 11: yr1 = val.copy()
    ann = val ** (1 / YEARS) - 1
    return dict(
        y1_med=np.median(yr1) - 1, y1_p6=(yr1 >= 1.06).mean(), y1_loss=(yr1 < 1).mean(),
        y1_p5=np.percentile(yr1, 5) - 1,
        ann_med=np.median(ann), ann_p6=(ann >= 0.06).mean(), ann_loss=(val < 1).mean(),
        mdd_med=np.median(mdd), mdd_p95=np.percentile(mdd, 95), trades=trades.mean() / YEARS)

if __name__ == "__main__":
    print("가정(연 기대수익, 연 변동성):")
    for k, (a, b) in ASSUMPTIONS.items(): print(f"  {k:<20} {a:5.1%}  {b:5.1%}")
    print("\n[1] 주식 비중별 (국내:미국 = 4:6, 나머지 채권:현금 = 8:2, 분기 리밸런싱)")
    print(f"{'주식%':>5} {'1년중앙':>7} {'1년≥6%':>7} {'1년손실':>7} {'1년하위5%':>9} {'3년연평균':>9} {'3년≥6%':>7} {'3년손실':>7} {'MDD중앙':>7} {'MDD95%':>7}")
    for e in [0, .2, .3, .4, .5, .6, .8, 1.0]:
        tgt = [e * .4, e * .6, (1 - e) * .8, (1 - e) * .2]
        r = run("rebal", tgt)
        print(f"{e:5.0%} {r['y1_med']:7.1%} {r['y1_p6']:7.0%} {r['y1_loss']:7.0%} {r['y1_p5']:9.1%} {r['ann_med']:9.1%} {r['ann_p6']:7.0%} {r['ann_loss']:7.0%} {r['mdd_med']:7.1%} {r['mdd_p95']:7.1%}")

    tgt = [.20, .30, .40, .10]   # 주식 50%
    print("\n[2] 주식 50% 기준 전략 비교")
    for s, label in [("buyhold", "사서 그냥 두기"), ("rebal", "성호: 분기 리밸런싱"),
                     ("trend", "+호성: 10개월선 추세필터"), ("trend_dip", "+미나: 급락 시 분할매수")]:
        r = run(s, tgt)
        print(f"  {label:<22} 1년 중앙 {r['y1_med']:5.1%} | 1년 6%↑ {r['y1_p6']:4.0%} | 1년 손실 {r['y1_loss']:4.0%} | "
              f"3년 연평균 {r['ann_med']:5.1%} | 3년 손실 {r['ann_loss']:4.0%} | MDD95% {r['mdd_p95']:5.1%} | 연 매매 {r['trades']:.1f}회")
