"""Yahoo Finance에서 일별 수정주가를 받아 sim/data/prices.csv로 저장."""
import time, sys, pathlib, requests, pandas as pd
from universe import INDEXES, ETFS, STOCKS

OUT = pathlib.Path(__file__).parent / "data" / "prices.csv"
H = {"User-Agent": "Mozilla/5.0"}

def fetch(sym, rng="10y"):
    for attempt in range(4):
        try:
            r = requests.get(f"https://query1.finance.yahoo.com/v8/finance/chart/{sym}",
                             params={"range": rng, "interval": "1d", "events": "div,splits"}, headers=H, timeout=20)
            r.raise_for_status()
            res = r.json()["chart"]["result"][0]
            ts = pd.to_datetime(res["timestamp"], unit="s").normalize()
            q = res["indicators"]
            px = q.get("adjclose", [{}])[0].get("adjclose") or q["quote"][0]["close"]
            s = pd.Series(px, index=ts, name=sym, dtype=float)
            if pd.isna(s.iloc[-1]) and res["meta"].get("regularMarketPrice"):   # 당일 종가가 비어 있으면 현재가로 채움
                s.iloc[-1] = res["meta"]["regularMarketPrice"]
            return s[~s.index.duplicated(keep="last")], res["meta"]
        except Exception as e:
            time.sleep(1.5 * (attempt + 1)); err = e
    raise RuntimeError(f"{sym}: {err}")

if __name__ == "__main__":
    syms = list(INDEXES) + list(ETFS) + list(STOCKS)
    cols, failed = [], []
    for s in syms:
        try:
            ser, meta = fetch(s); cols.append(ser)
            print(f"{s:<11} {len(ser):5d}일  {meta.get('longName') or meta.get('shortName')}")
        except Exception as e:
            failed.append(s); print("실패", e, file=sys.stderr)
        time.sleep(0.3)
    df = pd.concat(cols, axis=1, sort=True)
    df.to_csv(OUT)
    print(f"저장 {OUT} {df.shape}, 실패 {failed}")
