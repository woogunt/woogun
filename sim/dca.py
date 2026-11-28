"""매달 일정 금액 적립식 투자 시뮬레이션. 가정과 시장 경로 생성은 simulate.py와 같다.

리밸런싱은 팔지 않고, 새로 넣는 돈으로 목표보다 모자란 자산부터 채운다(성호 규칙).
"""
import numpy as np
from simulate import ret, BURN, N

MONTHLY = 20  # 만원

def dca(target, years):
    tgt = np.array(target, float); M = years * 12
    hold = np.zeros((N, 4))                       # 자산별 평가액(만원)
    for m in range(M):
        r = ret[:, BURN + m, :]
        tot = hold.sum(axis=1, keepdims=True) + MONTHLY
        need = np.clip(tgt * tot - hold, 0, None)  # 목표 대비 모자란 금액
        s = need.sum(axis=1, keepdims=True)
        buy = np.where(s > 0, need / np.where(s > 0, s, 1) * MONTHLY, tgt * MONTHLY)
        hold = (hold + buy) * (1 + r)              # 월초 매수, 한 달 운용
    final = hold.sum(axis=1)
    paid = MONTHLY * M
    i = 1.06 ** (1 / 12) - 1
    goal = MONTHLY * ((1 + i) ** M - 1) / i * (1 + i)   # 연 6%로 굴렸을 때 금액
    return paid, goal, final

if __name__ == "__main__":
    plans = {"계획(주식 60%)": [.24, .36, .32, .08], "주식 100%": [.4, .6, 0, 0]}
    print(f"매달 {MONTHLY}만원 적립 (단위: 만원)")
    print(f"{'계획':<12}{'기간':>4} {'넣은 돈':>7} {'6%목표':>7} {'중앙값':>7} {'6%↑확률':>8} {'원금손실':>8} {'나쁜5%':>7} {'좋은5%':>7}")
    for name, t in plans.items():
        for y in (1, 3, 5):
            paid, goal, f = dca(t, y)
            print(f"{name:<12}{y:>3}년 {paid:7.0f} {goal:7.0f} {np.median(f):7.0f} {(f >= goal).mean():8.0%} {(f < paid).mean():8.0%} {np.percentile(f, 5):7.0f} {np.percentile(f, 95):7.0f}")
