"""sim/signals.json 내용을 ai-office.html의 MARKET-DATA 자리에 넣는다."""
import json, pathlib, re
root = pathlib.Path(__file__).resolve().parent.parent
data = json.loads((root / "sim" / "signals.json").read_text())
blob = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
page = root / "ai-office.html"
html = page.read_text(encoding="utf-8")
new, n = re.subn(r"<!--MARKET-DATA-->.*?<!--/MARKET-DATA-->", lambda m: f"<!--MARKET-DATA-->{blob}<!--/MARKET-DATA-->", html, flags=re.S)
assert n == 1, "MARKET-DATA 자리를 찾지 못함"
page.write_text(new, encoding="utf-8")
print(f"페이지에 넣음: {data['data_until']} 기준, 매수 후보 {data['buy']}")
