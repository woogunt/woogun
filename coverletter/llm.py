"""Claude API 호출을 한 곳에 모은 모듈."""
from __future__ import annotations

import anthropic

MODEL = "claude-opus-5-5"
_client: anthropic.Anthropic | None = None


class LLMError(RuntimeError):
    pass


def client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        # ANTHROPIC_API_KEY 환경변수에서 키를 읽습니다.
        _client = anthropic.Anthropic()
    return _client


def ask(system: str, user: str, *, effort: str = "high", max_tokens: int = 32000) -> str:
    """system 프롬프트 + user 메시지를 보내고 최종 텍스트를 돌려준다.

    - 긴 입력/출력에 대비해 스트리밍으로 받고 최종 메시지만 사용
    - 안전 분류기가 거절할 경우 서버가 자동으로 다른 모델로 재시도(fallbacks="default")
    """
    try:
        with client().beta.messages.stream(
            model=MODEL,
            max_tokens=max_tokens,
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            output_config={"effort": effort},
            system=[{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],
            messages=[{"role": "user", "content": user}],
        ) as stream:
            msg = stream.get_final_message()
    except anthropic.AuthenticationError as e:
        raise LLMError("API 키가 올바르지 않습니다. ANTHROPIC_API_KEY를 확인하세요.") from e
    except anthropic.RateLimitError as e:
        raise LLMError("요청 한도를 초과했습니다. 잠시 후 다시 시도하세요.") from e
    except anthropic.APIStatusError as e:
        raise LLMError(f"API 오류 ({e.status_code}): {e.message}") from e
    except anthropic.APIConnectionError as e:
        raise LLMError("네트워크 연결 오류입니다.") from e

    if msg.stop_reason == "refusal":
        raise LLMError("모델이 요청을 거절했습니다. 입력 내용을 확인해 주세요.")
    text = "".join(b.text for b in msg.content if b.type == "text").strip()
    if msg.stop_reason == "max_tokens":
        raise LLMError("출력이 너무 길어 잘렸습니다.")
    return text
