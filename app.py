"""자소서 자동화 - Streamlit 앱.

실행:  streamlit run app.py
"""

from __future__ import annotations

import os

import streamlit as st

from jasoseo import storage
from jasoseo.llm import GenerationError, Writer, char_count, limit_text, parse_questions

st.set_page_config(page_title="내 말투 자소서", page_icon="✍️", layout="wide")

if "db" not in st.session_state:
    st.session_state.db = storage.load()
db = st.session_state.db


def persist():
    storage.save(db)


# ---------------------------------------------------------------- sidebar
with st.sidebar:
    st.header("설정")
    api_key = st.text_input(
        "Anthropic API Key",
        type="password",
        value=os.environ.get("ANTHROPIC_API_KEY", ""),
        help="환경변수 ANTHROPIC_API_KEY 가 있으면 자동으로 사용합니다.",
    )
    effort = st.select_slider("작성 품질 (effort)", ["low", "medium", "high", "xhigh"], value="high",
                              help="높을수록 더 고민해서 쓰지만 느리고 비용이 늘어납니다.")
    st.divider()
    st.caption(f"글 샘플 {len(db['samples'])}개 · 경험 {len(db['experiences'])}개 · "
               f"작성한 답변 {len(db['drafts'])}개")
    st.caption("말투 프로필: " + ("✅ 있음" if db["style_profile"] else "❌ 없음"))


def get_writer() -> Writer | None:
    if not api_key:
        st.error("사이드바에 API 키를 입력하세요.")
        return None
    return Writer(api_key=api_key, effort=effort)


def run_stream(gen, placeholder=None) -> str | None:
    """스트리밍 출력을 화면에 그리고 전체 텍스트를 돌려준다."""
    try:
        target = placeholder or st
        return target.write_stream(gen).strip()
    except GenerationError as e:
        st.error(str(e))
        return None


def show_count(text: str, limit: int | None):
    with_space, no_space = char_count(text)
    msg = f"공백 포함 **{with_space}자** · 공백 제외 {no_space}자"
    if limit:
        msg += f" / 제한 {limit}자"
        (st.warning if with_space > limit else st.success)(msg)
    else:
        st.info(msg)


if "pending_questions" not in st.session_state:
    st.session_state.pending_questions = []  # [{"from": 문항/수정 설명, "q": 질문}]


def ask_user(source: str, questions: list[str]):
    for q in questions:
        st.session_state.pending_questions.append({"from": source, "q": q})


# ---------------------------------------------------------------- AI 질문
if st.session_state.pending_questions:
    st.warning("**AI가 사실을 지어내지 않도록 멈췄어요.** 아래 질문에 답해주시면 그 내용으로만 다시 씁니다. "
               "모르면 '모름'이라고 적어주세요. 그 부분은 쓰지 않아요.")
    with st.form("answer_questions"):
        answers = []
        for i, item in enumerate(st.session_state.pending_questions):
            answers.append(st.text_area(f"[{item['from']}] {item['q']}", key=f"pq_{i}", height=70))
        if st.form_submit_button("답변 저장", type="primary"):
            for item, a in zip(st.session_state.pending_questions, answers):
                if a.strip():
                    db["facts"].append({"id": storage.new_id(), "created_at": storage.now(),
                                        "q": item["q"], "a": a.strip()})
            st.session_state.pending_questions = [
                item for item, a in zip(st.session_state.pending_questions, answers) if not a.strip()
            ]
            persist()
            st.success("저장했어요. 다시 생성하면 이 답변을 반영합니다.")
            st.rerun()

tab_style, tab_exp, tab_write, tab_history = st.tabs(
    ["① 내 말투 학습", "② 경험 뱅크", "③ 자소서 작성", "④ 작성 기록"]
)

# ---------------------------------------------------------------- ① 말투
with tab_style:
    st.subheader("내가 직접 쓴 글을 넣어주세요")
    st.write("예전에 쓴 자소서, 블로그 글, 과제 리포트 등. **많을수록(3개 이상, 총 2,000자 이상) 정확해집니다.**")

    with st.form("add_sample", clear_on_submit=True):
        title = st.text_input("제목 (예: 2025 하반기 OO기업 자소서 1번)")
        text = st.text_area("본문", height=200)
        if st.form_submit_button("샘플 추가") and text.strip():
            db["samples"].append({"id": storage.new_id(), "title": title or "제목 없음", "text": text.strip()})
            persist()
            st.rerun()

    for s in db["samples"]:
        with st.expander(f"📄 {s['title']} ({len(s['text'])}자)"):
            st.text(s["text"])
            if st.button("삭제", key=f"del_sample_{s['id']}"):
                db["samples"] = [x for x in db["samples"] if x["id"] != s["id"]]
                persist()
                st.rerun()

    st.divider()
    col1, col2 = st.columns([1, 3])
    with col1:
        analyze = st.button("🔍 말투 분석하기", type="primary", disabled=not db["samples"])
    if analyze and (writer := get_writer()):
        st.markdown("#### 분석 결과")
        profile = run_stream(writer.analyze_style(db["samples"]))
        if profile:
            db["style_profile"] = profile
            persist()
            st.success("말투 프로필을 저장했습니다. 아래에서 직접 다듬을 수도 있어요.")

    st.markdown("#### 말투 프로필")
    edited = st.text_area("분석 결과를 직접 고쳐도 됩니다", value=db["style_profile"], height=350,
                          key=f"profile_edit_{hash(db['style_profile'])}")
    if st.button("프로필 저장"):
        db["style_profile"] = edited
        persist()
        st.success("저장했습니다.")

