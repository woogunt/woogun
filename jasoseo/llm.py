"""Claude API 호출 래퍼."""

from __future__ import annotations

from collections.abc import Iterator

import anthropic

from . import prompts

MODEL = "claude-opus-5-5"
FALLBACK_BETA = "server-side-fallback-2026-07-01"


class GenerationError(RuntimeError):
    pass


def char_count(text: str) -> tuple[int, int]:
    """(공백 포함, 공백 제외) 글자수."""
    stripped = text.strip()
    return len(stripped), len("".join(stripped.split()))


def format_experiences(experiences: list[dict]) -> str:
    if not experiences:
        return "(등록된 경험 없음)"
    blocks = []
    for i, e in enumerate(experiences, 1):
        lines = [f"[경험 {i}] {e.get('title', '')}"]
        for key, label in [
            ("period", "기간"), ("role", "역할"), ("situation", "상황/문제"),
            ("action", "내가 한 행동"), ("result", "결과/성과"),
            ("learned", "배운 점"), ("tags", "키워드"), ("notes", "확인된 추가 사실"),
        ]:
            if e.get(key):
                lines.append(f"- {label}: {e[key]}")
        blocks.append("\n".join(lines))
    return "\n\n".join(blocks)


def parse_questions(text: str) -> list[str]:
    """작성 계획의 '### 부족한 정보' 섹션, 또는 '[확인 필요]' 응답에서 질문 목록을 꺼낸다."""
    if text.lstrip().startswith("[확인 필요]"):
        body = text.lstrip()[len("[확인 필요]"):]
    elif "### 부족한 정보" in text:
        body = text.split("### 부족한 정보", 1)[1].split("\n###", 1)[0]
    else:
        return []
    questions = []
    for line in body.splitlines():
        line = line.strip()
        if line.startswith(("-", "•", "*")):
            q = line.lstrip("-•* ").strip()
            if q and q != "없음":
                questions.append(q)
    return questions


def limit_text(limit: int | None) -> str:
    return f"공백 포함 {limit}자 이내" if limit else "제한 없음"


class Writer:
    def __init__(self, api_key: str | None = None, effort: str = "high"):
        self.client = anthropic.Anthropic(api_key=api_key) if api_key else anthropic.Anthropic()
        self.effort = effort
        self.last_message = None

    # ---- low level -------------------------------------------------------
    def _stream(self, system: str, user: str, max_tokens: int = 16000) -> Iterator[str]:
        """텍스트 조각을 yield 하고, 끝나면 self.last_message 에 최종 메시지를 둔다."""
        self.last_message = None
        try:
            with self.client.beta.messages.stream(
                model=MODEL,
                max_tokens=max_tokens,
                # 문체 프로필 + 경험 뱅크가 들어간 system 을 캐시해 반복 호출 비용을 줄인다.
                system=[{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],
                messages=[{"role": "user", "content": user}],
                output_config={"effort": self.effort},
                betas=[FALLBACK_BETA],
                fallbacks="default",
            ) as stream:
                for text in stream.text_stream:
                    yield text
                message = stream.get_final_message()
        except anthropic.AuthenticationError as e:
            raise GenerationError("API 키가 올바르지 않습니다. 사이드바에서 키를 확인하세요.") from e
        except anthropic.RateLimitError as e:
            raise GenerationError("요청이 너무 많습니다. 잠시 후 다시 시도하세요.") from e
        except anthropic.APIStatusError as e:
            raise GenerationError(f"API 오류 ({e.status_code}): {e.message}") from e
        except anthropic.APIConnectionError as e:
            raise GenerationError("Claude API 에 연결할 수 없습니다. 네트워크를 확인하세요.") from e

        self.last_message = message
        if message.stop_reason == "refusal":
            raise GenerationError("모델이 이 요청에 대한 응답을 거절했습니다. 입력 내용을 바꿔 다시 시도하세요.")
        if message.stop_reason == "max_tokens":
            raise GenerationError("응답이 너무 길어 중간에 끊겼습니다.")

    def _complete(self, system: str, user: str, max_tokens: int = 16000) -> str:
        return "".join(self._stream(system, user, max_tokens)).strip()

    # ---- features --------------------------------------------------------
    def analyze_style(self, samples: list[dict]) -> Iterator[str]:
        joined = "\n\n".join(
            f"<샘플 제목=\"{s.get('title', '')}\">\n{s['text']}\n</샘플>" for s in samples
        )
        return self._stream(prompts.STYLE_ANALYSIS_SYSTEM, f"다음은 내가 직접 쓴 글들이다.\n\n{joined}")

    def writer_system(self, style_profile: str, experiences: list[dict], facts: list[dict] | None = None) -> str:
        exp_text = format_experiences(experiences)
        if facts:
            qa = "\n".join(f"- Q: {f['q']}\n  A: {f['a']}" for f in facts)
            exp_text += f"\n\n[지원자에게 직접 확인한 사실]\n{qa}"
        return prompts.WRITER_SYSTEM.format(
            style_profile=style_profile or "(문체 프로필 없음)",
            experiences=exp_text,
        )

    def plan(self, system: str, ctx: dict) -> Iterator[str]:
        return self._stream(system, prompts.PLAN_PROMPT.format(**ctx))

    def write(self, system: str, ctx: dict, plan: str, extra: str = "") -> Iterator[str]:
        extra_block = f"\n<추가_요청>\n{extra}\n</추가_요청>\n" if extra.strip() else ""
        return self._stream(system, prompts.WRITE_PROMPT.format(**ctx, plan=plan, extra=extra_block))

    def fit_limit(self, system: str, answer: str, limit: int | None, max_tries: int = 2) -> str:
        """글자수 제한을 넘으면 줄여서 다시 쓴다."""
        if not limit:
            return answer
        for _ in range(max_tries):
            current, _ = char_count(answer)
            if current <= limit:
                break
            answer = self._complete(system, prompts.SHORTEN_PROMPT.format(
                current=current, limit=limit, target_low=int(limit * 0.9), answer=answer,
            ))
        return answer

    def revise(self, system: str, question: str, limit: int | None, answer: str, feedback: str) -> Iterator[str]:
        return self._stream(system, prompts.REVISE_PROMPT.format(
            question=question, limit_text=limit_text(limit), answer=answer, feedback=feedback,
        ))
