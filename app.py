"""웹 화면 실행:  streamlit run app.py"""
from __future__ import annotations

import streamlit as st

from coverletter import llm, pipeline

st.set_page_config(page_title="내 말투 자소서", page_icon="📝", layout="wide")
st.title("📝 내 말투로 쓰는 자기소개서")

tab_style, tab_exp, tab_write = st.tabs(["1. 내 글(문체)", "2. 내 경험", "3. 자소서 작성"])

# ---------- 1. 문체 ----------
with tab_style:
    st.caption("예전에 직접 쓴 자소서, 과제 리포트, 블로그 글 등을 붙여넣으세요. 많을수록(3편 이상) 정확합니다.")
    existing = pipeline.load_samples()
    if existing:
        st.info(f"data/samples/ 폴더의 글 {len(existing)}편도 함께 분석합니다: " + ", ".join(n for n, _ in existing))
    pasted = st.text_area("내가 쓴 글 (여러 편이면 `---` 한 줄로 구분)", height=300)
    uploads = st.file_uploader("또는 .txt / .md 파일 업로드", type=["txt", "md"], accept_multiple_files=True)

    if st.button("문체 분석하기", type="primary"):
        samples = list(existing)
        samples += [(f"붙여넣기{i + 1}", t.strip()) for i, t in enumerate(pasted.split("\n---\n")) if t.strip()]
        samples += [(f.name, f.read().decode("utf-8")) for f in uploads or []]
        try:
            with st.spinner("문체 분석 중... (1분 정도 걸릴 수 있어요)"):
                profile = pipeline.build_style_profile(samples, log=lambda m: None)
            pipeline.STYLE_FILE.write_text(profile, encoding="utf-8")
            st.success("문체 프로필을 저장했습니다.")
        except llm.LLMError as e:
            st.error(str(e))

    if pipeline.STYLE_FILE.exists():
        with st.expander("현재 문체 프로필 보기 / 직접 수정", expanded=False):
            edited = st.text_area("문체 프로필", pipeline.STYLE_FILE.read_text(encoding="utf-8"), height=400, key="style_edit")
            if st.button("수정 내용 저장"):
                pipeline.STYLE_FILE.write_text(edited, encoding="utf-8")
                st.success("저장했습니다.")

# ---------- 2. 경험 ----------
with tab_exp:
    st.caption("자소서에 쓸 수 있는 경험을 최대한 구체적으로 적어 두세요. 여기 없는 내용은 지어내지 않습니다.")
    exp_text = pipeline.EXPERIENCES_FILE.read_text(encoding="utf-8") if pipeline.EXPERIENCES_FILE.exists() else ""
    new_exp = st.text_area("경험 목록 (data/experiences.md)", exp_text, height=500)
    if st.button("경험 저장"):
        pipeline.EXPERIENCES_FILE.write_text(new_exp, encoding="utf-8")
        st.success("저장했습니다.")

# ---------- 3. 작성 ----------
with tab_write:
    c1, c2 = st.columns(2)
    company = c1.text_input("회사명")
    role = c2.text_input("지원 직무")
    posting = st.text_area("채용공고 / 인재상 / 회사 정보 (복사해서 붙여넣기)", height=180)
    extra = st.text_input("추가 요청 (선택) 예: 야간대학 병행 경험을 성실함으로 어필하고 싶어요")

    if "n_q" not in st.session_state:
        st.session_state.n_q = 1
    questions: list[pipeline.Question] = []
    for i in range(st.session_state.n_q):
        qc1, qc2 = st.columns([5, 1])
        q = qc1.text_area(f"문항 {i + 1}", key=f"q{i}", height=80)
        lim = qc2.number_input("글자 수", 100, 5000, 1000, 100, key=f"l{i}")
        if q.strip():
            questions.append(pipeline.Question(q.strip(), int(lim)))
    b1, b2, _ = st.columns([1, 1, 6])
    if b1.button("＋ 문항 추가"):
        st.session_state.n_q += 1
        st.rerun()
    if b2.button("－ 문항 삭제") and st.session_state.n_q > 1:
        st.session_state.n_q -= 1
        st.rerun()

    if st.button("자소서 생성", type="primary", disabled=not (company and role and questions)):
        if not pipeline.STYLE_FILE.exists():
            st.error("먼저 1번 탭에서 문체 분석을 해 주세요.")
        elif not new_exp.strip():
            st.error("2번 탭에 경험을 입력해 주세요.")
        else:
            app = pipeline.Application(company, role, posting, questions, extra)
            status = st.status("작성 중...", expanded=True)
            try:
                answers = pipeline.run(app, experiences=new_exp, log=status.write)
                status.update(label="완료!", state="complete")
                st.session_state.result = (app, answers)
            except llm.LLMError as e:
                status.update(label="오류", state="error")
                st.error(str(e))

    if "result" in st.session_state:
        app, answers = st.session_state.result
        for i, a in enumerate(answers, 1):
            st.subheader(f"{i}. {a.question.question}")
            ok = a.question.limit * pipeline.MIN_RATIO <= a.length <= a.question.limit
            st.caption(f"{'✅' if ok else '⚠️'} {a.length}/{a.question.limit}자 (공백 포함)")
            st.text_area("답변", a.text, height=300, key=f"ans{i}")
            with st.expander("문항 분석 / 소재 선택 근거"):
                st.markdown(a.analysis)
        st.download_button("마크다운으로 다운로드", pipeline.to_markdown(app, answers, True),
                           file_name=f"{app.company}_{app.role}.md")