# ---------------------------------------------------------------- ② 경험
with tab_exp:
    st.subheader("경험 뱅크")
    st.write("AI는 **여기 적힌 사실만** 사용합니다. 수치·성과를 구체적으로 적을수록 글이 좋아집니다.")

    with st.form("add_exp", clear_on_submit=True):
        c1, c2, c3 = st.columns(3)
        title = c1.text_input("경험 이름 *", placeholder="예: 학과 캡스톤 프로젝트")
        period = c2.text_input("기간", placeholder="2025.03 ~ 2025.06")
        role = c3.text_input("역할", placeholder="팀장 / 백엔드 담당")
        situation = st.text_area("상황 · 문제", placeholder="어떤 상황이었고, 무엇이 문제였나요?")
        action = st.text_area("내가 한 행동", placeholder="내가 구체적으로 무엇을 했나요?")
        result = st.text_area("결과 · 성과", placeholder="수치가 있으면 꼭 적어주세요 (예: 처리시간 30% 단축)")
        learned = st.text_area("배운 점 · 느낀 점")
        tags = st.text_input("키워드", placeholder="리더십, 갈등해결, 데이터분석")
        if st.form_submit_button("경험 추가") and title.strip():
            db["experiences"].append({
                "id": storage.new_id(), "title": title, "period": period, "role": role,
                "situation": situation, "action": action, "result": result,
                "learned": learned, "tags": tags,
            })
            persist()
            st.rerun()

    for e in db["experiences"]:
        with st.expander(f"⭐ {e['title']}  {('· ' + e['tags']) if e.get('tags') else ''}"):
            for key, label in [("period", "기간"), ("role", "역할"), ("situation", "상황"),
                               ("action", "행동"), ("result", "결과"), ("learned", "배운 점"),
                               ("notes", "주의")]:
                if e.get(key):
                    st.markdown(f"**{label}** — {e[key]}")
            if st.button("삭제", key=f"del_exp_{e['id']}"):
                db["experiences"] = [x for x in db["experiences"] if x["id"] != e["id"]]
                persist()
                st.rerun()

    st.divider()
    st.subheader("AI 질문에 내가 답한 사실")
    if not db["facts"]:
        st.caption("아직 없습니다. AI가 정보가 부족하다고 질문하면 여기에 쌓여요.")
    for f in db["facts"]:
        c1, c2 = st.columns([10, 1])
        c1.markdown(f"**Q.** {f['q']}  \n**A.** {f['a']}")
        if c2.button("삭제", key=f"del_fact_{f['id']}"):
            db["facts"] = [x for x in db["facts"] if x["id"] != f["id"]]
            persist()
            st.rerun()

