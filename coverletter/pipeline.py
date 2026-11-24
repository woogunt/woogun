"""자기소개서 생성 파이프라인.

1) 문체 분석   : 내가 쓴 글들 -> 문체 프로필 (한 번 만들어 두고 재사용)
2) 문항 분석   : 회사/직무/공고 + 문항 + 경험 -> 의도, 소재, 구성안
3) 초안 작성   : 문체 프로필 + 구성안 -> 내 말투의 초안
4) 분량 보정   : 글자 수 범위를 벗어나면 첨삭 반복
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

from . import llm, prompts

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
SAMPLES_DIR = DATA / "samples"
EXPERIENCES_FILE = DATA / "experiences.md"
STYLE_FILE = DATA / "style_profile.md"

MIN_RATIO = 0.9  # 제한 글자 수의 90% 이상
MAX_REVISIONS = 3

Log = Callable[[str], None]


@dataclass
class Question:
    question: str
    limit: int = 1000  # 공백 포함 글자 수


@dataclass
class Application:
    company: str
    role: str
    posting: str = ""  # 채용공고/인재상/회사 정보 등 자유 텍스트
    questions: list[Question] = field(default_factory=list)
    extra: str = ""  # 꼭 강조하고 싶은 점 등 추가 요청


@dataclass
class Answer:
    question: Question
    analysis: str
    text: str

    @property
    def length(self) -> int:
        return count_chars(self.text)


def count_chars(text: str, *, spaces: bool = True) -> int:
    """자소서 사이트 기준 글자 수. 줄바꿈은 1자로 셉니다(사이트마다 다를 수 있음)."""
    t = text.strip().replace("\r\n", "\n")
    return len(t) if spaces else len("".join(t.split()))


# ---------- 1. 문체 분석 ----------

def load_samples(directory: Path = SAMPLES_DIR) -> list[tuple[str, str]]:
    # 이름이 _ 로 시작하는 파일(안내문 등)은 분석에서 제외
    files = sorted(p for p in directory.glob("*") if p.suffix in {".txt", ".md"} and not p.name.startswith("_"))
    return [(p.name, p.read_text(encoding="utf-8").strip()) for p in files if p.read_text(encoding="utf-8").strip()]


def build_style_profile(samples: list[tuple[str, str]], log: Log = print) -> str:
    if not samples:
        raise llm.LLMError("문체 분석용 글이 없습니다. data/samples/ 에 내가 쓴 글(.txt/.md)을 넣어 주세요.")
    log(f"문체 분석 중... (글 {len(samples)}편)")
    body = "\n\n".join(f"<글 제목=\"{name}\">\n{text}\n</글>" for name, text in samples)
    return llm.ask(prompts.STYLE_SYSTEM, f"다음은 한 사람이 직접 쓴 글들입니다.\n\n{body}")


def get_style_profile(refresh: bool = False, log: Log = print) -> str:
    if STYLE_FILE.exists() and not refresh:
        return STYLE_FILE.read_text(encoding="utf-8")
    profile = build_style_profile(load_samples(), log)
    STYLE_FILE.write_text(profile, encoding="utf-8")
    log(f"문체 프로필 저장: {STYLE_FILE}")
    return profile


# ---------- 2~4. 문항별 작성 ----------

def _context(app: Application, experiences: str) -> str:
    return (
        f"<지원 정보>\n회사: {app.company}\n직무: {app.role}\n"
        f"공고/회사 정보:\n{app.posting or '(없음)'}\n"
        f"추가 요청: {app.extra or '(없음)'}\n</지원 정보>\n\n"
        f"<경험 목록>\n{experiences}\n</경험 목록>"
    )


def analyze_question(app: Application, q: Question, experiences: str, used: list[str]) -> str:
    used_txt = "\n".join(f"- {u}" for u in used) or "(없음)"
    user = (
        f"{_context(app, experiences)}\n\n"
        f"<문항 글자수제한=\"{q.limit}자(공백 포함)\">\n{q.question}\n</문항>\n\n"
        f"<이미 사용한 소재>\n{used_txt}\n</이미 사용한 소재>"
    )
    return llm.ask(prompts.QUESTION_SYSTEM, user, effort="medium")


def draft_answer(app: Application, q: Question, experiences: str, style: str, analysis: str) -> str:
    system = f"{prompts.DRAFT_SYSTEM}\n\n[문체 프로필]\n{style}"
    user = (
        f"{_context(app, experiences)}\n\n"
        f"<문항>\n{q.question}\n</문항>\n"
        f"글자 수: {int(q.limit * MIN_RATIO)}~{q.limit}자 (공백 포함)\n\n"
        f"<문항 분석 및 구성안>\n{analysis}\n</문항 분석 및 구성안>"
    )
    return llm.ask(system, user)


def fit_length(text: str, q: Question, style: str, experiences: str, log: Log = print) -> str:
    lo, hi = int(q.limit * MIN_RATIO), q.limit
    for i in range(MAX_REVISIONS):
        n = count_chars(text)
        if lo <= n <= hi:
            break
        direction = "줄여" if n > hi else "늘려"
        log(f"  분량 보정 {i + 1}회차: 현재 {n}자 -> {lo}~{hi}자로 {direction}야 함")
        system = f"{prompts.REVISE_SYSTEM}\n\n[문체 프로필]\n{style}"
        user = (
            f"<경험 목록>\n{experiences}\n</경험 목록>\n\n<문항>\n{q.question}\n</문항>\n\n"
            f"<초안 현재글자수=\"{n}\">\n{text}\n</초안>\n\n"
            f"현재 {n}자입니다. 공백 포함 {lo}~{hi}자가 되도록 {direction} 주세요."
        )
        text = llm.ask(system, user, effort="medium")
    return text


def write_answer(app: Application, q: Question, experiences: str, style: str,
                 used: list[str], log: Log = print) -> Answer:
    log("  문항 분석 중...")
    analysis = analyze_question(app, q, experiences, used)
    log("  초안 작성 중...")
    text = draft_answer(app, q, experiences, style, analysis)
    text = fit_length(text, q, style, experiences, log)
    return Answer(q, analysis, text)


def run(app: Application, experiences: str | None = None, style: str | None = None,
        log: Log = print) -> list[Answer]:
    experiences = experiences if experiences is not None else EXPERIENCES_FILE.read_text(encoding="utf-8")
    style = style or get_style_profile(log=log)
    answers: list[Answer] = []
    used: list[str] = []
    for idx, q in enumerate(app.questions, 1):
        log(f"[{idx}/{len(app.questions)}] {q.question[:40]}...")
        ans = write_answer(app, q, experiences, style, used, log)
        answers.append(ans)
        # 다음 문항에서 소재가 겹치지 않도록 이번 분석의 '소재 선택' 부분을 기록
        used.append(f"{idx}번 문항: " + _section(ans.analysis, "소재 선택")[:300])
    return answers


def _section(md: str, title: str) -> str:
    out, on = [], False
    for line in md.splitlines():
        if line.startswith("## "):
            on = title in line
            continue
        if on:
            out.append(line)
    return "\n".join(out).strip() or md[:300]


def to_markdown(app: Application, answers: list[Answer], with_analysis: bool = False) -> str:
    parts = [f"# {app.company} / {app.role} 자기소개서\n"]
    for i, a in enumerate(answers, 1):
        parts.append(f"## {i}. {a.question.question}\n")
        parts.append(f"_({a.length}/{a.question.limit}자, 공백 포함)_\n")
        parts.append(a.text + "\n")
        if with_analysis:
            parts.append(f"<details><summary>문항 분석</summary>\n\n{a.analysis}\n\n</details>\n")
    return "\n".join(parts)
