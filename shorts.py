#!/usr/bin/env python3
"""쇼츠 자동 편집기

긴 영상 하나를 넣으면:
  1) 말 없는 구간(무음)을 잘라내고
  2) 59초 이하 쇼츠 여러 개로 나누고
  3) 9:16 세로 영상(1080x1920)으로 바꾸고
  4) 자막을 자동으로 넣어줍니다 (faster-whisper 설치 시, 또는 SRT 파일 제공 시)

사용 예:
  python shorts.py 영상.mp4
  python shorts.py 영상.mp4 --mode crop --title "오늘의 꿀팁"
  python shorts.py 영상.mp4 --srt 자막.srt --no-silence-cut
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass, asdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
FONTS_DIR = HERE / "fonts"
W, H = 1080, 1920


# ---------------------------------------------------------------- 데이터 구조
@dataclass
class Word:
    start: float
    end: float
    text: str


@dataclass
class Segment:  # 문장 단위 (Whisper 세그먼트 또는 SRT 한 줄)
    start: float
    end: float
    text: str
    words: list[Word]


Piece = tuple[float, float]  # 원본 영상에서 남길 구간 (시작, 끝)


# ---------------------------------------------------------------- ffmpeg 도우미
def need(tool: str) -> None:
    if shutil.which(tool) is None:
        sys.exit(f"[오류] '{tool}' 을(를) 찾을 수 없습니다. README의 설치 방법을 확인하세요.")


def probe(path: Path) -> dict:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-print_format", "json", "-show_format", "-show_streams", str(path)],
        capture_output=True, text=True, check=True,
    ).stdout
    info = json.loads(out)
    v = next((s for s in info["streams"] if s["codec_type"] == "video"), None)
    a = next((s for s in info["streams"] if s["codec_type"] == "audio"), None)
    if v is None:
        sys.exit("[오류] 영상 트랙이 없습니다.")
    if a is None:
        sys.exit("[오류] 오디오 트랙이 없습니다. 소리가 있는 영상을 넣어주세요.")
    return {"duration": float(info["format"]["duration"]),
            "width": int(v["width"]), "height": int(v["height"])}


def detect_silences(path: Path, noise_db: float, min_silence: float, duration: float) -> list[Piece]:
    """ffmpeg silencedetect 로 무음 구간 목록을 구한다."""
    proc = subprocess.run(
        ["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-vn",
         "-af", f"silencedetect=n={noise_db}dB:d={min_silence}", "-f", "null", "-"],
        capture_output=True, text=True,
    )
    silences: list[Piece] = []
    start = None
    for line in proc.stderr.splitlines():
        m = re.search(r"silence_start: (-?[\d.]+)", line)
        if m:
            start = max(0.0, float(m.group(1)))
        m = re.search(r"silence_end: ([\d.]+)", line)
        if m and start is not None:
            silences.append((start, float(m.group(1))))
            start = None
    if start is not None:
        silences.append((start, duration))
    return silences


# ---------------------------------------------------------------- 구간 계산 (순수 함수)
def keep_pieces(silences: list[Piece], duration: float, pad: float = 0.15,
                min_piece: float = 0.3) -> list[Piece]:
    """무음 구간을 뺀 '말하는 구간'을 만든다. 앞뒤로 pad 초씩 여유를 둔다."""
    raw: list[Piece] = []
    cur = 0.0
    for s, e in sorted(silences):
        if s > cur:
            raw.append((cur, s))
        cur = max(cur, e)
    if cur < duration:
        raw.append((cur, duration))

    padded = [(max(0.0, s - pad), min(duration, e + pad)) for s, e in raw]
    merged: list[Piece] = []
    for s, e in padded:
        if merged and s <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], e))
        else:
            merged.append((s, e))
    return [(round(s, 3), round(e, 3)) for s, e in merged if e - s >= min_piece]


def split_long_pieces(pieces: list[Piece], max_len: float, cut_points: list[float]) -> list[Piece]:
    """max_len 보다 긴 구간은 문장 끝(cut_points)에서, 없으면 강제로 자른다."""
    out: list[Piece] = []
    for s, e in pieces:
        cur = s
        while e - cur > max_len:
            limit = cur + max_len
            cands = [c for c in cut_points if cur + 5 < c <= limit]
            cut = max(cands) if cands else limit
            out.append((cur, cut))
            cur = cut
        out.append((cur, e))
    return out


def pack_shorts(pieces: list[Piece], target_len: float, max_len: float,
                min_len: float) -> list[list[Piece]]:
    """구간들을 순서대로 묶어 쇼츠 하나당 target_len~max_len 초가 되게 한다."""
    shorts: list[list[Piece]] = []
    cur: list[Piece] = []
    dur = 0.0
    for p in pieces:
        plen = p[1] - p[0]
        if cur and dur + plen > max_len:
            shorts.append(cur)
            cur, dur = [], 0.0
        cur.append(p)
        dur += plen
        if dur >= target_len:
            shorts.append(cur)
            cur, dur = [], 0.0
    if cur and dur >= min_len:
        shorts.append(cur)
    elif cur:
        print(f"  (마지막 {dur:.1f}초는 너무 짧아서 버렸습니다. --min-len 으로 조절 가능)")
    return shorts


def to_output_time(t: float, pieces: list[Piece]) -> float | None:
    """원본 시각 t → 잘라 붙인 쇼츠 안에서의 시각. 잘려나간 부분이면 None."""
    offset = 0.0
    for s, e in pieces:
        if s <= t <= e:
            return offset + (t - s)
        offset += e - s
    return None


# ---------------------------------------------------------------- 자막
def transcribe(path: Path, model_name: str, lang: str | None) -> list[Segment]:
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print("  faster-whisper 가 없어 자막을 건너뜁니다. (pip install faster-whisper)")
        return []
    print(f"  Whisper '{model_name}' 모델로 음성 인식 중... (처음 한 번은 모델 다운로드)")
    model = WhisperModel(model_name, device="auto", compute_type="int8")
    segs, info = model.transcribe(str(path), language=lang, word_timestamps=True)
    result = []
    for s in segs:
        words = [Word(w.start, w.end, w.word) for w in (s.words or [])]
        result.append(Segment(s.start, s.end, s.text.strip(), words))
        print(f"    [{s.start:7.1f}s] {s.text.strip()}")
    return result


def parse_srt(path: Path) -> list[Segment]:
    def ts(x: str) -> float:
        h, m, rest = x.strip().replace(",", ".").split(":")
        return int(h) * 3600 + int(m) * 60 + float(rest)

    text = path.read_text(encoding="utf-8-sig")
    segs = []
    for block in re.split(r"\n\s*\n", text.strip()):
        lines = [l for l in block.splitlines() if l.strip()]
        for i, l in enumerate(lines):
            if "-->" in l:
                a, b = l.split("-->")
                body = " ".join(lines[i + 1:]).strip()
                if body:
                    segs.append(Segment(ts(a), ts(b.split()[0]), body, []))
                break
    return segs


def ensure_words(seg: Segment) -> list[Word]:
    """단어별 시간이 없으면(SRT) 글자 수 비율로 시간을 나눠준다.
    transcript.json 에서 문장(text)을 직접 고친 경우에도 고친 문장을 쓴다."""
    if seg.words and "".join(w.text for w in seg.words).split() == seg.text.split():
        return seg.words
    tokens = seg.text.split()
    total = sum(len(t) for t in tokens) or 1
    out, t = [], seg.start
    for tok in tokens:
        d = (seg.end - seg.start) * len(tok) / total
        out.append(Word(t, t + d, " " + tok))
        t += d
    return out


def caption_chunks(segments: list[Segment], max_chars: int) -> list[Word]:
    """쇼츠 스타일: 한 화면에 짧게 몇 단어씩 끊어 보여준다."""
    chunks: list[Word] = []
    for seg in segments:
        cur: list[Word] = []
        for w in ensure_words(seg):
            text_now = "".join(x.text for x in cur).strip()
            gap = w.start - cur[-1].end if cur else 0
            if cur and (len(text_now) + len(w.text.strip()) > max_chars or gap > 0.5
                        or re.search(r"[.?!,。]$", text_now)):
                chunks.append(Word(cur[0].start, cur[-1].end, text_now))
                cur = []
            cur.append(w)
        if cur:
            chunks.append(Word(cur[0].start, cur[-1].end, "".join(x.text for x in cur).strip()))
    return chunks


def ass_time(t: float) -> str:
    cs = int(round(t * 100))
    return f"{cs // 360000}:{cs // 6000 % 60:02d}:{cs // 100 % 60:02d}.{cs % 100:02d}"


def ass_escape(s: str) -> str:
    return s.replace("\\", "＼").replace("{", "(").replace("}", ")").replace("\n", " ")


def build_ass(chunks: list[Word], pieces: list[Piece], font: str, font_size: int,
              title: str | None, total: float) -> str:
    head = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Sub,{font},{font_size},&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,7,3,2,70,70,520,1
Style: Title,{font},{int(font_size * 0.9)},&H0000E5FF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,7,3,8,70,70,230,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    lines = []
    if title:
        lines.append(f"Dialogue: 0,{ass_time(0)},{ass_time(total)},Title,,0,0,0,,{ass_escape(title)}")
    for c in chunks:
        a = to_output_time(c.start, pieces)
        b = to_output_time(c.end, pieces)
        if a is None and b is None:
            continue
        a = a if a is not None else b - 0.5
        b = b if b is not None else a + 0.5
        if b - a < 0.2:
            b = a + 0.2
        lines.append(f"Dialogue: 1,{ass_time(max(0, a))},{ass_time(min(total, b))},Sub,,0,0,0,,{ass_escape(c.text)}")
    return head + "\n".join(lines) + "\n"


# ---------------------------------------------------------------- 렌더링
def ff_path(p: Path) -> str:
    """ffmpeg 필터 안에 넣을 경로 (윈도우 C:\\ 경로 대응)."""
    s = str(p.resolve()).replace("\\", "/").replace(":", "\\:").replace("'", "\\'")
    return f"'{s}'"


def render_short(src: Path, pieces: list[Piece], out: Path, mode: str,
                 ass_file: Path | None, crf: int) -> None:
    base = pieces[0][0]
    end = pieces[-1][1]
    parts, labels = [], []
    for i, (s, e) in enumerate(pieces):
        s0, e0 = s - base, e - base
        parts.append(f"[0:v]trim=start={s0:.3f}:end={e0:.3f},setpts=PTS-STARTPTS[v{i}]")
        parts.append(f"[0:a]atrim=start={s0:.3f}:end={e0:.3f},asetpts=PTS-STARTPTS[a{i}]")
        labels.append(f"[v{i}][a{i}]")
    parts.append(f"{''.join(labels)}concat=n={len(pieces)}:v=1:a=1[vc][aout]")

    if mode == "crop":  # 가운데를 잘라 세로로 꽉 채움
        parts.append(f"[vc]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},setsar=1[vv]")
    else:  # blur: 원본 전체를 보여주고 위아래는 흐린 배경
        parts.append(
            f"[vc]split[bg0][fg0];"
            f"[bg0]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},boxblur=25:3[bg];"
            f"[fg0]scale={W}:{H}:force_original_aspect_ratio=decrease[fg];"
            f"[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1[vv]"
        )
    if ass_file:
        parts.append(f"[vv]subtitles={ff_path(ass_file)}:fontsdir={ff_path(FONTS_DIR)}[vout]")
    else:
        parts.append("[vv]null[vout]")

    cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-stats",
           "-ss", f"{base:.3f}", "-to", f"{end:.3f}", "-i", str(src),
           "-filter_complex", ";".join(parts), "-map", "[vout]", "-map", "[aout]",
           "-c:v", "libx264", "-preset", "veryfast", "-crf", str(crf), "-pix_fmt", "yuv420p",
           "-r", "30", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", str(out)]
    subprocess.run(cmd, check=True)


# ---------------------------------------------------------------- 메인
def main() -> None:
    ap = argparse.ArgumentParser(description="긴 영상을 자막 달린 세로 쇼츠 여러 개로 자동 편집합니다.")
    ap.add_argument("input", type=Path, help="원본 영상 파일")
    ap.add_argument("-o", "--out", type=Path, help="결과 폴더 (기본: output/<영상이름>)")
    ap.add_argument("--mode", choices=["blur", "crop"], default="blur",
                    help="blur=원본 전체+흐린 배경(기본), crop=가운데 잘라서 꽉 채움")
    ap.add_argument("--target-len", type=float, default=45, help="쇼츠 목표 길이(초), 기본 45")
    ap.add_argument("--max-len", type=float, default=59, help="쇼츠 최대 길이(초), 기본 59")
    ap.add_argument("--min-len", type=float, default=10, help="이보다 짧은 마지막 조각은 버림, 기본 10")
    ap.add_argument("--no-silence-cut", action="store_true", help="무음 구간을 자르지 않음")
    ap.add_argument("--silence-db", type=float, default=-35, help="이 소리 크기(dB) 이하를 무음으로 봄, 기본 -35")
    ap.add_argument("--silence-min", type=float, default=0.6, help="이 길이(초) 이상 조용하면 자름, 기본 0.6")
    ap.add_argument("--no-subs", action="store_true", help="자막 넣지 않음")
    ap.add_argument("--srt", type=Path, help="이미 있는 SRT 자막 파일 사용 (음성 인식 생략)")
    ap.add_argument("--model", default="small", help="Whisper 모델: tiny/base/small/medium/large-v3, 기본 small")
    ap.add_argument("--lang", default="ko", help="음성 언어 코드, 기본 ko (자동 감지는 auto)")
    ap.add_argument("--font", default="NanumGothic", help="자막 글꼴 이름, 기본 NanumGothic")
    ap.add_argument("--font-size", type=int, default=86, help="자막 크기, 기본 86")
    ap.add_argument("--max-chars", type=int, default=14, help="자막 한 화면 최대 글자 수, 기본 14")
    ap.add_argument("--title", help="화면 위쪽에 계속 띄울 제목 ({n}은 편 번호로 바뀜)")
    ap.add_argument("--crf", type=int, default=21, help="화질 (낮을수록 고화질), 기본 21")
    ap.add_argument("--dry-run", action="store_true", help="렌더링 없이 나눌 계획만 출력")
    args = ap.parse_args()

    need("ffmpeg")
    need("ffprobe")
    src: Path = args.input
    if not src.exists():
        sys.exit(f"[오류] 파일이 없습니다: {src}")
    out_dir: Path = args.out or (HERE / "output" / src.stem)
    out_dir.mkdir(parents=True, exist_ok=True)

    info = probe(src)
    dur = info["duration"]
    print(f"▶ 입력: {src.name}  ({info['width']}x{info['height']}, {dur:.1f}초)")

    # 1) 자막(음성 인식) — 원본 기준으로 한 번만, 결과는 캐시
    segments: list[Segment] = []
    cache = out_dir / "transcript.json"
    if not args.no_subs:
        if args.srt:
            segments = parse_srt(args.srt)
            print(f"▶ SRT 자막 {len(segments)}줄 불러옴")
        elif cache.exists():
            data = json.loads(cache.read_text(encoding="utf-8"))
            segments = [Segment(d["start"], d["end"], d["text"], [Word(**w) for w in d["words"]]) for d in data]
            print(f"▶ 저장된 음성 인식 결과 사용 ({cache.name}, 다시 하려면 이 파일 삭제)")
        else:
            print("▶ 음성 인식")
            segments = transcribe(src, args.model, None if args.lang == "auto" else args.lang)
            if segments:
                cache.write_text(json.dumps([asdict(s) for s in segments], ensure_ascii=False, indent=1),
                                 encoding="utf-8")

    # 2) 무음 제거
    if args.no_silence_cut:
        pieces = [(0.0, dur)]
    else:
        sil = detect_silences(src, args.silence_db, args.silence_min, dur)
        pieces = keep_pieces(sil, dur)
        kept = sum(e - s for s, e in pieces)
        print(f"▶ 무음 제거: {dur:.1f}초 → {kept:.1f}초 ({dur - kept:.1f}초 잘림, 구간 {len(pieces)}개)")
    if not pieces:
        sys.exit("[오류] 전부 무음으로 판단됐습니다. --silence-db 값을 낮춰보세요 (예: -45).")

    # 3) 쇼츠로 나누기
    pieces = split_long_pieces(pieces, args.max_len, [s.end for s in segments])
    shorts = pack_shorts(pieces, args.target_len, args.max_len, args.min_len)
    print(f"▶ 쇼츠 {len(shorts)}개로 나눔")

    chunks = caption_chunks(segments, args.max_chars) if segments else []
    summary = []
    for n, sp in enumerate(shorts, 1):
        length = sum(e - s for s, e in sp)
        text = " ".join(s.text for s in segments if to_output_time((s.start + s.end) / 2, sp) is not None)
        summary.append({"file": f"short_{n:02d}.mp4", "length": round(length, 1),
                        "source_start": sp[0][0], "source_end": sp[-1][1], "text": text})
        print(f"  #{n:02d}  원본 {sp[0][0]:7.1f}s ~ {sp[-1][1]:7.1f}s  →  {length:5.1f}초")
    if args.dry_run:
        return

    # 4) 렌더링
    for n, sp in enumerate(shorts, 1):
        out = out_dir / f"short_{n:02d}.mp4"
        ass_file = None
        title = args.title.replace("{n}", str(n)) if args.title else None
        if chunks or title:
            ass_file = out_dir / f"short_{n:02d}.ass"
            ass_file.write_text(build_ass(chunks, sp, args.font, args.font_size, title,
                                          sum(e - s for s, e in sp)), encoding="utf-8")
        print(f"▶ 렌더링 {out.name} ...")
        render_short(src, sp, out, args.mode, ass_file, args.crf)

    # 업로드할 때 제목/설명 쓰기 편하도록 요약 저장
    lines = [f"# {src.name} → 쇼츠 {len(shorts)}개\n"]
    for s in summary:
        lines.append(f"## {s['file']}  ({s['length']}초, 원본 {s['source_start']:.1f}s~{s['source_end']:.1f}s)")
        lines.append((s["text"] or "(자막 없음)") + "\n")
    (out_dir / "summary.md").write_text("\n".join(lines), encoding="utf-8")
    print(f"\n✅ 완료! 결과 폴더: {out_dir}")


if __name__ == "__main__":
    main()