# ---------------------------------------------------------------- ③ 작성
with tab_write:
    st.subheader("지원 정보")
    c1, c2 = st.columns(2)
    company = c1.text_input("회사명", key="company")
    job = c2.text_input("지원 직무", key="job")
    job_info = st.text_area("채용공고 · 인재상 · 직무 설명 (복사해서 붙여넣기)", height=150, key="job_info")

    exp_titles = {e["title"]: e for e in db["experiences"]}
    picked = st.multiselect("사용할 경험 (비우면 전체 중에서 AI가 고릅니다)", list(exp_titles))

    st.subheader("문항")
    if "questions" not in st.session_state:
        st.session_state.questions = [{"q": "", "limit": 700}]
    for i, q in enumerate(st.session_state.questions):
        c1, c2, c3 = st.columns([6, 1.2, 0.6])
        q["q"] = c1.text_area(f"문항 {i + 1}", value=q["q"], key=f"q_{i}", height=80)
        q["limit"] = c2.number_input("글자수(0=무제한)", value=q["limit"], min_value=0, step=50, key=f"lim_{i}")
        if c3.button("✕", key=f"rm_q_{i}") and len(st.session_state.questions) > 1:
            st.session_state.questions.pop(i)
            st.rerun()
    if st.button("＋ 문항 추가"):
        st.session_state.questions.append({"q": "", "limit": 700})
        st.rerun()

    extra = st.text_input("추가 요청 (선택)", placeholder="예: 첫 문장은 질문으로 시작해줘 / 협업 경험을 강조해줘")
    show_plan = st.checkbox("작성 계획도 보여주기", value=True)

    if not db["style_profile"]:
        st.warning("말투 프로필이 없어 기본 문체로 작성됩니다. ① 탭에서 먼저 말투를 학습시키면 더 '나다운' 글이 나와요.")

    if st.button("✍️ 자소서 생성", type="primary") and (writer := get_writer()):
        questions = [q for q in st.session_state.questions if q["q"].strip()]
        if not questions:
            st.error("문항을 하나 이상 입력하세요.")
        experiences = [exp_titles[t] for t in picked] if picked else db["experiences"]
        system = writer.writer_system(db["style_profile"], experiences, db["facts"])
        results = []
        for i, q in enumerate(questions, 1):
            limit = int(q["limit"]) or None
            ctx = dict(company=company or "(미입력)", job=job or "(미입력)",
                       job_info=job_info or "(없음)", question=q["q"], limit_text=limit_text(limit))
            st.markdown(f"---\n### 문항 {i}. {q['q']}")
            if show_plan:
                with st.expander("작성 계획", expanded=False):
                    plan = run_stream(writer.plan(system, ctx))
            else:
                try:
                    plan = "".join(writer.plan(system, ctx))
                except GenerationError as e:
                    st.error(str(e))
                    plan = None
            if not plan:
                continue
            questions = parse_questions(plan)
            if questions:
                st.warning("사실이 부족해서 이 문항은 쓰지 않았어요. 위쪽 질문에 답한 뒤 다시 생성하세요.\n\n"
                           + "\n".join(f"- {q}" for q in questions))
                ask_user(f"문항 {i}", questions)
                continue
            answer = run_stream(writer.write(system, ctx, plan, extra))
            if not answer:
                continue
            if limit and char_count(answer)[0] > limit:
                with st.spinner("글자수 제한을 넘어 줄이는 중..."):
                    try:
                        answer = writer.fit_limit(system, answer, limit)
                    except GenerationError as e:
                        st.error(str(e))
                st.markdown("**↓ 글자수 맞춘 최종본**")
                st.write(answer)
            show_count(answer, limit)
            draft = {"id": storage.new_id(), "created_at": storage.now(), "company": company,
                     "job": job, "question": q["q"], "limit": limit, "answer": answer,
                     "experience_ids": [e["id"] for e in experiences]}
            db["drafts"].insert(0, draft)
            results.append(draft)
        if results:
            persist()
            st.success(f"{len(results)}개 답변을 ④ 작성 기록에 저장했습니다. 거기서 수정 요청도 할 수 있어요.")
        if st.session_state.pending_questions:
            st.rerun()

# ---------------------------------------------------------------- ④ 기록
with tab_history:
    st.subheader("작성 기록")
    if not db["drafts"]:
        st.info("아직 작성한 답변이 없습니다.")
    for d in db["drafts"]:
        label = f"{d['created_at']} · {d.get('company') or '-'} / {d.get('job') or '-'} · {d['question'][:40]}"
        with st.expander(label):
            st.markdown(f"**문항** {d['question']}")
            answer = st.text_area("답변 (직접 수정 가능)", value=d["answer"], height=300, key=f"ans_{d['id']}")
            show_count(answer, d.get("limit"))
            c1, c2 = st.columns(2)
            if c1.button("수정본 저장", key=f"save_{d['id']}"):
                d["answer"] = answer
                persist()
                st.success("저장했습니다.")
            if c2.button("기록 삭제", key=f"del_d_{d['id']}"):
                db["drafts"] = [x for x in db["drafts"] if x["id"] != d["id"]]
                persist()
                st.rerun()

            feedback = st.text_input("AI에게 수정 요청", key=f"fb_{d['id']}",
                                     placeholder="예: 두 번째 문단을 더 구체적으로 / 마무리를 덜 딱딱하게")
            if st.button("🔁 다시 쓰기", key=f"rev_{d['id']}") and feedback and (writer := get_writer()):
                ids = set(d.get("experience_ids") or [])
                exps = [e for e in db["experiences"] if e["id"] in ids] or db["experiences"]
                system = writer.writer_system(db["style_profile"], exps, db["facts"])
                new = run_stream(writer.revise(system, d["question"], d.get("limit"), answer, feedback))
                if new and (questions := parse_questions(new)):
                    ask_user("수정 요청", questions)
                    st.rerun()
                elif new:
                    new = writer.fit_limit(system, new, d.get("limit"))
                    d["answer"] = new
                    persist()
                    st.rerun()
