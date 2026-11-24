"""로컬 JSON 저장소: 글 샘플, 말투 프로필, 경험, 작성한 자소서를 보관한다."""

from __future__ import annotations

import json
import uuid
from datetime import datetime
from pathlib import Path

DATA_DIR = Path(__file__).parent / "data"
DB_PATH = DATA_DIR / "db.json"

EMPTY_DB = {
    "samples": [],        # [{id, title, text}]
    "style_profile": "",  # 분석된 말투 프로필 (markdown)
    "experiences": [],    # [{id, title, period, role, situation, action, result, learned, tags}]
    "drafts": [],         # [{id, created_at, company, job, question, limit, answer}]
}


def load() -> dict:
    if not DB_PATH.exists():
        return json.loads(json.dumps(EMPTY_DB))
    with DB_PATH.open(encoding="utf-8") as f:
        db = json.load(f)
    for key, value in EMPTY_DB.items():
        db.setdefault(key, json.loads(json.dumps(value)))
    return db


def save(db: dict) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    tmp = DB_PATH.with_suffix(".tmp")
    with tmp.open("w", encoding="utf-8") as f:
        json.dump(db, f, ensure_ascii=False, indent=2)
    tmp.replace(DB_PATH)


def new_id() -> str:
    return uuid.uuid4().hex[:8]


def now() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M")
