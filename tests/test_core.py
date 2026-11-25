import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from shorts import Segment, caption_chunks, keep_pieces, pack_shorts, split_long_pieces, to_output_time


def test_keep_pieces_removes_silence_with_padding():
    assert keep_pieces([(5, 7), (12, 14)], 20, pad=0.1) == [(0, 5.1), (6.9, 12.1), (13.9, 20)]


def test_keep_pieces_merges_and_drops_tiny():
    assert keep_pieces([(1, 1.2)], 3, pad=0.15) == [(0, 3)]
    assert keep_pieces([(0, 9.9)], 10, pad=0) == []


def test_split_long_prefers_sentence_end():
    assert split_long_pieces([(0, 100)], 59, [30, 50, 70]) == [(0, 50), (50, 100)]
    assert split_long_pieces([(0, 100)], 59, []) == [(0, 59), (59, 100)]


def test_pack_respects_max_and_min():
    pieces = [(i * 10, i * 10 + 8) for i in range(10)]  # 8초짜리 10개
    shorts = pack_shorts(pieces, target_len=30, max_len=40, min_len=10)
    assert [len(s) for s in shorts] == [4, 4, 2]  # 32초, 32초, 마지막 16초
    shorts = pack_shorts(pieces, target_len=30, max_len=40, min_len=20)
    assert len(shorts) == 2


def test_to_output_time():
    p = [(0, 5), (7, 12)]
    assert to_output_time(3, p) == 3
    assert to_output_time(8, p) == 6
    assert to_output_time(6, p) is None


def test_caption_chunks_srt():
    segs = [Segment(0, 4, "안녕하세요 오늘은 쇼츠 편집을 배워볼게요", [])]
    chunks = caption_chunks(segs, max_chars=10)
    assert all(len(c.text) <= 12 for c in chunks)
    assert " ".join(c.text for c in chunks) == segs[0].text
    assert chunks[0].start == 0 and abs(chunks[-1].end - 4) < 1e-6
