"""터미널 실행용.

사용 예:
    python -m coverletter.cli applications/example.yaml
    python -m coverletter.cli applications/example.yaml --refresh-style
"""
from __future__ import annotations

import argparse
import sys
from datetime import datetime
from pathlib import Path

import yaml

from . import llm, pipeline


def load_application(path: Path) -> pipeline.Application:
    d = yaml.safe_load(path.read_text(encoding="utf-8"))
    qs = [pipeline.Question(q["question"], int(q.get("limit", 1000))) for q in d.get("questions", [])]
    if not qs:
        raise SystemExit("questions 항목이 비어 있습니다.")
    return pipeline.Application(
        company=d["company"], role=d["role"], posting=d.get("posting", ""),
        questions=qs, extra=d.get("extra", ""),
    )


def main() -> None:
    ap = argparse.ArgumentParser(description="내 말투로 자기소개서 자동 작성")
    ap.add_argument("application", type=Path, help="지원 정보 YAML 파일")
    ap.add_argument("--refresh-style", action="store_true", help="문체 프로필을 다시 분석")
    ap.add_argument("--analysis", action="store_true", help="결과에 문항 분석도 포함")
    args = ap.parse_args()

    app = load_application(args.application)
    try:
        style = pipeline.get_style_profile(refresh=args.refresh_style)
        answers = pipeline.run(app, style=style)
    except llm.LLMError as e:
        sys.exit(f"오류: {e}")

    out_dir = pipeline.ROOT / "output"
    out_dir.mkdir(exist_ok=True)
    out = out_dir / f"{app.company}_{app.role}_{datetime.now():%Y%m%d_%H%M}.md".replace(" ", "_")
    out.write_text(pipeline.to_markdown(app, answers, args.analysis), encoding="utf-8")
    print(f"\n완료! 저장 위치: {out}")


if __name__ == "__main__":
    main()
