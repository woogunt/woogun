(() => {
  "use strict";

  // =========================================================
  // 상수
  // =========================================================
  const KEY = "uridul-v1";
  const SESSION_KEY = "uridul-session";
  const LOCAL_KEY = "uridul-local"; // 이 기기 전용 설정 (위젯 배치, 배경, 알림 읽음)
  const DAY = 86400000;
  const SHARE_ENABLED = !!(window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.projectId);
  const COLLS = ["events", "bucket", "diary", "records", "expenses", "photos", "places"];

  const MOODS = ["😊", "🥰", "😴", "😢", "😠", "🤒"];
  const CULTURE = [
    { id: "movie", label: "영화", em: "🎬" },
    { id: "exhibit", label: "전시", em: "🖼️" },
    { id: "escape", label: "방탈출", em: "🔐" },
  ];
  const FOOD = [
    { id: "restaurant", label: "음식점", em: "🍽️" },
    { id: "cafe", label: "카페", em: "☕" },
    { id: "cooking", label: "요리", em: "🍳" },
  ];
  const EXP_CATS = ["식비", "카페", "문화", "교통", "숙소", "쇼핑", "선물", "기타"];
  const DEFAULT_WIDGETS = ["dday", "calendar", "diary", "album"];
  const DEFAULT_TITLE = "우리둘"; // 이름을 정하지 않았을 때
  // 버튼 아이콘 (글자 대신 그림이라 어느 폰에서나 정확히 가운데)
  const ICON = {
    plus: `<svg class="ico" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>`,
    bell: `<svg class="ico" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/></svg>`,
    gear: `<svg class="ico" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
    back: `<svg class="ico" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>`,
    next: `<svg class="ico" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>`,
    search: `<svg class="ico" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>`,
    camera: `<svg class="ico" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l1.6-2.2h6.8L17 8h3v11H4z"/><circle cx="12" cy="13.5" r="3.4"/></svg>`,
    up: `<svg class="ico" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>`,
    down: `<svg class="ico" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6"/></svg>`,
    close: `<svg class="ico" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>`,
  };


  // =========================================================
  // 저장소
  // =========================================================
  const defaults = () => ({
    profile: null, // { p1, p2, start, dayOne }
    moods: {},     // { "YYYY-MM-DD": { p1, p2 } }
    events: [],    // { id, date, title, owner: "p1"|"p2"|"both", time?, memo?, by, at }
    bucket: [],    // { id, title, done, by, at }
    diary: [],     // { id, date, title, body, photo, by, at }
    records: [],   // { id, cat, title, date, rating, memo, photo, by, at }
    expenses: [],  // { id, date, title, amount, cat, payer, by, at }
    photos: [],    // { id, src, by, at }
    places: [],    // { id: "kr-seoul" | "w-jp", by, at }
  });

  const readJSON = (k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } };
  const writeJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };

  let state = Object.assign(defaults(), readJSON(KEY) || {});
  let local = Object.assign({ widgets: DEFAULT_WIDGETS.slice(), bg: null, lastSeen: Date.now(), glass: { alpha: 0.32, blur: 24, tone: "auto" } }, readJSON(LOCAL_KEY) || {});
  if (!local.glass) local.glass = { alpha: 0.32, blur: 24, tone: "auto" };
  if (!local.glass.tone) local.glass.tone = "auto";
  let session = readJSON(SESSION_KEY); // 공유 모드: { roomId, role, code? }

  // ---- 이전 버전 데이터 변환 ----
  if (state.profile && state.profile.me !== undefined) {
    const { me, you, ...rest } = state.profile;
    state.profile = { p1: me, p2: you, ...rest };
    for (const k in state.moods) {
      const { me: a, you: b } = state.moods[k];
      state.moods[k] = JSON.parse(JSON.stringify({ p1: a || undefined, p2: b || undefined }));
    }
  }
  if (Array.isArray(state.letters)) {
    for (const l of state.letters) {
      const d = new Date(l.at);
      state.diary.push({
        id: l.id, date: ymd(d), title: "편지", body: l.body,
        by: state.profile && l.from === state.profile.p2 ? "p2" : "p1", at: l.at,
      });
    }
    delete state.letters;
  }
  if (state.theme !== undefined) delete state.theme;

  const shared = () => !!(session && session.roomId);
  const role = () => (session && session.role) || local.myRole || "p1";
  const other = () => (role() === "p1" ? "p2" : "p1");
  const nameOf = (r) => (state.profile && state.profile[r]) || (r === role() ? "나" : "상대");

  function save() {
    // 공유 모드에서는 사진류를 서버에서 다시 받으므로 로컬 캐시에서 제외 (용량 절약)
    const data = shared()
      ? { ...state, photos: [], diary: state.diary.map(stripPhoto), records: state.records.map(stripPhoto) }
      : state;
    if (!writeJSON(KEY, data)) toast("저장 공간이 부족해요. 사진을 몇 장 지워주세요.");
  }
  const stripPhoto = ({ photo, ...rest }) => rest;
  const saveLocal = () => { if (!writeJSON(LOCAL_KEY, local)) toast("배경 사진이 너무 커요."); };
  const saveSession = () => {
    if (session && session.artifact) return; // claude.ai 링크 공유는 열 때마다 확인
    try { session ? writeJSON(SESSION_KEY, session) : localStorage.removeItem(SESSION_KEY); } catch { /* 저장소 막힘 */ }
  };
  if (session && session.artifact) session = null;

  // =========================================================
  // 유틸
  // =========================================================
  function $(s, el = document) { return el.querySelector(s); }
  function $$(s, el = document) { return [...el.querySelectorAll(s)]; }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function esc(s) { return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  function pad(n) { return String(n).padStart(2, "0"); }
  function ymd(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
  function parse(s) { const [y, m, d] = String(s).split("-").map(Number); return new Date(y, (m || 1) - 1, d || 1); }
  function today() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
  function diffDays(a, b) { return Math.round((parse(ymd(b)) - parse(ymd(a))) / DAY); }
  const WD = ["일", "월", "화", "수", "목", "금", "토"];
  const fmt = (d) => `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
  const fmtW = (d) => `${d.getMonth() + 1}월 ${d.getDate()}일 (${WD[d.getDay()]})`;
  const fmtLong = (d) => `${d.getMonth() + 1}월 ${d.getDate()}일 ${WD[d.getDay()]}요일`;
  const won = (n) => `${Math.round(n || 0).toLocaleString("ko-KR")}원`;
  const stars = (n) => "★".repeat(n || 0) + "☆".repeat(5 - (n || 0));

  // 사진 dataURL만 허용 (스타일/속성에 넣기 전 검증)
  const IMG_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
  const safeImg = (s) => (typeof s === "string" && IMG_RE.test(s) ? s : "");
  const bgStyle = (s) => (safeImg(s) ? `style="background-image:url('${s}')"` : "");

  let toastTimer;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg; t.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add("hidden"), 2500);
  }

  function resizeImage(file, max, quality = 0.75) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(img.src);
        resolve(c.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  function pickImages({ multiple = false, capture = false } = {}) {
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file"; input.accept = "image/*"; input.multiple = multiple;
      if (capture) input.setAttribute("capture", "environment");
      input.onchange = () => resolve([...input.files]);
      input.click();
    });
  }

  // =========================================================
  // 동기화 / 저장
  // =========================================================
  let syncMod = null;
  let artifactBackend = null; // claude.ai 링크(아티팩트)의 공유 저장소
  async function sync() {
    if (artifactBackend) return artifactBackend;
    if (!syncMod) syncMod = await import("./sync.js");
    await syncMod.init();
    return syncMod;
  }

  // ---------------------------------------------------------
  // claude.ai 아티팩트 공유 저장소 (db) — 링크 하나가 둘만의 공간
  //   space/main            { profile, moods, members: { p1: 사용자id, p2: 사용자id } }
  //   space/main/<컬렉션>/<id>  일정·일기·사진 등 하나씩
  // ---------------------------------------------------------
  const SPACE = "space/main";
  const DOC_MAX = 240000; // 문서 하나 256KiB 제한 → 사진은 이보다 작게
  const withTimeout = (p, ms) => Promise.race([Promise.resolve(p).catch(() => null), new Promise((res) => setTimeout(() => res(null), ms))]);
  const plain = (o) => JSON.parse(JSON.stringify(o)); // undefined 제거

  // 사진(dataURL)이 너무 크면 더 작게 다시 압축
  function shrinkDataURL(src, maxLen = DOC_MAX) {
    if (typeof src !== "string" || src.length <= maxLen) return Promise.resolve(src);
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        for (const [max, q] of [[960, 0.72], [820, 0.66], [700, 0.6], [560, 0.55], [420, 0.5]]) {
          const sc = Math.min(1, max / Math.max(img.width, img.height));
          const c = document.createElement("canvas");
          c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          const out = c.toDataURL("image/jpeg", q);
          if (out.length <= maxLen) return resolve(out);
        }
        resolve(null);
      };
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }
  async function shrinkItem(data) {
    const out = { ...data };
    for (const k of ["src", "photo"]) if (typeof out[k] === "string") out[k] = await shrinkDataURL(out[k]);
    return out;
  }

  function makeArtifactBackend(db, uid) {
    const space = db.doc(SPACE);
    const coll = (c) => db.collection(`${SPACE}/${c}`);
    const roomFrom = (d) => ({ ...d, members: Object.values(d.members || {}).filter(Boolean) });
    return {
      async init() {},
      async createRoom(profile, localData = {}) {
        // 이미 공간이 있으면 절대 덮어쓰지 않음 (다른 기기나 상대가 먼저 만든 경우)
        const cur = await space.get();
        if (cur.exists) throw Object.assign(new Error("space exists"), { code: "exists" });
        await space.set(plain({ profile, moods: localData.moods || {}, members: { p1: uid }, createdAt: Date.now() }));
        // 이 기기에 있던 기록을 함께 올림 (하나씩, 사진은 크기를 줄여서)
        for (const c of COLLS) {
          for (const item of localData[c] || []) {
            const { id, ...rest } = item;
            try { await coll(c).doc(id).set(plain(await shrinkItem(rest))); } catch (e) { console.error("upload", c, id, e); }
          }
        }
        return { roomId: "artifact", role: "p1", artifact: true };
      },
      async claim(r) {
        await space.update({ members: { [r]: uid } });
        return { roomId: "artifact", role: r, artifact: true };
      },
      async switchRole(from, to) {
        await space.update({ members: { [to]: uid, [from]: null } });
      },
      subscribe(_, { onRoom, onColl, onError }) {
        const unsubs = [
          space.onSnapshot((snap) => { if (snap.exists) onRoom(roomFrom(snap.data())); }, onError),
          ...COLLS.map((c) => coll(c).onSnapshot((qs) => onColl(c, qs.docs.map((d) => ({ id: d.id, ...d.data() }))), onError)),
        ];
        return () => unsubs.forEach((u) => u());
      },
      ops: {
        add: async (_, c, { id, ...data }) => coll(c).doc(id).set(plain(await shrinkItem(data))),
        update: async (_, c, id, patch) => coll(c).doc(id).update(plain(await shrinkItem(patch))),
        remove: (_, c, id) => coll(c).doc(id).delete(),
        setProfile: (_, profile) => space.update(plain({ profile })),
        setMood: (_, date, r, mood) => space.update({ moods: { [date]: { [r]: mood ?? null } } }),
      },
    };
  }

  function setBadge(text, off) {
    const b = $("#syncBadge");
    b.classList.toggle("hidden", !text);
    b.classList.toggle("off", !!off);
    b.textContent = text || "";
  }

  async function remote(fn) {
    try {
      await fn(await sync());
    } catch (e) {
      console.error(e);
      toast("저장에 실패했어요. 인터넷 연결을 확인해주세요.");
    }
  }

  // 모든 데이터 변경은 store를 거침: 로컬 모드면 바로 저장, 공유 모드면 서버에 쓰고 실시간 구독으로 갱신
  const store = {
    async add(coll, item) {
      item = { by: role(), at: Date.now(), ...item };
      if (shared()) return remote((s) => s.ops.add(session.roomId, coll, item));
      state[coll] = state[coll].filter((x) => x.id !== item.id);
      state[coll].push(item); sortColl(coll); save(); render();
    },
    async update(coll, id, patch) {
      if (shared()) return remote((s) => s.ops.update(session.roomId, coll, id, patch));
      Object.assign(state[coll].find((x) => x.id === id) || {}, patch); sortColl(coll); save(); render();
    },
    async remove(coll, id) {
      if (shared()) return remote((s) => s.ops.remove(session.roomId, coll, id));
      state[coll] = state[coll].filter((x) => x.id !== id); save(); render();
    },
    async setProfile(p) {
      if (shared()) return remote((s) => s.ops.setProfile(session.roomId, p));
      state.profile = p; save(); render();
    },
    async setMood(date, who, mood) {
      if (shared()) return remote((s) => s.ops.setMood(session.roomId, date, who, mood));
      state.moods[date] = { ...(state.moods[date] || {}), [who]: mood }; save(); render();
    },
  };

  const byAtDesc = (a, b) => (b.at || 0) - (a.at || 0);
  const SORTERS = {
    events: (a, b) => a.date.localeCompare(b.date),
    diary: (a, b) => b.date.localeCompare(a.date) || byAtDesc(a, b),
    records: (a, b) => (b.date || "").localeCompare(a.date || "") || byAtDesc(a, b),
    expenses: (a, b) => b.date.localeCompare(a.date) || byAtDesc(a, b),
  };
  const sortColl = (c) => state[c].sort(SORTERS[c] || byAtDesc);

  // ---- 실시간 구독 ----
  let unsubscribe = null;
  let memberCount = 2;

  async function connect() {
    if (unsubscribe) unsubscribe();
    setBadge("연결 중…", true);
    let s;
    try { s = await sync(); } catch (e) { console.error(e); setBadge("오프라인", true); return; }
    if (!session.artifact && s.remember) s.remember(session.roomId, session.role);
    unsubscribe = s.subscribe(session.roomId, {
      onRoom(room) {
        state.profile = room.profile;
        state.moods = room.moods || {};
        memberCount = room.members.length;
        if (memberCount >= 2 && session.code) { delete session.code; saveSession(); }
        setBadge(memberCount >= 2 ? "● 공유 중" : "상대 기다리는 중", memberCount < 2);
        save(); render();
      },
      onColl(coll, items) {
        state[coll] = items; sortColl(coll);
        save(); render();
      },
      onError(e) {
        console.error(e);
        if (session && session.artifact) { setBadge(e && e.code === "revoked" ? "연결 끊김" : "오프라인", true); return; }
        if (e.code === "permission-denied" || e.message === "not-found") {
          setBadge("연결 끊김", true);
          toast("이 기기의 연결이 해제됐어요. 상대에게 새 초대 코드를 받아주세요.");
          disconnectLocal();
        } else {
          setBadge("오프라인", true);
        }
      },
    });
  }

  function disconnectLocal() {
    if (unsubscribe) unsubscribe();
    unsubscribe = null;
    session = null; saveSession();
    state = defaults(); save();
    closeAllPages(); boot();
  }

  // =========================================================
  // 날짜 계산
  // =========================================================
  function ddayCount() {
    const p = state.profile;
    return diffDays(parse(p.start), today()) + (p.dayOne ? 1 : 0);
  }
  function anniversaries(limitYears = 30) {
    const p = state.profile;
    const start = parse(p.start);
    const offset = p.dayOne ? 1 : 0;
    const list = [];
    for (let n = 100; n <= 365 * limitYears; n += 100) list.push({ label: `${n}일`, date: addDays(start, n - offset) });
    for (let y = 1; y <= limitYears; y++) {
      const d = new Date(start); d.setFullYear(start.getFullYear() + y);
      list.push({ label: `${y}주년`, date: d });
    }
    return list.sort((a, b) => a.date - b.date);
  }
  const upcomingAnniv = (count) => anniversaries().filter((a) => a.date >= today()).slice(0, count);
  function specialDays() {
    const m = new Map(anniversaries().map((a) => [ymd(a.date), a.label]));
    m.set(state.profile.start, "처음 만난 날");
    return m;
  }

  // =========================================================
  // 입력 폼 (바텀 시트)
  // =========================================================
  let formSubmit = null;

  function openForm({ title, fields, okText = "저장", onSubmit }) {
    $("#modalTitle").textContent = title;
    $("#modalOk").textContent = okText;
    $("#modalFields").innerHTML = fields.map(fieldHTML).join("");
    formSubmit = onSubmit;
    $("#modal").classList.remove("hidden");
    const first = $("#modalFields input:not([type=hidden]), #modalFields textarea");
    if (first && first.type !== "date") setTimeout(() => first.focus(), 50);
  }
  // 브라우저 confirm() 대신 쓰는 확인 창 (일부 환경에서 confirm이 막혀 있음)
  function ask(message, okText = "확인") {
    return new Promise((resolve) => {
      const box = $("#askBox");
      $("#askMsg").textContent = message;
      $("#askOk").textContent = okText;
      box.classList.remove("hidden");
      const done = (v) => { box.classList.add("hidden"); box.onclick = null; resolve(v); };
      box.onclick = (e) => {
        if (e.target.id === "askOk") done(true);
        else if (e.target.id === "askCancel" || e.target === box) done(false);
      };
    });
  }

  function closeForm() { $("#modal").classList.add("hidden"); formSubmit = null; }

  function fieldHTML(f) {
    const v = f.value ?? "";
    const req = f.required ? "required" : "";
    const ph = f.placeholder ? `placeholder="${esc(f.placeholder)}"` : "";
    const ml = f.max ? `maxlength="${f.max}"` : "";
    let inner;
    switch (f.type) {
      case "textarea":
        inner = `<textarea name="${f.name}" rows="${f.rows || 5}" ${req} ${ph} ${ml}>${esc(v)}</textarea>`; break;
      case "seg":
        inner = `<input type="hidden" name="${f.name}" value="${esc(v)}" />
          <div class="seg seg-input" data-seg="${f.name}">${f.options.map((o) =>
            `<button type="button" data-v="${esc(o.value)}" class="${o.value === v ? "on" : ""}">${esc(o.label)}</button>`).join("")}</div>`;
        break;
      case "select":
        inner = `<select name="${f.name}">${f.options.map((o) =>
          `<option value="${esc(o.value)}" ${o.value === v ? "selected" : ""}>${esc(o.label)}</option>`).join("")}</select>`;
        break;
      case "rating":
        inner = `<input type="hidden" name="${f.name}" value="${+v || 0}" />
          <div class="stars" data-stars="${f.name}">${[1, 2, 3, 4, 5].map((n) =>
            `<button type="button" data-n="${n}" class="${n <= v ? "on" : ""}">★</button>`).join("")}</div>`;
        break;
      case "photo":
        inner = `<input type="hidden" name="${f.name}" value="${esc(safeImg(v))}" />
          <div class="photo-field" data-photo="${f.name}">
            <div class="thumb" ${bgStyle(v)}>${safeImg(v) ? "" : "📷"}</div>
            <button type="button" class="link" data-photo-clear>${safeImg(v) ? "사진 빼기" : "사진 추가"}</button>
          </div>`;
        break;
      default:
        inner = `<input type="${f.type || "text"}" name="${f.name}" value="${esc(v)}" ${req} ${ph} ${ml}
          ${f.type === "number" ? 'inputmode="numeric" min="0" step="1"' : ""} />`;
    }
    return `<label>${esc(f.label)}${inner}</label>`;
  }

  $("#modalFields").addEventListener("click", async (e) => {
    const segBtn = e.target.closest("[data-seg] button");
    if (segBtn) {
      const seg = segBtn.parentElement;
      $$("button", seg).forEach((b) => b.classList.toggle("on", b === segBtn));
      $(`input[name="${seg.dataset.seg}"]`, $("#modalFields")).value = segBtn.dataset.v;
      return;
    }
    const star = e.target.closest("[data-stars] button");
    if (star) {
      const box = star.parentElement; const n = +star.dataset.n;
      $$("button", box).forEach((b) => b.classList.toggle("on", +b.dataset.n <= n));
      $(`input[name="${box.dataset.stars}"]`, $("#modalFields")).value = n;
      return;
    }
    const pf = e.target.closest("[data-photo]");
    if (pf) {
      e.preventDefault();
      const input = $(`input[name="${pf.dataset.photo}"]`, $("#modalFields"));
      const thumb = $(".thumb", pf), btn = $("[data-photo-clear]", pf);
      if (input.value && e.target.closest("[data-photo-clear]")) {
        input.value = ""; thumb.removeAttribute("style"); thumb.textContent = "📷"; btn.textContent = "사진 추가";
        return;
      }
      const [file] = await pickImages();
      if (!file) return;
      try {
        const src = await resizeImage(file, 720, 0.72);
        input.value = src; thumb.style.backgroundImage = `url('${src}')`; thumb.textContent = ""; btn.textContent = "사진 빼기";
      } catch { toast("사진을 읽을 수 없어요."); }
    }
  });
  $("#modalForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(e.target));
    for (const k in values) if (typeof values[k] === "string") values[k] = values[k].trim();
    const fn = formSubmit;
    closeForm();
    if (fn) await fn(values);
  });
  $("#modalCancel").addEventListener("click", closeForm);
  $("#modal").addEventListener("click", (e) => { if (e.target.id === "modal") closeForm(); });

  // =========================================================
  // 위젯
  // =========================================================
  const latestPhotoBy = (r) => state.photos.find((p) => p.by === r && safeImg(p.src));
  const visited = (prefix) => state.places.filter((p) => p.id.startsWith(prefix));

  // ---- 데이트 지도: 시·도 → 시·군·구 ----
  const SGG = window.SGG_INDEX || {};
  const SGG_TOTAL = Object.values(SGG).reduce((n, l) => n + l.length, 0);
  const PROV_OF_CODE = {};
  for (const [prov, list] of Object.entries(SGG)) list.forEach(([code]) => (PROV_OF_CODE[code] = prov));
  const provName = (prov) => (window.MAP_KR.locations.find((l) => l.id === prov) || {}).name || prov;
  const sggName = (code) => ((SGG[PROV_OF_CODE[code]] || []).find(([c]) => c === code) || [])[1] || code;

  // 가본 구: 지도에 표시했거나 사진을 넣은 곳. photo = 그 구의 가장 최근 사진
  function districtState() {
    const visitedSet = new Set(visited("d-").map((p) => p.id.slice(2)));
    const photo = new Map();
    for (const p of state.photos) {
      if (typeof p.place !== "string" || !p.place.startsWith("d-") || !safeImg(p.src)) continue;
      const code = p.place.slice(2);
      visitedSet.add(code);
      if (!photo.has(code)) photo.set(code, p.src);
    }
    return { visited: visitedSet, photo };
  }
  function provinceState() {
    const ds = districtState();
    const out = {};
    for (const [prov, list] of Object.entries(SGG)) {
      const codes = list.map(([c]) => c);
      const n = codes.filter((c) => ds.visited.has(c)).length;
      const ph = codes.map((c) => ds.photo.get(c)).find(Boolean);
      out[prov] = { n, total: codes.length, photo: ph, on: n > 0 || state.places.some((p) => p.id === `kr-${prov}`) };
    }
    return out;
  }

  // 사진을 지역 모양 안에 채우는 SVG 패턴. 위치/크기는 그린 뒤 fitPatterns()가 맞춤
  let patSeq = 0;
  function mapShapes(locs, { info, action, label }) {
    let defs = "";
    const paths = locs.map((l) => {
      const st = info(l.id);
      let fill = "";
      if (st.photo) {
        const pid = `ph${++patSeq}`;
        defs += `<pattern id="${pid}" patternUnits="userSpaceOnUse"><image href="${st.photo}" preserveAspectRatio="xMidYMid slice" /></pattern>`;
        fill = `style="fill:url(#${pid})" data-ph="${pid}"`;
      }
      return `<path d="${l.path}" class="${st.on ? "on" : ""} ${st.photo ? "photo" : ""}" ${fill} ${action ? `data-action="${action}" data-v="${esc(l.id)}"` : ""}><title>${esc(label(l))}</title></path>`;
    }).join("");
    return `${defs ? `<defs>${defs}</defs>` : ""}${paths}`;
  }
  function fitPatterns(root) {
    $$("path[data-ph]", root).forEach((path) => {
      const pat = path.ownerSVGElement.getElementById(path.dataset.ph);
      if (!pat) return;
      let b;
      try { b = path.getBBox(); } catch { return; }
      if (!b.width) return;
      pat.setAttribute("x", b.x); pat.setAttribute("y", b.y);
      pat.setAttribute("width", b.width); pat.setAttribute("height", b.height);
      const img = pat.querySelector("image");
      img.setAttribute("width", b.width); img.setAttribute("height", b.height);
    });
  }

  function koreaSVG(clickable) {
    const ps = provinceState();
    const m = window.MAP_KR;
    return `<svg class="map-svg" viewBox="${m.viewBox}" role="img" aria-label="대한민국 지도">${mapShapes(m.locations, {
      info: (id) => ps[id] || {}, action: clickable ? "region" : null,
      label: (l) => `${l.name} ${ps[l.id] ? `${ps[l.id].n}/${ps[l.id].total}` : ""}`,
    })}</svg>`;
  }

  // 시·도별 시·군·구 지도는 필요할 때만 불러옴
  const scriptLoads = {};
  function loadScript(src) {
    if (!scriptLoads[src]) {
      scriptLoads[src] = new Promise((resolve, reject) => {
        const el = document.createElement("script");
        el.src = src; el.onload = resolve;
        el.onerror = () => { delete scriptLoads[src]; reject(new Error(src)); };
        document.head.appendChild(el);
      });
    }
    return scriptLoads[src];
  }
  function districtSVG(code) {
    const prov = PROV_OF_CODE[code];
    const m = window.MAP_SGG && window.MAP_SGG[prov];
    const l = m && m.locations.find((x) => x.id === code);
    if (!l) { if (prov) loadScript(`maps/sgg/${prov}.js`).then(render, () => {}); return ""; }
    const ds = districtState();
    return `<svg class="map-svg one" viewBox="${m.viewBox}" data-fit="1">${mapShapes([l], {
      info: () => ({ on: true, photo: ds.photo.get(code) }), action: null, label: (x) => x.name })}</svg>`;
  }

  // 구 하나만 그릴 때는 viewBox를 그 모양에 맞게 줄임
  function fitOne() {
    $$("svg.one[data-fit]", $("#pageBody")).forEach((svg) => {
      try {
        const b = svg.querySelector("path").getBBox();
        const pad = Math.max(b.width, b.height) * 0.06;
        svg.setAttribute("viewBox", `${b.x - pad} ${b.y - pad} ${b.width + pad * 2} ${b.height + pad * 2}`);
        fitPatterns(svg);
      } catch { /* 숨겨진 상태 */ }
    });
  }

  function regionSVG(prov) {
    const m = window.MAP_SGG && window.MAP_SGG[prov];
    if (!m) {
      loadScript(`maps/sgg/${prov}.js`).then(render, () => toast("지도를 불러오지 못했어요."));
      return `<div class="empty-hint">지도를 불러오는 중…</div>`;
    }
    const ds = districtState();
    return `<svg class="map-svg region-svg" viewBox="${m.viewBox}" role="img" aria-label="${esc(provName(prov))} 지도">${mapShapes(m.locations, {
      info: (code) => ({ on: ds.visited.has(code), photo: ds.photo.get(code) }), action: "district", label: (l) => l.name,
    })}</svg>`;
  }

  function worldSVG(clickable) {
    const m = window.MAP_WORLD;
    if (!m) { loadWorld(); return `<div class="empty-hint">지도를 불러오는 중…</div>`; }
    const on = new Set(visited("w-").map((p) => p.id.slice(2)));
    return `<svg class="map-svg" viewBox="${m.viewBox}" role="img" aria-label="세계 지도">${m.locations.map((l) =>
      `<path d="${l.path}" class="${on.has(l.id) ? "on" : ""}" ${clickable ? `data-action="place" data-id="w-${l.id}"` : ""}><title>${esc(countryName(l.id, l.name))}</title></path>`
    ).join("")}</svg>`;
  }
  let worldLoading = false;
  function loadWorld() {
    if (worldLoading) return;
    worldLoading = true;
    const s = document.createElement("script");
    s.src = "maps/world.js";
    s.onload = () => render();
    s.onerror = () => { worldLoading = false; toast("세계 지도를 불러오지 못했어요."); };
    document.head.appendChild(s);
  }
  let regionNames;
  function countryName(id, fallback) {
    try {
      regionNames = regionNames || new Intl.DisplayNames(["ko"], { type: "region" });
      return regionNames.of(id.toUpperCase()) || fallback;
    } catch { return fallback; }
  }

  function recordTiles(cats, withCount) {
    return `<div class="tiles">${cats.map((c) => {
      const items = state.records.filter((r) => r.cat === c.id);
      const ph = items.find((r) => safeImg(r.photo));
      const label = withCount ? `${c.label} ${items.length}` : `${c.label}${items.length ? ` ${items.length}` : ""}`;
      return `<div class="tile ${withCount ? "" : "left"} ${ph ? "has-photo" : ""}" ${ph ? bgStyle(ph.photo) : ""}><span>${esc(label)}</span></div>`;
    }).join("")}</div>`;
  }

  function monthExpenses(y, m) {
    const prefix = `${y}-${pad(m + 1)}`;
    return state.expenses.filter((x) => x.date.startsWith(prefix));
  }
  function payerBars(list) {
    const total = list.reduce((s, x) => s + (+x.amount || 0), 0) || 1;
    const sums = { p1: 0, p2: 0, both: 0 };
    list.forEach((x) => (sums[x.payer] = (sums[x.payer] || 0) + (+x.amount || 0)));
    const rows = [[role(), nameOf(role())], [other(), nameOf(other())], ["both", "같이"]];
    return `<div class="bars">${rows.map(([k, label]) =>
      `<div class="bar-row"><span>${esc(label)}</span><div class="bar"><i style="width:${(sums[k] / total) * 100}%"></i></div><span>${won(sums[k])}</span></div>`
    ).join("")}</div>`;
  }

  const WIDGETS = {
    dday: {
      name: "디데이", page: "anniv",
      html() {
        const n = ddayCount();
        const next = upcomingAnniv(1)[0];
        const left = next ? diffDays(today(), next.date) : null;
        return `<div class="w-title"><span><span class="em">📅</span>디데이</span></div>
          <div class="dday-big">${n >= 0 ? `D+${n}` : `D${n}`}</div>
          <div class="dday-sub">${esc(nameOf(role()))} ♥ ${esc(nameOf(other()))}${next ? ` · ${next.label}까지 ${left === 0 ? "오늘!" : `D-${left}`}` : ""}</div>`;
      },
    },
    calendar: {
      name: "캘린더", page: "calendar", cls: "w-calendar",
      html() {
        const t = today();
        const ph = state.photos.find((p) => safeImg(p.src));
        const bg = ph ? ph.src : local.bg;
        const y = t.getFullYear(), m = t.getMonth();
        const first = new Date(y, m, 1).getDay();
        const days = new Date(y, m + 1, 0).getDate();
        const special = specialDays();
        const ev = new Set(state.events.map((x) => x.date));
        let cells = WD.map((w, i) => `<span class="${i === 0 ? "sun" : i === 6 ? "sat" : ""}">${w}</span>`).join("");
        cells += "<span></span>".repeat(first);
        for (let d = 1; d <= days; d++) {
          const k = ymd(new Date(y, m, d)); const wd = (first + d - 1) % 7;
          const cls = [wd === 0 && "sun", wd === 6 && "sat", d === t.getDate() && "today", (ev.has(k) || special.has(k)) && "heart"].filter(Boolean).join(" ");
          cells += `<span class="${cls}" data-action="cal-open" data-v="${k}">${d}</span>`;
        }
        return `<div class="today-photo" ${bgStyle(bg)}><div class="wd">${WD[t.getDay()]}요일</div><div class="d">${t.getDate()}</div></div>
          <div class="mini-cal"><div class="m">${m + 1}월</div><div class="g">${cells}</div></div>`;
      },
    },
    diary: {
      name: "커플 일기장", page: "diary",
      html() {
        const items = state.diary.slice(0, 2);
        return `<div class="w-title"><span><span class="em">✍️</span>커플 일기장</span></div>
          ${items.length ? items.map(diaryItemHTML).join("") : `<div class="empty-hint">오늘 있었던 일을 함께 기록해보세요.</div>`}
          <button class="btn w-btn" data-action="diary-new">오늘 일기 쓰기</button>`;
      },
    },
    mood: {
      name: "오늘의 기분", page: null,
      html() {
        const mood = state.moods[ymd(today())] || {};
        const col = (who, mine) => `<div class="mood-col"><div class="muted small">${esc(nameOf(who))}</div>
          <div class="mood-pick">${MOODS.map((m) => `<button type="button" data-action="${mine ? "mood" : "mood-other"}" data-v="${m}" class="${mood[who] === m ? "on" : ""}">${m}</button>`).join("")}</div></div>`;
        return `<div class="w-title"><span><span class="em">💗</span>오늘의 기분</span></div>
          <div class="mood-row">${col(role(), true)}${col(other(), false)}</div>`;
      },
    },
    anniv: {
      name: "기념일", page: "anniv",
      html() {
        return `<div class="w-title"><span><span class="em">🎉</span>기념일</span></div>
          <ul class="list">${upcomingAnniv(3).map((a) => {
            const left = diffDays(today(), a.date);
            return `<li><span class="grow"><strong>${a.label}</strong> <span class="muted small">${fmt(a.date)}</span></span><span class="tag">${left === 0 ? "오늘" : `D-${left}`}</span></li>`;
          }).join("")}</ul>`;
      },
    },
    culture: {
      name: "문화 기록장", page: "culture",
      html: () => `<div class="w-title"><span><span class="em">📜</span>문화 기록장</span></div>${recordTiles(CULTURE, true)}`,
    },
    food: {
      name: "맛집 기록장", page: "food",
      html: () => `<div class="w-title"><span><span class="em">🍜</span>맛집 기록장</span></div>${recordTiles(FOOD, false)}`,
    },
    korea: {
      name: "데이트 지도", page: "korea", cls: "w-korea",
      html() {
        const n = districtState().visited.size;
        const pct = SGG_TOTAL ? Math.round((n / SGG_TOTAL) * 1000) / 10 : 0;
        return `<div class="w-title"><span><span class="em">🗺️</span>데이트 지도</span><span class="side">전국 ${pct}%</span></div>${koreaSVG(false)}`;
      },
    },
    world: {
      name: "세계 지도", page: "world",
      html() {
        return `<div class="w-title"><span><span class="em">🌏</span>세계 지도</span><span class="side">${visited("w-").length}개국</span></div>${worldSVG(false)}`;
      },
    },
    album: {
      name: "공유 앨범", page: "album",
      html() {
        const mine = latestPhotoBy(role()), theirs = latestPhotoBy(other());
        const slot = (p, empty, who) => {
          const act = who === role() ? 'data-action="photo-add"' : "";
          return p
            ? `<div class="slot has-photo" ${act} ${bgStyle(p.src)}><span class="who">${esc(nameOf(who))}</span></div>`
            : `<div class="slot" ${act}>${empty}</div>`;
        };
        return `<div class="w-title"><span><span class="em">📸</span>공유 앨범</span></div>
          <div class="duo">${slot(mine, "눌러서 사진을 올려보세요!", role())}${slot(theirs, "상대방 사진은 아직이에요", other())}</div>
          <button class="btn w-btn" data-action="photo-take">사진 찍기</button>`;
      },
    },
    budget: {
      name: "데이트 가계부", page: "budget",
      html() {
        const t = today();
        const list = monthExpenses(t.getFullYear(), t.getMonth());
        const total = list.reduce((s, x) => s + (+x.amount || 0), 0);
        return `<div class="w-title"><span><span class="em">💰</span>데이트 가계부</span><span class="side">${t.getMonth() + 1}월</span></div>
          <div class="money">${won(total)}</div>${list.length ? payerBars(list) : `<div class="empty-hint">이번 달 데이트 비용을 기록해보세요.</div>`}`;
      },
    },
    bucket: {
      name: "버킷리스트", page: "bucket",
      html() {
        const total = state.bucket.length, done = state.bucket.filter((x) => x.done).length;
        const next = state.bucket.filter((x) => !x.done).slice(0, 3);
        return `<div class="w-title"><span><span class="em">✅</span>버킷리스트</span><span class="side">${done}/${total}</span></div>
          <div class="progress"><div style="width:${total ? (done / total) * 100 : 0}%"></div></div>
          ${next.length ? `<ul class="list">${next.map((x) => `<li><span class="grow">${esc(x.title)}</span></li>`).join("")}</ul>` : `<div class="empty-hint">함께 하고 싶은 일을 적어보세요.</div>`}`;
      },
    },
  };

  function widgetHTML(key, opts = {}) {
    const w = WIDGETS[key];
    if (!w) return "";
    const tone = opts.preview ? "" : `data-tone="${toneCache[key] || (local.glass.tone === "dark" ? "dark" : "light")}"`;
    return `<section class="widget glass ${w.cls || ""}" ${!opts.preview && w.page ? `data-open="${w.page}"` : ""} data-w="${key}" ${tone}>${w.html()}</section>`;
  }

  function diaryItemHTML(d) {
    const dt = parse(d.date);
    return `<div class="diary-item">
      <div class="thumb" ${bgStyle(d.photo)}>${safeImg(d.photo) ? "" : "📝"}</div>
      <div style="min-width:0">
        <div class="diary-meta"><span class="who-${d.by === "p2" ? "p2" : "p1"}">${esc(nameOf(d.by))}</span> · ${fmtLong(dt)}</div>
        <div class="diary-title">${esc(d.title)}</div>
        <div class="clamp">${esc(d.body)}</div>
      </div>
    </div>`;
  }

  function renderHome() {
    const invite = shared() && session.artifact && memberCount < 2
      ? `<section class="widget glass" data-open="settings" style="text-align:center">
          <div style="font-weight:800;font-size:17px">💌 ${esc(nameOf(other()))}님을 초대해주세요</div>
          <div class="muted small" style="margin-top:6px">공유 → 이메일로 <b>편집자</b> 초대 → 상대가 이 링크를 열면 끝! (눌러서 자세히)</div></section>`
      : shared() && memberCount < 2 && session.code
      ? `<section class="widget glass" data-open="settings" style="text-align:center">
          <div class="muted small">${esc(nameOf(other()))}님을 초대해주세요</div>
          <button class="btn kakao" data-action="share-invite" style="margin:10px 0 6px">💬 카카오톡으로 초대 링크 보내기</button>
          <div class="muted small">또는 초대 코드 <b class="code-inline">${esc(session.code)}</b> <button class="link" data-action="copy-code">복사</button></div></section>`
      : "";
    $("#widgets").innerHTML = invite + (local.widgets.map((k) => widgetHTML(k)).join("")
      || `<div class="widget glass" data-action="gallery"><div class="empty-hint">홈 화면이 비어 있어요. ＋를 눌러 블럭을 추가해보세요.</div></div>`);
    $("#bellDot").classList.toggle("hidden", !notifications().some((n) => n.at > local.lastSeen));
    fitPatterns($("#widgets"));
    updateTones();
  }

  function applyBg() {
    const bg = $("#bg");
    const src = safeImg(local.bg);
    bg.style.backgroundImage = src ? `url('${src}')` : "";
    bg.classList.toggle("photo", !!src);
    // 블럭 화면 바탕(블러)에도 같은 사진 사용
    document.documentElement.style.setProperty("--bg-image", src ? `url("${src}")` : "none");
    document.documentElement.classList.toggle("has-bg", !!src);
    applyGlass();
  }
  // 블럭 반투명 정도와 블러 세기 (기기별)
  function applyGlass() {
    const a = Math.min(0.85, Math.max(0.05, +local.glass.alpha || 0.32));
    const b = Math.min(40, Math.max(0, +local.glass.blur || 0));
    const root = document.documentElement.style;
    root.setProperty("--glass-alpha", a);
    root.setProperty("--glass-border", Math.min(0.7, a + 0.15));
    root.setProperty("--glass-blur", `${b}px`);
    buildLumGrid();
  }

  // ---- 블럭 색 자동: 블럭 뒤에 있는 배경 부분의 밝기를 보고 밝은/어두운 유리를 고름 ----
  const GRID_W = 24, GRID_H = 48;
  let lumGrid = null; // 화면 크기에 맞춰 잘린(cover) 배경의 밝기 격자
  let lumImg = null;
  function buildLumGrid() {
    const src = safeImg(local.bg);
    if (!src) { lumGrid = null; lumImg = null; document.documentElement.style.backgroundColor = ""; updateTones(); return; }
    const draw = (img) => {
      const c = document.createElement("canvas"); c.width = GRID_W; c.height = GRID_H;
      const g = c.getContext("2d");
      // background-size: cover 와 같은 방식으로 자르기
      const vw = innerWidth, vh = innerHeight;
      const sc = Math.max(vw / img.width, vh / img.height);
      const sw = vw / sc, sh = vh / sc;
      g.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, GRID_W, GRID_H);
      const d = g.getImageData(0, 0, GRID_W, GRID_H).data;
      lumGrid = new Float32Array(GRID_W * GRID_H);
      for (let i = 0; i < lumGrid.length; i++) lumGrid[i] = (0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2]) / 255;
      // 화면 맨 아래(사파리 주소창 뒤)가 사진 아래쪽과 같은 색이 되도록
      let r = 0, g2 = 0, b = 0, n = 0;
      for (let y = GRID_H - 3; y < GRID_H; y++) for (let x = 0; x < GRID_W; x++) { const k = (y * GRID_W + x) * 4; r += d[k]; g2 += d[k + 1]; b += d[k + 2]; n++; }
      document.documentElement.style.backgroundColor = `rgb(${Math.round(r / n)}, ${Math.round(g2 / n)}, ${Math.round(b / n)})`;
      updateTones();
    };
    if (lumImg && lumImg.src === src && lumImg.complete) return draw(lumImg);
    lumImg = new Image();
    lumImg.onload = () => draw(lumImg);
    lumImg.src = src;
  }
  function lumAt(rect) {
    if (!lumGrid) return 1;
    const x0 = Math.max(0, Math.floor((rect.left / innerWidth) * GRID_W)), x1 = Math.min(GRID_W, Math.ceil((rect.right / innerWidth) * GRID_W));
    const y0 = Math.max(0, Math.floor((rect.top / innerHeight) * GRID_H)), y1 = Math.min(GRID_H, Math.ceil((rect.bottom / innerHeight) * GRID_H));
    let sum = 0, n = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { sum += lumGrid[y * GRID_W + x]; n++; }
    return n ? sum / n : null;
  }
  function toneFor(el) {
    if (local.glass.tone !== "auto") return local.glass.tone;
    if (!lumGrid) return "light";
    const l = lumAt(el.getBoundingClientRect());
    if (l == null) return el.dataset.tone || "light"; // 화면 밖이면 그대로
    // 경계에서 깜빡이지 않도록 약간의 여유
    const cur = el.dataset.tone;
    if (cur === "dark") return l > 0.56 ? "light" : "dark";
    if (cur === "light") return l < 0.48 ? "dark" : "light";
    return l < 0.52 ? "dark" : "light";
  }
  const toneCache = {}; // 다시 그릴 때 깜빡이지 않도록 블럭별 마지막 색을 기억
  function updateTones() {
    $$("#widgets .glass").forEach((el) => {
      el.dataset.tone = toneFor(el);
      if (el.dataset.w) toneCache[el.dataset.w] = el.dataset.tone;
    });
    // 설정의 미리보기 카드는 전체 사진 밝기 기준
    const overall = local.glass.tone !== "auto" ? local.glass.tone
      : (safeImg(local.bg) && local.bgLum != null && local.bgLum < 0.5 ? "dark" : "light");
    $$(".bg-preview-card").forEach((el) => { el.dataset.tone = overall; });
    $("#page").dataset.tone = overall;
  }
  let toneRaf = 0;
  const scheduleTones = () => { if (!toneRaf) toneRaf = requestAnimationFrame(() => { toneRaf = 0; updateTones(); }); };
  window.addEventListener("scroll", scheduleTones, { passive: true });
  window.addEventListener("resize", () => buildLumGrid());
  // 사진의 평균 밝기 (0~1)
  function imageLuminance(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas"); c.width = 24; c.height = 48;
        const g = c.getContext("2d"); g.drawImage(img, 0, 0, 24, 48);
        const d = g.getImageData(0, 0, 24, 48).data;
        let sum = 0;
        for (let i = 0; i < d.length; i += 4) sum += (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
        resolve(sum / (d.length / 4));
      };
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }
  function bgPreviewHTML() {
    return `<div class="bg-preview ${safeImg(local.bg) ? "" : "default"}" ${bgStyle(local.bg)} data-action="bg-change" role="button" aria-label="배경화면 바꾸기">
      <div class="glass bg-preview-card"><strong>D+${ddayCount()}</strong><span>${esc(nameOf(role()))} ♥ ${esc(nameOf(other()))}</span></div>
      <div class="glass bg-preview-card small"></div>
    </div>`;
  }

  // =========================================================
  // 페이지 (전체 화면)
  // =========================================================
  const pageStack = [];
  const ui = { calMonth: null, selDate: null, recCat: {}, budgetMonth: null };

  function openPage(key, arg) {
    pageStack.push({ key, arg });
    renderPage(true);
  }
  function back() {
    pageStack.pop();
    renderPage(true);
  }
  function closeAllPages() {
    pageStack.length = 0;
    renderPage(true);
  }
  $("#pageBack").addEventListener("click", back);

  function renderPage(scrollTop) {
    const top = pageStack[pageStack.length - 1];
    $("#page").classList.toggle("hidden", !top);
    if (!top) { $("#pageBody").innerHTML = ""; return; }
    const p = PAGES[top.key];
    // 설정 페이지에서 입력 중이면 덮어쓰지 않음
    if (!scrollTop && top.key === "settings" && $("#pageBody").contains(document.activeElement) && document.activeElement.tagName === "INPUT") return;
    $("#pageTitle").textContent = typeof p.title === "function" ? p.title(top.arg) : p.title;
    $("#pageAction").innerHTML = p.action ? p.action(top.arg) : "";
    const scroll = $("#pageBody").scrollTop;
    $("#pageBody").innerHTML = p.html(top.arg);
    $("#pageBody").scrollTop = scrollTop ? 0 : scroll;
    fitPatterns($("#pageBody"));
    fitOne();
    updateTones();
  }

  const addBtn = (action, label = "＋ 추가", extra = "") => `<button class="add-btn" data-action="${action}" ${extra}>${label}</button>`;

  const PAGES = {
    // ---- 블럭 추가 (＋) ----
    gallery: {
      title: "블럭 추가",
      html() {
        return `<div class="card bg-quick" data-action="bg-change" data-close="1" role="button">
            <div class="bg-thumb ${safeImg(local.bg) ? "" : "default"}" ${bgStyle(local.bg)}></div>
            <div class="grow"><strong>홈 배경화면</strong><div class="muted small">눌러서 내 사진으로 바꾸기</div></div>
            <span class="pill">바꾸기</span>
          </div>
          <p class="muted small" style="margin:0 4px 14px">블럭을 누르면 홈 화면에 추가되고 바로 열려요.</p>
          ${Object.keys(WIDGETS).sort((x, y) => local.widgets.includes(x) - local.widgets.includes(y)).map((k) => {
            const added = local.widgets.includes(k);
            return `<div class="gallery-item" data-action="w-add" data-k="${k}">
              <div class="preview">${widgetHTML(k, { preview: true })}</div>
              <div class="label">${WIDGETS[k].name}${added ? ` <span class="pill">홈에 있음 · 열기</span>` : ""}</div></div>`;
          }).join("")}`;
      },
    },

    // ---- 알림 ----
    notifications: {
      title: "알림",
      html() {
        const list = notifications();
        return `<div class="card"><ul class="list">${list.length ? list.map((n) => `<li class="notice">
            <div class="thumb" ${bgStyle(n.photo)}>${safeImg(n.photo) ? "" : n.em}</div>
            <span class="grow">${esc(n.text)}<div class="muted small">${timeAgo(n.at)}</div></span></li>`).join("")
          : `<li class="empty">아직 새 소식이 없어요</li>`}</ul></div>`;
      },
    },

    // ---- 기념일 ----
    anniv: {
      title: "디데이 · 기념일",
      html() {
        const n = ddayCount(), p = state.profile;
        const days = Math.max(0, diffDays(parse(p.start), today()));
        return `<div class="card" style="text-align:center">
            <div class="muted">${esc(nameOf(role()))} ♥ ${esc(nameOf(other()))}</div>
            <div class="dday-big" style="margin:6px 0">${n >= 0 ? `D+${n}` : `D${n}`}</div>
            <div class="muted small">${fmt(parse(p.start))}부터 · ${Math.floor(days / 7).toLocaleString()}주 · 약 ${(days * 24).toLocaleString()}시간</div>
          </div>
          <div class="card"><h3>다가오는 기념일</h3><ul class="list">${upcomingAnniv(12).map((a) => {
            const left = diffDays(today(), a.date);
            return `<li><span class="grow"><strong>${a.label}</strong> <span class="muted small">${fmtW(a.date)}</span></span><span class="tag">${left === 0 ? "오늘" : `D-${left}`}</span></li>`;
          }).join("")}</ul></div>`;
      },
    },

    // ---- 커플 캘린더 ----
    calendar: {
      title: "",
      action: () => `<button class="round-glass" data-action="cal-search" aria-label="일정 검색">${ICON.search}</button>`,
      html() {
        const cm = ui.calMonth || (ui.calMonth = new Date(today().getFullYear(), today().getMonth(), 1));
        const sel = ui.selDate || (ui.selDate = ymd(today()));
        const who = ui.calWho || (ui.calWho = { p1: true, p2: true, both: true });
        const showPhotos = local.calPhotos !== false;
        const y = cm.getFullYear(), m = cm.getMonth();
        const first = new Date(y, m, 1);
        const startD = addDays(first, -first.getDay());
        const weeks = Math.ceil((first.getDay() + new Date(y, m + 1, 0).getDate()) / 7);
        const t = ymd(today());
        const special = specialDays();

        // 날짜별로 묶기
        const evBy = {};
        for (const e of state.events) if (who[ownerOf(e)]) (evBy[e.date] = evBy[e.date] || []).push(e);
        for (const k in evBy) evBy[k].sort((a, b) => (a.time || "").localeCompare(b.time || ""));
        const phBy = photosByDate();

        let cells = "";
        for (let i = 0; i < weeks * 7; i++) {
          const d = addDays(startD, i); const k = ymd(d);
          const evs = evBy[k] || [];
          const ph = showPhotos && phBy[k] && phBy[k][0];
          const cls = ["c2", d.getMonth() !== m && "other", k === t && "today", k === sel && "sel",
            d.getDay() === 0 && "sun", d.getDay() === 6 && "sat"].filter(Boolean).join(" ");
          let body = "";
          if (special.has(k)) body += `<span class="ev anniv">♥ ${esc(special.get(k))}</span>`;
          if (ph) body += `<span class="c2-photo" ${bgStyle(ph.src)}>${evs.length ? `<i class="c2-dot ${ownerOf(evs[0])}"></i>` : ""}</span>`;
          else {
            const max = special.has(k) ? 1 : 2;
            body += evs.slice(0, max).map((e) => `<span class="ev ${ownerOf(e)}">${esc(e.title)}</span>`).join("");
            if (evs.length > max) body += `<span class="ev more">+${evs.length - max}</span>`;
          }
          cells += `<button type="button" class="${cls}" data-action="cal-sel" data-v="${k}"><span class="c2-num">${d.getDate()}</span>${body}</button>`;
        }

        // 선택한 날
        const selEvents = state.events.filter((e) => e.date === sel).sort((a, b) => (a.time || "").localeCompare(b.time || ""));
        const selPhotos = phBy[sel] || [];
        const selDiary = state.diary.filter((x) => x.date === sel);
        const ownerLabel = (o) => (o === "both" ? "우리" : nameOf(o));
        const list = [
          ...(special.has(sel) ? [`<div class="day-item anniv"><span class="pill2 anniv">기념일</span><span class="grow">♥ ${esc(special.get(sel))}</span></div>`] : []),
          ...selEvents.map((e) => `<button class="day-item" data-action="event-edit" data-id="${esc(e.id)}">
              <span class="pill2 ${ownerOf(e)}">${esc(ownerLabel(ownerOf(e)))}</span>
              <span class="grow"><b>${esc(e.title)}</b>${e.memo ? `<span class="muted small"> · ${esc(e.memo)}</span>` : ""}</span>
              ${e.time ? `<span class="muted small">${esc(e.time)}</span>` : ""}</button>`),
          ...selDiary.map((x) => `<button class="day-item" data-action="open" data-page="diary"><span class="pill2 diary">일기</span><span class="grow">✍️ ${esc(x.title)}</span></button>`),
        ];

        const search = ui.calSearch ? (() => {
          const q = ui.calSearch.toLowerCase();
          const hits = state.events.filter((e) => (e.title + " " + (e.memo || "")).toLowerCase().includes(q)).sort((a, b) => b.date.localeCompare(a.date));
          return `<div class="card"><div class="w-title" style="margin-bottom:8px"><span style="font-size:16px">🔍 "${esc(ui.calSearch)}"</span><button class="link" data-action="cal-search-clear">닫기</button></div>
            ${hits.length ? hits.slice(0, 30).map((e) => `<button class="day-item" data-action="cal-goto" data-v="${esc(e.date)}">
              <span class="pill2 ${ownerOf(e)}">${esc(ownerLabel(ownerOf(e)))}</span><span class="grow">${esc(e.title)}</span><span class="muted small">${fmt(parse(e.date))}</span></button>`).join("")
              : `<div class="empty-hint">찾는 일정이 없어요</div>`}</div>`;
        })() : "";

        return `${search}
          <h2 class="cal2-title">🗓️ 커플 캘린더</h2>
          <div class="cal2-bar">
            <button class="cal2-month" data-action="cal-month">${y}년 ${m + 1}월 <span aria-hidden="true">⌄</span></button>
            <label class="toggle"><span>사진</span><input type="checkbox" id="calPhotoToggle" ${showPhotos ? "checked" : ""} /><i></i></label>
          </div>
          <div class="cal2-who">
            ${[["p1", nameOf("p1")], ["p2", nameOf("p2")], ["both", "우리"]].map(([k, l]) =>
              `<button class="who-chip ${k} ${who[k] ? "on" : ""}" data-action="cal-who" data-v="${k}" aria-pressed="${who[k]}">${esc(l)}</button>`).join("")}
          </div>
          <div class="cal2 card" id="cal2">
            <div class="c2-week">${WD.map((w, i) => `<span class="${i === 0 ? "sun" : i === 6 ? "sat" : ""}">${w}</span>`).join("")}</div>
            <div class="c2-grid">${cells}</div>
          </div>
          <div class="day-head">
            <h3>${fmtLong(parse(sel))}</h3>
            <div class="day-btns">
              <button class="round-plus" data-action="cal-photo-add" aria-label="이 날 사진 추가">${ICON.camera}</button>
              <button class="round-plus" data-action="event-new" aria-label="이 날 일정 추가">${ICON.plus}</button>
            </div>
          </div>
          ${list.length ? `<div class="card day-list">${list.join("")}</div>` : `<p class="muted day-empty">이 날 일정이 없어요</p>`}
          ${selPhotos.length ? `<div class="photo-grid day-photos">${selPhotos.map((p) =>
            `<img src="${p.src}" data-action="view-photo" data-id="${esc(p.id)}" alt="${fmtW(parse(sel))} 사진" loading="lazy" />`).join("")}</div>` : ""}`;
      },
    },

    // ---- 일기 ----
    diary: {
      title: "커플 일기장",
      action: () => addBtn("diary-new", "＋ 쓰기"),
      html() {
        if (!state.diary.length) return `<div class="card empty-card"><div class="empty-hint">아직 일기가 없어요. 오늘 있었던 일을 남겨보세요!</div><button class="btn primary full" data-action="diary-new">✍️ 첫 일기 쓰기</button></div>`;
        return state.diary.map((d) => `<div class="card">
          ${safeImg(d.photo) ? `<img src="${d.photo}" alt="" style="width:100%;border-radius:18px;margin-bottom:12px;display:block" />` : ""}
          <div class="diary-meta"><span class="who-${d.by === "p2" ? "p2" : "p1"}">${esc(nameOf(d.by))}</span> · ${fmtLong(parse(d.date))}</div>
          <div class="diary-title" style="font-size:18px;margin:6px 0 8px">${esc(d.title)}</div>
          <div style="white-space:pre-wrap;line-height:1.7;overflow-wrap:anywhere">${esc(d.body)}</div>
          ${d.by === role() ? `<div class="rec-actions"><button class="link" data-action="diary-edit" data-id="${esc(d.id)}">수정</button><button class="link" data-action="del" data-coll="diary" data-id="${esc(d.id)}" data-confirm="이 일기를 지울까요?">삭제</button></div>` : ""}
        </div>`).join("");
      },
    },

    // ---- 문화/맛집 기록장 ----
    culture: { title: "문화 기록장", action: () => addBtn("rec-new", "＋ 기록", 'data-group="culture"'), html: () => recordsPage("culture", CULTURE) },
    food: { title: "맛집 기록장", action: () => addBtn("rec-new", "＋ 기록", 'data-group="food"'), html: () => recordsPage("food", FOOD) },

    // ---- 데이트 지도 ----
    korea: {
      title: "데이트 지도",
      html() {
        const ps = provinceState();
        const n = districtState().visited.size;
        const pct = SGG_TOTAL ? Math.round((n / SGG_TOTAL) * 1000) / 10 : 0;
        return `<div class="card"><div class="w-title"><span>전국 ${pct}% 정복</span><span class="side">${n}/${SGG_TOTAL}곳</span></div>
            ${koreaSVG(true)}
            <p class="muted small">시·도를 누르면 시·군·구 지도가 열려요. 가본 곳에 사진을 넣어보세요.</p>
            <div class="region-chips">${window.MAP_KR.locations.slice().sort((a, b) => (ps[b.id]?.n || 0) - (ps[a.id]?.n || 0)).map((l) =>
              `<button class="chip ${ps[l.id]?.on ? "on" : ""}" data-action="region" data-v="${l.id}">${l.name}${ps[l.id]?.n ? ` ${ps[l.id].n}` : ""}</button>`).join("")}</div></div>`;
      },
    },

    // ---- 시·도 안의 시·군·구 ----
    region: {
      title: (prov) => provName(prov),
      html(prov) {
        const ds = districtState();
        const list = SGG[prov] || [];
        const n = list.filter(([c]) => ds.visited.has(c)).length;
        const legacy = state.places.some((p) => p.id === `kr-${prov}`);
        return `<div class="card"><div class="w-title"><span>${esc(provName(prov))}</span><span class="side">${n}/${list.length}곳</span></div>
            ${regionSVG(prov)}
            <p class="muted small">구·군을 누르면 사진을 넣고 가본 곳으로 표시할 수 있어요.</p>
            <div class="region-chips">${list.map(([c, name]) =>
              `<button class="chip ${ds.visited.has(c) ? "on" : ""}" data-action="district" data-v="${c}">${ds.photo.has(c) ? "📷 " : ""}${esc(name)}</button>`).join("")}</div>
            ${legacy ? `<button class="link" style="margin-top:10px" data-action="place" data-id="kr-${prov}">이전 방식의 '${esc(provName(prov))} 전체' 표시 지우기</button>` : ""}
          </div>`;
      },
    },

    // ---- 시·군·구 하나: 가본 곳 표시 + 사진 ----
    district: {
      title: (code) => sggName(code),
      action: (code) => addBtn("place-photo", "＋ 사진", `data-v="${esc(code)}"`),
      html(code) {
        const ds = districtState();
        const pics = state.photos.filter((p) => p.place === `d-${code}` && safeImg(p.src));
        return `<div class="card district-head">
            <div class="district-shape">${districtSVG(code)}</div>
            <div class="stack" style="gap:8px">
              <div class="muted small">${esc(provName(PROV_OF_CODE[code]))}</div>
              <button class="btn ${ds.visited.has(code) ? "primary" : ""}" data-action="place" data-id="d-${code}" ${pics.length ? "disabled" : ""}>
                ${ds.visited.has(code) ? "♥ 가본 곳" : "가본 곳으로 표시"}</button>
              ${pics.length ? `<div class="muted small">사진이 있는 곳은 가본 곳으로 표시돼요.</div>` : ""}
            </div></div>
          ${pics.length
            ? `<div class="photo-grid">${pics.map((p) => `<img src="${p.src}" data-action="view-photo" data-id="${esc(p.id)}" alt="${esc(sggName(code))} 사진" loading="lazy" />`).join("")}</div>`
            : `<div class="card empty-card"><div class="empty-hint">아직 사진이 없어요. 이곳에서의 추억을 넣어보세요.</div>
                <button class="btn primary full" data-action="place-photo" data-v="${esc(code)}">📷 사진 넣기</button></div>`}`;
      },
    },

    // ---- 세계 지도 ----
    world: {
      title: "세계 지도",
      html() {
        const vis = visited("w-");
        const m = window.MAP_WORLD;
        const opts = m ? m.locations.map((l) => ({ id: l.id, name: countryName(l.id, l.name) }))
          .filter((l) => !vis.some((v) => v.id === `w-${l.id}`))
          .sort((a, b) => a.name.localeCompare(b.name, "ko")) : [];
        return `<div class="card"><div class="w-title"><span>함께 간 나라</span><span class="side">${vis.length}개국</span></div>
            ${worldSVG(true)}
            ${m ? `<div style="display:flex;gap:8px;margin-top:14px"><select id="countrySel">${opts.map((o) => `<option value="${o.id}">${esc(o.name)}</option>`).join("")}</select>
              <button class="btn primary" data-action="country-add">추가</button></div>` : ""}
            <div class="region-chips">${vis.map((v) => `<button class="chip on" data-action="place" data-id="${esc(v.id)}">${esc(countryName(v.id.slice(2), v.id))} ✕</button>`).join("")}</div></div>`;
      },
    },

    // ---- 앨범 ----
    album: {
      title: "공유 앨범",
      html() {
        const pics = state.photos.filter((p) => safeImg(p.src));
        return `<div class="card">${WIDGETS.album.html().replace(/<div class="w-title">[\s\S]*?<\/div>/, "")}
            <button class="btn full" style="margin-top:8px" data-action="photo-add">앨범에서 여러 장 올리기</button>
            <p class="muted small">사진은 압축해서 저장돼요.</p></div>
          <div class="photo-grid">${pics.map((p) => `<img src="${p.src}" data-action="view-photo" data-id="${esc(p.id)}" alt="사진" loading="lazy" />`).join("")}</div>`;
      },
    },

    // ---- 가계부 ----
    budget: {
      title: "데이트 가계부",
      action: () => addBtn("exp-new", "＋ 지출"),
      html() {
        const bm = ui.budgetMonth || (ui.budgetMonth = new Date(today().getFullYear(), today().getMonth(), 1));
        const list = monthExpenses(bm.getFullYear(), bm.getMonth());
        const total = list.reduce((s, x) => s + (+x.amount || 0), 0);
        const byCat = {};
        list.forEach((x) => (byCat[x.cat] = (byCat[x.cat] || 0) + (+x.amount || 0)));
        const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
        return `<div class="card">
            <div class="cal-head"><button data-action="bm-move" data-v="-1" aria-label="이전 달">${ICON.back}</button><strong>${bm.getFullYear()}년 ${bm.getMonth() + 1}월</strong><button data-action="bm-move" data-v="1" aria-label="다음 달">${ICON.next}</button></div>
            <div class="money" style="text-align:center">${won(total)}</div>
            ${list.length ? payerBars(list) : ""}
          </div>
          ${cats.length ? `<div class="card"><h3>카테고리별</h3><div class="bars">${cats.map(([c, v]) =>
            `<div class="bar-row"><span>${esc(c)}</span><div class="bar"><i style="width:${(v / total) * 100}%"></i></div><span>${won(v)}</span></div>`).join("")}</div></div>` : ""}
          <div class="card"><h3>내역</h3><ul class="list">${list.map((x) => `<li data-action="exp-edit" data-id="${esc(x.id)}" style="cursor:pointer">
              <span class="grow">${esc(x.title)}<div class="muted small">${fmtW(parse(x.date))} · ${esc(x.cat)} · ${x.payer === "both" ? "같이" : esc(nameOf(x.payer))}</div></span>
              <strong>${won(x.amount)}</strong></li>`).join("") || `<li class="empty" style="flex-direction:column"><span>이 달의 지출이 없어요</span><button class="btn primary full" data-action="exp-new">💰 지출 기록하기</button></li>`}</ul></div>`;
      },
    },

    // ---- 버킷리스트 ----
    bucket: {
      title: "버킷리스트",
      action: () => addBtn("bucket-new"),
      html() {
        const total = state.bucket.length, done = state.bucket.filter((x) => x.done).length;
        const sorted = [...state.bucket].sort((a, b) => a.done - b.done);
        return `<div class="card"><div class="w-title"><span>함께 이룬 꿈</span><span class="side">${done}/${total}</span></div>
          <div class="progress"><div style="width:${total ? (done / total) * 100 : 0}%"></div></div>
          <ul class="list checklist">${sorted.map((x) => `<li class="${x.done ? "done" : ""}">
            <input type="checkbox" data-action="bucket-toggle" data-id="${esc(x.id)}" ${x.done ? "checked" : ""} aria-label="완료" />
            <span class="grow">${esc(x.title)}</span>
            <button class="del" data-action="del" data-coll="bucket" data-id="${esc(x.id)}" aria-label="삭제">✕</button></li>`).join("")
            || `<li class="empty">함께 하고 싶은 일을 적어보세요</li>`}</ul></div>`;
      },
    },

    // ---- 설정 ----
    settings: {
      title: "설정",
      html() {
        const p = state.profile, on = shared(), waiting = on && memberCount < 2;
        const mine = local.widgets;
        return `<div class="card stack" id="bgCard"><h3 style="margin:0">홈 배경화면</h3>
            ${bgPreviewHTML()}
            <div class="bg-btns">
              <button class="btn primary" data-action="bg-change">🖼️ 배경화면 바꾸기</button>
              ${local.bg ? `<button class="btn" data-action="bg-reset">기본 배경</button>` : ""}
            </div>
            <div><div class="field-label">블럭 색</div>
              <div class="seg" style="margin:6px 0 0">${[["auto", "자동"], ["light", "밝게"], ["dark", "어둡게"]].map(([v, l]) =>
                `<button type="button" class="${local.glass.tone === v ? "on" : ""}" data-action="glass-tone" data-v="${v}">${l}</button>`).join("")}</div></div>
            <label for="glassAlpha">블럭 투명도 <span class="muted" id="glassAlphaVal">${Math.round((1 - local.glass.alpha) * 100)}%</span>
              <input type="range" id="glassAlpha" min="15" max="95" step="1" value="${Math.round((1 - local.glass.alpha) * 100)}" class="range" /></label>
            <label for="glassBlur">블러 세기 <span class="muted" id="glassBlurVal">${local.glass.blur}</span>
              <input type="range" id="glassBlur" min="0" max="40" step="1" value="${local.glass.blur}" class="range" /></label>
            <p class="muted small" style="margin:0">배경화면과 블럭 설정은 이 기기에만 적용돼요.</p>
          </div>
          <div class="card"><h3>홈 블럭</h3>
            <p class="muted small" style="margin:-4px 0 6px">홈 화면에서 블럭을 꾹 누르면 끌어서 순서를 바꿀 수 있어요.</p>
            <ul class="list my-widgets">${mine.map((k, i) => `<li><span class="grow">${WIDGETS[k].name}</span>
              <button class="icon-sq" data-action="w-up" data-k="${k}" ${i === 0 ? "disabled" : ""} aria-label="${WIDGETS[k].name} 위로">${ICON.up}</button>
              <button class="icon-sq" data-action="w-down" data-k="${k}" ${i === mine.length - 1 ? "disabled" : ""} aria-label="${WIDGETS[k].name} 아래로">${ICON.down}</button>
              <button class="icon-sq" data-action="w-remove" data-k="${k}" aria-label="${WIDGETS[k].name} 빼기">${ICON.close}</button></li>`).join("") || `<li class="empty">홈 화면에 블럭이 없어요</li>`}</ul>
            ${mine.length < Object.keys(WIDGETS).length ? `<button class="btn primary full" style="margin-top:10px" data-action="gallery">＋ 블럭 추가하기</button>` : ""}
          </div>
          <div class="card"><h3>나는 누구인가요?</h3>
            <p class="muted small" style="margin:-4px 0 10px">이 기기를 쓰는 사람을 골라주세요. 잘못 되어 있으면 여기서 바꿀 수 있어요.</p>
            <div class="seg" style="margin:0">${["p1", "p2"].map((r) =>
              `<button type="button" class="${role() === r ? "on" : ""}" data-action="switch-role" data-v="${r}" aria-pressed="${role() === r}">${esc(p[r] || (r === "p1" ? "첫 번째 사람" : "두 번째 사람"))}${role() === r ? " (나)" : ""}</button>`).join("")}</div>
          </div>
          <div class="card"><h3>우리 정보</h3>
            <form id="profileForm" class="stack">
              <label>우리 공간 이름<input name="title" maxlength="16" value="${esc(p.title || "")}" placeholder="${esc(DEFAULT_TITLE)}" /></label>
              <label>나의 이름<input name="me" required maxlength="12" value="${esc(p[role()])}" /></label>
              <label>상대 이름<input name="you" required maxlength="12" value="${esc(p[other()])}" /></label>
              <label>처음 만난 날<input name="start" type="date" required value="${esc(p.start)}" /></label>
              <label class="row"><input type="checkbox" name="dayOne" ${p.dayOne ? "checked" : ""} /> 만난 날을 1일로 세기</label>
              <button class="btn primary" type="submit">저장</button>
            </form></div>
          ${on && session.artifact ? `<div class="card stack">
            <div class="w-title" style="margin:0"><span style="font-size:16px">함께 쓰기</span><span class="pill">${waiting ? "상대 기다리는 중" : "연결됨"}</span></div>
            ${waiting ? `<p class="muted small" style="margin:0">이 링크가 둘만의 공간이에요. 상대를 이렇게 초대하세요.</p>
              <ol class="steps">
                <li>화면 위쪽의 <b>공유(Share)</b> 버튼을 눌러요.</li>
                <li>${esc(nameOf(other()))}님의 이메일을 넣고, 권한을 <b>편집자(Editor)</b>로 골라 초대해요. <span class="muted">(보기 권한이면 기록을 남길 수 없어요)</span></li>
                <li>${esc(nameOf(other()))}님이 claude.ai에 로그인해서 이 링크를 열고 <b>"${esc(nameOf(other()))}(으)로 참여하기"</b>를 누르면 끝!</li>
              </ol>` : `<p class="muted small" style="margin:0">${esc(nameOf(other()))}님과 이 링크에서 실시간으로 함께 쓰고 있어요. 한 명이 기록하면 상대 화면에도 바로 보여요.</p>`}
          </div>` : (SHARE_ENABLED || on) ? `<div class="card stack">
            <div class="w-title" style="margin:0"><span style="font-size:16px">실시간 공유</span><span class="pill">${!on ? "꺼짐" : waiting ? "대기 중" : "연결됨"}</span></div>
            <p class="muted small" style="margin:0">${!on
              ? "초대 코드를 만들어 상대에게 보내면, 지금까지의 기록이 함께 공유되고 실시간으로 같이 볼 수 있어요."
              : waiting
                ? (session.code ? "상대가 아래 코드를 입력하면 연결돼요. (7일간 유효)" : "상대를 기다리고 있어요. 코드를 잃어버렸다면 새 초대 코드를 만드세요.")
                : `${esc(nameOf(other()))}님과 실시간으로 공유 중이에요.`}</p>
            ${waiting && session.code ? `<button class="btn kakao" data-action="share-invite">💬 카카오톡으로 초대 링크 보내기</button>
              <div class="muted small" style="text-align:center">초대 코드 <b class="code-inline">${esc(session.code)}</b> <button class="link" data-action="copy-code">복사</button></div>` : ""}
            ${waiting && !session.code ? `<button class="btn kakao" data-action="new-invite">💬 새 초대 링크 만들기</button>` : ""}
            ${!on ? `<button class="btn google-btn" data-action="share-start">${GOOGLE_G} 구글로 로그인하고 공유 시작</button>
              <button class="link" data-action="share-start" data-anon="1">로그인 없이 공유 시작</button>` : `
              ${accountRowHTML()}
              <button class="btn" data-action="share-reset">상대 다시 연결 (상대를 내보내고 새 초대)</button>
              <button class="btn danger" data-action="share-leave">이 기기에서 로그아웃</button>`}
          </div>` : ""}
          ${on && session.artifact ? "" : `<div class="card stack">
            <button class="btn" data-action="export">데이터 내보내기 (JSON)</button>
            <label class="btn" style="color:var(--text)">데이터 가져오기<input type="file" id="importInput" accept="application/json" hidden /></label>
            <button class="btn danger" data-action="reset">모든 데이터 초기화</button>
          </div>`}
          <p class="muted small" style="text-align:center">지도 데이터: svg-maps (CC BY 4.0), korea-sigungu-geocoding (MIT)</p>`;
      },
    },
  };

  // 일정의 주인: 나 / 상대 / 우리 (예전 일정은 쓴 사람 기준)
  const ownerOf = (e) => (e.owner === "p1" || e.owner === "p2" || e.owner === "both" ? e.owner : e.by === "p2" ? "p2" : "p1");
  // 날짜별 사진 (사진에 날짜가 없으면 올린 날)
  function photosByDate() {
    const out = {};
    for (const p of state.photos) {
      if (!safeImg(p.src)) continue;
      const k = /^\d{4}-\d{2}-\d{2}$/.test(p.date || "") ? p.date : ymd(new Date(p.at || Date.now()));
      (out[k] = out[k] || []).push(p);
    }
    return out;
  }

  function eventForm(ev, date) {
    const owners = [{ value: role(), label: nameOf(role()) }, { value: other(), label: nameOf(other()) }, { value: "both", label: "우리" }];
    openForm({
      title: ev ? "일정 수정" : `${fmtW(parse(date))} 일정`,
      fields: [
        { name: "owner", label: "누구 일정인가요?", type: "seg", value: ev ? ownerOf(ev) : "both", options: owners },
        { name: "title", label: "일정", value: ev?.title, required: true, max: 40, placeholder: "예) 롯데월드 데이트" },
        { name: "date", label: "날짜", type: "date", value: ev ? ev.date : date, required: true },
        { name: "time", label: "시간 (선택)", type: "time", value: ev?.time || "" },
        { name: "memo", label: "메모 (선택)", value: ev?.memo, max: 60, placeholder: "예) 강남역 2번 출구" },
      ],
      async onSubmit(v) {
        const data = { owner: v.owner || "both", title: v.title, date: v.date, time: v.time || "", memo: v.memo || "" };
        if (ev) await store.update("events", ev.id, data);
        else await store.add("events", { id: uid(), ...data });
        ui.selDate = v.date;
        const d = parse(v.date);
        ui.calMonth = new Date(d.getFullYear(), d.getMonth(), 1);
        renderPage();
      },
    });
    if (ev) {
      const del = document.createElement("button");
      del.type = "button"; del.className = "btn danger full"; del.textContent = "이 일정 삭제"; del.style.marginTop = "10px";
      del.onclick = async () => { closeForm(); if (await ask("이 일정을 지울까요?", "삭제")) store.remove("events", ev.id); };
      $("#modalFields").appendChild(del);
    }
  }

  function recordsPage(group, cats) {
    const cur = ui.recCat[group] || "all";
    const list = state.records.filter((r) => cats.some((c) => c.id === r.cat) && (cur === "all" || r.cat === cur));
    const catOf = (id) => cats.find((c) => c.id === id) || { em: "📌", label: "" };
    return `<div class="seg">${[{ id: "all", label: "전체" }, ...cats].map((c) =>
        `<button class="${c.id === cur ? "on" : ""}" data-action="rec-cat" data-group="${group}" data-v="${c.id}">${c.label}</button>`).join("")}</div>
      ${list.length ? list.map((r) => `<div class="card rec">
        <div class="thumb" ${bgStyle(r.photo)}>${safeImg(r.photo) ? "" : catOf(r.cat).em}</div>
        <div style="min-width:0">
          <div class="rec-top"><span class="diary-meta">${catOf(r.cat).label}${r.date ? ` · ${fmt(parse(r.date))}` : ""}</span><span class="stars-view">${stars(+r.rating)}</span></div>
          <div class="diary-title">${esc(r.title)}</div>
          ${r.memo ? `<div class="clamp">${esc(r.memo)}</div>` : ""}
          <div class="rec-actions"><button class="link" data-action="rec-edit" data-id="${esc(r.id)}" data-group="${group}">수정</button>
            <button class="link" data-action="del" data-coll="records" data-id="${esc(r.id)}" data-confirm="이 기록을 지울까요?">삭제</button></div>
        </div></div>`).join("") : `<div class="card empty-card"><div class="empty-hint">아직 기록이 없어요.</div><button class="btn primary full" data-action="rec-new" data-group="${group}">첫 기록 남기기</button></div>`}`;
  }

  // =========================================================
  // 알림
  // =========================================================
  function notifications() {
    if (!state.profile) return [];
    const who = other();
    const n = nameOf(who);
    const out = [];
    const push = (list, fn) => list.filter((x) => x.by === who && x.at).forEach((x) => out.push({ at: x.at, ...fn(x) }));
    push(state.diary, (x) => ({ em: "✍️", text: `${n}님이 일기를 썼어요: ${x.title}`, photo: x.photo }));
    push(state.photos, (x) => ({ em: "📸", text: x.place ? `${n}님이 ${placeName(x.place)}에 사진을 넣었어요` : `${n}님이 사진을 올렸어요`, photo: x.src }));
    push(state.events, (x) => ({ em: "📅", text: `${n}님이 일정을 추가했어요: ${fmtW(parse(x.date))} ${x.title}` }));
    push(state.records, (x) => ({ em: "📜", text: `${n}님이 기록을 남겼어요: ${x.title}`, photo: x.photo }));
    push(state.expenses, (x) => ({ em: "💰", text: `${n}님이 지출을 기록했어요: ${x.title} ${won(x.amount)}` }));
    push(state.bucket, (x) => ({ em: "✅", text: `${n}님이 버킷리스트를 추가했어요: ${x.title}` }));
    push(state.places, (x) => ({ em: "🗺️", text: `${n}님이 지도에 표시했어요: ${placeName(x.id)}` }));
    return out.sort((a, b) => b.at - a.at).slice(0, 40);
  }
  function placeName(id) {
    if (id.startsWith("d-")) return `${provName(PROV_OF_CODE[id.slice(2)])} ${sggName(id.slice(2))}`;
    if (id.startsWith("kr-")) return (window.MAP_KR.locations.find((l) => `kr-${l.id}` === id) || {}).name || id;
    return countryName(id.slice(2), id);
  }
  function timeAgo(at) {
    const s = (Date.now() - at) / 1000;
    if (s < 60) return "방금";
    if (s < 3600) return `${Math.floor(s / 60)}분 전`;
    if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
    return fmtW(new Date(at));
  }

  // =========================================================
  // 동작
  // =========================================================
  const todayStr = () => ymd(today());

  function diaryForm(d) {
    openForm({
      title: d ? "일기 수정" : "오늘 일기 쓰기",
      fields: [
        { name: "date", label: "날짜", type: "date", value: d ? d.date : todayStr(), required: true },
        { name: "title", label: "제목", value: d?.title, required: true, max: 40, placeholder: "오늘의 한 줄" },
        { name: "body", label: "내용", type: "textarea", value: d?.body, required: true, max: 3000, rows: 7, placeholder: "오늘 우리는…" },
        { name: "photo", label: "사진", type: "photo", value: d?.photo },
      ],
      async onSubmit(v) {
        const data = { date: v.date, title: v.title, body: v.body, photo: v.photo || null };
        if (d) await store.update("diary", d.id, data);
        else await store.add("diary", { id: uid(), ...data });
      },
    });
  }

  function recordForm(group, r) {
    const cats = group === "culture" ? CULTURE : FOOD;
    const cur = ui.recCat[group];
    openForm({
      title: r ? "기록 수정" : group === "culture" ? "문화 기록 추가" : "맛집 기록 추가",
      fields: [
        { name: "cat", label: "종류", type: "seg", value: r ? r.cat : (cur && cur !== "all" ? cur : cats[0].id), options: cats.map((c) => ({ value: c.id, label: c.label })) },
        { name: "title", label: group === "culture" ? "제목" : "이름", value: r?.title, required: true, max: 40, placeholder: group === "culture" ? "예) 인사이드 아웃 2" : "예) 성수 OO식당" },
        { name: "date", label: "날짜", type: "date", value: r ? r.date : todayStr() },
        { name: "rating", label: "별점", type: "rating", value: r ? +r.rating : 0 },
        { name: "memo", label: "한줄평", type: "textarea", value: r?.memo, max: 500, rows: 3 },
        { name: "photo", label: "사진", type: "photo", value: r?.photo },
      ],
      async onSubmit(v) {
        const data = { cat: v.cat, title: v.title, date: v.date, rating: +v.rating || 0, memo: v.memo, photo: v.photo || null };
        if (r) await store.update("records", r.id, data);
        else await store.add("records", { id: uid(), ...data });
      },
    });
  }

  function expenseForm(x) {
    openForm({
      title: x ? "지출 수정" : "지출 추가",
      fields: [
        { name: "title", label: "내용", value: x?.title, required: true, max: 30, placeholder: "예) 저녁 파스타" },
        { name: "amount", label: "금액 (원)", type: "number", value: x?.amount, required: true },
        { name: "date", label: "날짜", type: "date", value: x ? x.date : todayStr(), required: true },
        { name: "cat", label: "카테고리", type: "select", value: x ? x.cat : "식비", options: EXP_CATS.map((c) => ({ value: c, label: c })) },
        { name: "payer", label: "누가 냈나요?", type: "seg", value: x ? x.payer : role(),
          options: [{ value: role(), label: nameOf(role()) }, { value: other(), label: nameOf(other()) }, { value: "both", label: "같이" }] },
      ],
      async onSubmit(v) {
        const data = { title: v.title, amount: Math.max(0, Math.round(+v.amount || 0)), date: v.date, cat: v.cat, payer: v.payer };
        if (x) await store.update("expenses", x.id, data);
        else await store.add("expenses", { id: uid(), ...data });
      },
    });
    if (x) {
      // 수정 시 삭제 버튼 제공
      const del = document.createElement("button");
      del.type = "button"; del.className = "btn danger full"; del.textContent = "이 지출 삭제"; del.style.marginTop = "10px";
      del.onclick = async () => { closeForm(); if (await ask("이 지출을 지울까요?", "삭제")) store.remove("expenses", x.id); };
      $("#modalFields").appendChild(del);
    }
  }

  async function addPhotos(capture, extra = {}) {
    const files = await pickImages({ multiple: !capture, capture });
    if (!files.length) return;
    if (shared()) toast("사진을 올리는 중…");
    for (const f of files) {
      try {
        // 공유 모드: 문서 1개당 1MB 제한이 있어 조금 더 작게 저장
        const src = await resizeImage(f, shared() ? 960 : 1080);
        await store.add("photos", { id: uid(), src, date: todayStr(), ...extra });
      } catch { /* 읽을 수 없는 파일은 건너뜀 */ }
    }
  }

  function moveWidget(k, dir) {
    const i = local.widgets.indexOf(k), j = i + dir;
    if (i < 0 || j < 0 || j >= local.widgets.length) return;
    [local.widgets[i], local.widgets[j]] = [local.widgets[j], local.widgets[i]];
    saveLocal(); render();
  }

  let viewing = null;

  const ACTIONS = {
    open: (el) => openPage(el.dataset.page),
    gallery: () => openPage("gallery"),
    "open-settings": () => openPage("settings"),
    // ＋에서 블럭 선택: 홈에 추가하고 바로 그 블럭을 연다 (이미 있으면 열기만)
    "w-add": (el) => {
      const k = el.dataset.k;
      const isNew = !local.widgets.includes(k);
      if (isNew) local.widgets.push(k);
      saveLocal(); closeAllPages(); render();
      const w = $(`#widgets [data-w="${k}"]`);
      if (w) { w.scrollIntoView({ block: "center" }); w.classList.add("flash"); }
      if (WIDGETS[k].page) openPage(WIDGETS[k].page);
      if (isNew) toast(`홈에 ${WIDGETS[k].name} 블럭을 추가했어요`);
    },
    "cal-open": (el) => {
      ui.selDate = el.dataset.v;
      const d = parse(ui.selDate);
      ui.calMonth = new Date(d.getFullYear(), d.getMonth(), 1);
      openPage("calendar");
    },
    "w-remove": (el) => { local.widgets = local.widgets.filter((k) => k !== el.dataset.k); saveLocal(); render(); },
    "w-up": (el) => moveWidget(el.dataset.k, -1),
    "w-down": (el) => moveWidget(el.dataset.k, 1),

    mood: (el) => {
      const k = todayStr();
      const cur = (state.moods[k] || {})[role()];
      store.setMood(k, role(), cur === el.dataset.v ? null : el.dataset.v);
    },
    "mood-other": () => toast("상대의 기분은 상대가 골라요 😉"),

    del: async (el) => {
      if (el.dataset.confirm && !(await ask(el.dataset.confirm, "삭제"))) return;
      store.remove(el.dataset.coll, el.dataset.id);
    },

    "diary-new": () => diaryForm(null),
    "diary-edit": (el) => diaryForm(state.diary.find((d) => d.id === el.dataset.id)),

    "rec-new": (el) => recordForm(el.dataset.group, null),
    "rec-edit": (el) => recordForm(el.dataset.group, state.records.find((r) => r.id === el.dataset.id)),
    "rec-cat": (el) => { ui.recCat[el.dataset.group] = el.dataset.v; renderPage(); },

    "event-new": () => eventForm(null, ui.selDate || todayStr()),
    "event-edit": (el) => { const ev = state.events.find((x) => x.id === el.dataset.id); if (ev) eventForm(ev); },
    "cal-sel": (el) => {
      ui.selDate = el.dataset.v;
      const d = parse(ui.selDate);
      if (d.getMonth() !== ui.calMonth.getMonth() || d.getFullYear() !== ui.calMonth.getFullYear()) ui.calMonth = new Date(d.getFullYear(), d.getMonth(), 1);
      renderPage();
    },
    "cal-move": (el) => { ui.calMonth = new Date(ui.calMonth.getFullYear(), ui.calMonth.getMonth() + +el.dataset.v, 1); renderPage(); },
    "cal-month": () => openForm({
      title: "달 선택",
      fields: [{ name: "month", label: "몇 년 몇 월로 갈까요?", type: "month", value: `${ui.calMonth.getFullYear()}-${pad(ui.calMonth.getMonth() + 1)}`, required: true }],
      okText: "이동",
      onSubmit: (v) => {
        const [yy, mm] = (v.month || "").split("-").map(Number);
        if (yy && mm) { ui.calMonth = new Date(yy, mm - 1, 1); renderPage(); }
      },
    }),
    "cal-who": (el) => {
      const k = el.dataset.v;
      ui.calWho[k] = !ui.calWho[k];
      if (!ui.calWho.p1 && !ui.calWho.p2 && !ui.calWho.both) ui.calWho[k] = true; // 하나는 켜두기
      renderPage();
    },
    "cal-photo-add": () => addPhotos(false, { date: ui.selDate || todayStr() }),
    "cal-search": () => openForm({
      title: "일정 검색",
      fields: [{ name: "q", label: "찾을 말", required: true, max: 30, placeholder: "예) 여행, 생일", value: ui.calSearch || "" }],
      okText: "검색",
      onSubmit: (v) => { ui.calSearch = v.q; renderPage(true); },
    }),
    "cal-search-clear": () => { ui.calSearch = ""; renderPage(); },
    "cal-goto": (el) => {
      const d = parse(el.dataset.v);
      ui.selDate = el.dataset.v; ui.calMonth = new Date(d.getFullYear(), d.getMonth(), 1); ui.calSearch = "";
      renderPage(true);
    },

    "bucket-new": () => openForm({
      title: "버킷리스트 추가",
      fields: [{ name: "title", label: "함께 하고 싶은 일", required: true, max: 50, placeholder: "예) 제주도 한 달 살기" }],
      onSubmit: (v) => store.add("bucket", { id: uid(), title: v.title, done: false }),
    }),
    "bucket-toggle": (el) => store.update("bucket", el.dataset.id, { done: el.checked }),

    "exp-new": () => expenseForm(null),
    "exp-edit": (el) => expenseForm(state.expenses.find((x) => x.id === el.dataset.id)),
    "bm-move": (el) => { ui.budgetMonth = new Date(ui.budgetMonth.getFullYear(), ui.budgetMonth.getMonth() + +el.dataset.v, 1); renderPage(); },

    place: (el) => {
      const id = el.dataset.id;
      if (state.places.some((p) => p.id === id)) store.remove("places", id);
      else store.add("places", { id });
    },
    "country-add": () => { const v = $("#countrySel")?.value; if (v) store.add("places", { id: `w-${v}` }); },

    region: (el) => openPage("region", el.dataset.v),
    district: (el) => openPage("district", el.dataset.v),
    "place-photo": async (el) => {
      const code = el.dataset.v;
      const files = await pickImages({ multiple: true });
      if (!files.length) return;
      if (shared()) toast("사진을 올리는 중…");
      for (const f of files) {
        try {
          const src = await resizeImage(f, shared() ? 960 : 1080);
          await store.add("photos", { id: uid(), src, place: `d-${code}` });
        } catch { /* 읽을 수 없는 파일은 건너뜀 */ }
      }
      if (!state.places.some((p) => p.id === `d-${code}`)) store.add("places", { id: `d-${code}` });
    },
    "photo-take": () => addPhotos(true),
    "photo-add": () => addPhotos(false),
    "view-photo": (el) => {
      const p = state.photos.find((x) => x.id === el.dataset.id); if (!p) return;
      viewing = p.id;
      $("#viewerImg").src = safeImg(p.src);
      $("#viewerCap").textContent = `${nameOf(p.by)} · ${p.date ? fmt(parse(p.date)) : fmt(new Date(p.at))}${p.place ? ` · ${placeName(p.place)}` : ""}`;
      $("#viewer").classList.remove("hidden");
    },

    "bg-change": async (el) => {
      const [f] = await pickImages(); if (!f) return;
      try {
        local.bg = await resizeImage(f, 1600, 0.72);
        local.bgLum = await imageLuminance(local.bg);
        saveLocal(); applyBg();
        if (el.dataset.close) closeAllPages();
        render();
        toast("배경화면을 바꿨어요");
      } catch { toast("사진을 읽을 수 없어요."); }
    },
    "bg-reset": () => { local.bg = null; local.bgLum = null; saveLocal(); applyBg(); render(); },
    "glass-tone": (el) => { local.glass.tone = el.dataset.v; saveLocal(); updateTones(); renderPage(); },

    "copy-code": () => {
      if (!session?.code) return;
      navigator.clipboard?.writeText(session.code).then(() => toast("초대 코드를 복사했어요"), () => toast(session.code));
    },
    // 폰의 공유 창(카카오톡 등)으로 초대 링크 보내기. 공유 창이 없으면 링크를 복사
    "share-invite": async () => {
      if (!session?.code) return;
      const url = inviteURL(session.code);
      const text = `${nameOf(role())}님이 '${appTitle()}'에 초대했어요 💕\n링크를 눌러 참여해 주세요. (7일 동안 쓸 수 있어요)`;
      if (navigator.share) {
        try { await navigator.share({ title: `${appTitle()} 초대`, text, url }); return; }
        catch (e) { if (e && e.name === "AbortError") return; }
      }
      try {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        toast("초대 링크를 복사했어요. 카카오톡 대화방에 붙여넣어 보내주세요");
      } catch {
        await ask(`이 링크를 복사해서 카카오톡으로 보내주세요\n\n${url}`, "확인");
      }
    },
    "new-invite": async () => {
      try {
        const s = await sync();
        session.code = await s.newInvite(session.roomId, role());
        saveSession(); render();
        ACTIONS["share-invite"]();
      } catch (err) { console.error(err); toast("초대를 만들지 못했어요. 인터넷 연결을 확인해주세요."); }
    },
    // 이 기기의 사람(나) 바꾸기
    "switch-role": async (el) => {
      const to = el.dataset.v, from = role();
      if (to === from) return;
      const toName = nameOf(to);
      const alone = !shared() || memberCount < 2;
      if (!alone && !(await ask(`${toName}님으로 바꿀까요?\n상대도 ${toName}님으로 되어 있으면 둘 다 같은 사람으로 보여요. 상대 폰에서는 반대로 바꿔주세요.`, "바꾸기"))) return;
      // 상대가 아직 안 들어왔으면, 지금까지 남긴 기록도 바뀐 사람 것으로 옮길지 물어봄
      const mine = alone ? ["events", "bucket", "diary", "records", "expenses", "photos", "places"]
        .flatMap((c) => state[c].filter((x) => x.by === from).map((x) => [c, x])) : [];
      const moveRecords = mine.length > 0 && (await ask(`지금까지 남긴 기록 ${mine.length}개도 ${toName}님이 쓴 걸로 바꿀까요?`, "같이 바꾸기"));
      try {
        if (shared() && session.artifact) await artifactBackend.switchRole(from, to);
        session ? (session.role = to) : (local.myRole = to);
        if (session) {
          saveSession();
          if (!session.artifact) {
            const s = await sync();
            await s.remember(session.roomId, to);
            // 상대를 기다리는 중이면, 초대 링크도 상대 자리로 다시 만들기
            if (memberCount < 2) {
              if (session.code) await s.deleteInvite(session.code);
              session.code = await s.newInvite(session.roomId, to);
            }
            saveSession();
          }
        } else saveLocal();
        if (moveRecords) {
          for (const [c, x] of mine) {
            const patch = { by: to };
            if (c === "events" && x.owner === from) patch.owner = to;
            await store.update(c, x.id, patch);
          }
        }
        toast(`이제 이 기기는 ${toName}님이에요`);
        render();
      } catch (err) {
        console.error(err);
        toast("바꾸지 못했어요. 인터넷 연결을 확인해주세요.");
      }
    },
    "link-google": async (el) => {
      el.disabled = true;
      try {
        const s = await sync();
        await s.linkGoogle();
        if (session && !session.artifact) await s.remember(session.roomId, session.role);
        toast("구글 계정을 연결했어요. 이제 폰을 바꿔도 로그인만 하면 돼요");
        render();
      } catch (err) { el.disabled = false; toast(err.friendly ? err.message : "구글 계정 연결에 실패했어요."); }
    },
    "share-start": async (el) => {
      el.disabled = true;
      try {
        const s = await sync();
        if (!s.currentUser()) {
          if (el.dataset.anon) await s.signInAnon();
          else await s.signInGoogle();
        }
        session = await s.createRoom(state.profile, state);
        saveSession(); save(); memberCount = 1;
        connect(); render();
        toast("초대 코드가 만들어졌어요!");
      } catch (err) {
        console.error(err); el.disabled = false;
        toast(err.friendly ? err.message : "연결에 실패했어요. 인터넷 연결을 확인해주세요.");
      }
    },
    "share-reset": async () => {
      if (!(await ask("상대의 연결을 끊고 새 초대 링크를 만들까요?\n(상대가 로그인 없이 쓰다가 폰을 바꿨을 때 사용해요. 구글로 로그인한 상대는 다시 로그인만 하면 돼서 필요 없어요)", "새 초대 만들기"))) return;
      try {
        const s = await sync();
        session.code = await s.resetInvite(session.roomId, role());
        saveSession(); render();
      } catch (err) { console.error(err); toast("실패했어요. 인터넷 연결을 확인해주세요."); }
    },
    "share-leave": async () => {
      if (!(await ask("이 기기에서 연결을 끊을까요?\n데이터는 상대 기기와 서버에 그대로 남아요. 다시 연결하려면 상대에게 새 초대 코드를 받아야 해요.", "연결 끊기"))) return;
      try { if (!session?.artifact) await (await sync()).signOut(); } catch { /* 오프라인 */ }
      disconnectLocal();
    },
    export: () => {
      const blob = new Blob([JSON.stringify(state)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `uridul-backup-${todayStr()}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    },
    reset: async () => {
      const msg = shared()
        ? "이 기기의 데이터를 지우고 연결을 끊을까요?\n(서버와 상대 기기의 데이터는 남아있어요)"
        : "정말 모든 데이터를 지울까요? 되돌릴 수 없어요.";
      if (!(await ask(msg, "초기화"))) return;
      disconnectLocal();
    },
  };

  // 클릭 위임: data-action 우선, 그다음 위젯 열기
  document.addEventListener("click", (e) => {
    const a = e.target.closest("[data-action]");
    if (a && ACTIONS[a.dataset.action]) {
      if (a.tagName !== "INPUT") e.preventDefault();
      ACTIONS[a.dataset.action](a, e);
      return;
    }
    const w = e.target.closest(".widget[data-open]");
    if (w) openPage(w.dataset.open);
  });

  // =========================================================
  // 홈 블럭 꾹 눌러서 순서 바꾸기
  // =========================================================
  const LONG_PRESS_MS = 450;
  let press = null; // { el, x0, y0, y, timer, dragging, grab, shift }
  let suppressClick = false;
  let autoScroll = null;

  function pressStart(el, x, y) {
    pressCancel();
    press = { el, x0: x, y0: y, y, dragging: false, shift: 0 };
    press.timer = setTimeout(beginDrag, LONG_PRESS_MS);
  }
  function pressCancel() {
    if (!press) return;
    clearTimeout(press.timer);
    press = null;
  }
  function beginDrag() {
    if (!press) return;
    const { el } = press;
    press.dragging = true;
    press.grab = press.y - el.getBoundingClientRect().top;
    el.classList.add("dragging");
    document.body.classList.add("reordering");
    try { if (navigator.vibrate) navigator.vibrate(15); } catch { /* 진동 미지원 */ }
    autoScroll = setInterval(() => {
      if (!press) return;
      const edge = 90;
      if (press.y < edge) window.scrollBy(0, -12);
      else if (press.y > innerHeight - edge) window.scrollBy(0, 12);
      else return;
      dragTo(press.y);
    }, 16);
  }
  function dragTo(y) {
    const { el } = press;
    press.y = y;
    // 손가락 위치에 맞춰 앞뒤 블럭과 자리를 바꿈
    const centerY = y - press.grab + el.offsetHeight / 2;
    let moved = true;
    while (moved) {
      moved = false;
      const prev = el.previousElementSibling, next = el.nextElementSibling;
      if (prev && prev.matches(".widget[data-w]")) {
        const b = prev.getBoundingClientRect();
        if (centerY < b.top + b.height / 2) { el.parentNode.insertBefore(el, prev); moved = true; continue; }
      }
      if (next && next.matches(".widget[data-w]")) {
        const b = next.getBoundingClientRect();
        if (centerY > b.top + b.height / 2) { el.parentNode.insertBefore(next, el); moved = true; }
      }
    }
    el.style.transform = "none";
    const base = el.getBoundingClientRect().top;
    press.shift = y - press.grab - base;
    el.style.transform = `translateY(${press.shift}px) scale(1.03)`;
    scheduleTones();
  }
  function pressEnd() {
    if (!press) return;
    clearTimeout(press.timer);
    clearInterval(autoScroll);
    if (press.dragging) {
      const { el } = press;
      el.classList.remove("dragging");
      el.style.transform = "";
      document.body.classList.remove("reordering");
      local.widgets = $$("#widgets .widget[data-w]").map((w) => w.dataset.w);
      saveLocal();
      suppressClick = true;
      setTimeout(() => (suppressClick = false), 250);
      renderHome();
      toast("블럭 순서를 바꿨어요");
    }
    press = null;
  }
  const widgetAt = (target) => {
    const w = target.closest && target.closest("#widgets .widget[data-w]");
    return w && !target.closest("input, textarea, select") ? w : null;
  };

  // 터치
  const widgetsEl = $("#widgets");
  widgetsEl.addEventListener("touchstart", (e) => {
    const w = widgetAt(e.target);
    if (w && e.touches.length === 1) pressStart(w, e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });
  document.addEventListener("touchmove", (e) => {
    if (!press) return;
    const t = e.touches[0];
    if (press.dragging) { e.preventDefault(); dragTo(t.clientY); }
    else if (Math.hypot(t.clientX - press.x0, t.clientY - press.y0) > 10) pressCancel(); // 스크롤하려는 것
  }, { passive: false });
  document.addEventListener("touchend", pressEnd);

  // 블럭이 한 화면에 다 들어가면 홈 화면이 끌려 움직이지 않게 (CSS를 지원하지 않는 옛 iOS용)
  document.addEventListener("touchmove", (e) => {
    if (press && press.dragging) return;
    if (!$("#page").classList.contains("hidden") || !$("#modal").classList.contains("hidden")) return;
    if (e.target.closest && e.target.closest(".page-body, .modal-card, .viewer, textarea, select")) return;
    if (document.documentElement.scrollHeight <= innerHeight + 1 && e.cancelable) e.preventDefault();
  }, { passive: false });
  document.addEventListener("touchcancel", pressEnd);

  // 마우스 (PC)
  widgetsEl.addEventListener("mousedown", (e) => {
    const w = widgetAt(e.target);
    if (w && e.button === 0) pressStart(w, e.clientX, e.clientY);
  });
  document.addEventListener("mousemove", (e) => {
    if (!press) return;
    if (press.dragging) { e.preventDefault(); dragTo(e.clientY); }
    else if (Math.hypot(e.clientX - press.x0, e.clientY - press.y0) > 10) pressCancel();
  });
  document.addEventListener("mouseup", pressEnd);

  // 꾹 누른 뒤 손을 떼면 생기는 클릭은 무시 (블럭이 열리지 않게)
  document.addEventListener("click", (e) => {
    if (suppressClick) { e.stopPropagation(); e.preventDefault(); suppressClick = false; }
  }, true);
  widgetsEl.addEventListener("contextmenu", (e) => { if (widgetAt(e.target)) e.preventDefault(); });

  $("#addBtn").addEventListener("click", () => openPage("gallery"));
  $("#gearBtn").addEventListener("click", () => openPage("settings"));
  $("#bellBtn").addEventListener("click", () => {
    openPage("notifications");
    local.lastSeen = Date.now(); saveLocal(); renderHome();
  });

  $("#viewerClose").addEventListener("click", () => $("#viewer").classList.add("hidden"));
  $("#viewerDel").addEventListener("click", async () => {
    if (!(await ask("이 사진을 지울까요?", "삭제"))) return;
    store.remove("photos", viewing);
    $("#viewer").classList.add("hidden");
  });

  // 설정 폼
  document.addEventListener("submit", async (e) => {
    if (e.target.id !== "profileForm") return;
    e.preventDefault();
    const f = new FormData(e.target);
    document.activeElement?.blur();
    await store.setProfile({
      title: (f.get("title") || "").trim(),
      [role()]: f.get("me").trim(),
      [other()]: f.get("you").trim(),
      start: f.get("start"),
      dayOne: f.get("dayOne") === "on",
    });
    toast("저장했어요.");
  });
  // 캘린더를 옆으로 밀면 이전/다음 달
  let calSwipe = null;
  $("#pageBody").addEventListener("touchstart", (e) => {
    if (!e.target.closest("#cal2") || e.touches.length !== 1) return;
    calSwipe = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: true });
  $("#pageBody").addEventListener("touchend", (e) => {
    if (!calSwipe) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - calSwipe.x, dy = t.clientY - calSwipe.y;
    calSwipe = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5 && ui.calMonth) {
      ui.calMonth = new Date(ui.calMonth.getFullYear(), ui.calMonth.getMonth() + (dx < 0 ? 1 : -1), 1);
      renderPage();
    }
  }, { passive: true });

  document.addEventListener("change", (e) => {
    if (e.target.id !== "calPhotoToggle") return;
    local.calPhotos = e.target.checked; saveLocal(); renderPage();
  });
  document.addEventListener("input", (e) => {
    if (e.target.id === "glassAlpha") {
      local.glass.alpha = (100 - +e.target.value) / 100;
      $("#glassAlphaVal").textContent = `${e.target.value}%`;
    } else if (e.target.id === "glassBlur") {
      local.glass.blur = +e.target.value;
      $("#glassBlurVal").textContent = e.target.value;
    } else return;
    applyGlass(); saveLocal();
  });
  document.addEventListener("change", async (e) => {
    if (e.target.id !== "importInput") return;
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (shared()) { toast("공유 중에는 가져오기를 할 수 없어요."); return; }
    try {
      const data = JSON.parse(await file.text());
      if (!data.profile) throw new Error();
      localStorage.setItem(KEY, JSON.stringify(data));
      location.reload();
    } catch {
      toast("올바른 백업 파일이 아니에요.");
    }
  });

  // =========================================================
  // 시작 화면
  // =========================================================
  function busy(form, on) { $$("button, input", form).forEach((el) => (el.disabled = on)); }

  $("#setupForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const profile = { title: (f.get("title") || "").trim(), p1: f.get("me").trim(), p2: f.get("you").trim(), start: f.get("start"), dayOne: true };
    if (artifactBackend) {
      busy(e.target, true);
      $("#setupMsg").textContent = "우리 공간을 만드는 중…";
      try {
        session = await artifactBackend.createRoom(profile);
        enterShared(session.role, { profile, moods: {}, members: [1] });
      } catch (err) {
        console.error(err);
        if (err && err.code === "exists") { busy(e.target, false); startInArtifact(); return; }
        $("#setupMsg").textContent = "저장하지 못했어요. 이 링크의 편집 권한이 있는지 확인해주세요.";
      } finally { busy(e.target, false); }
      return;
    }
    if (!SHARE_ENABLED) { state.profile = profile; save(); boot(); return; }
    busy(e.target, true);
    $("#setupMsg").textContent = "우리 공간을 만드는 중…";
    try {
      const s = await sync();
      session = await s.createRoom(profile);
      saveSession(); memberCount = 1;
      state.profile = profile; save(); boot();
    } catch (err) {
      console.error(err);
      $("#setupMsg").textContent = "연결에 실패했어요. 인터넷 연결을 확인해주세요.";
    } finally {
      busy(e.target, false);
    }
  });

  $("#joinForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    busy(e.target, true);
    $("#setupMsg").textContent = "연결하는 중…";
    try {
      const s = await sync();
      const r = await s.joinRoom(e.target.code.value);
      session = { roomId: r.roomId, role: r.role };
      saveSession();
      state = defaults();
      state.profile = { p1: "", p2: "", start: todayStr(), dayOne: true }; // 구독으로 곧 채워짐
      save(); boot();
      toast("연결됐어요! 💕");
    } catch (err) {
      console.error(err);
      $("#setupMsg").textContent = err.message || "연결에 실패했어요.";
    } finally {
      busy(e.target, false);
    }
  });

  // =========================================================
  // 렌더 / 부팅
  // =========================================================
  function render() {
    applyTitle();
    if (!state.profile) return;
    renderHome();
    renderPage(false);
  }

  // ---- 초대 링크 (?invite=코드) ----
  const inviteURL = (code) => `${location.origin}${location.pathname}?invite=${encodeURIComponent(code)}` +
    (state.profile && state.profile.title ? `&n=${encodeURIComponent(state.profile.title)}` : "");
  function pendingInvite() {
    try {
      const c = new URLSearchParams(location.search).get("invite");
      return c && /^[A-Za-z0-9]{6}$/.test(c) ? c.toUpperCase() : null;
    } catch { return null; }
  }
  function clearInvite() {
    try { if (location.search) history.replaceState(null, "", location.pathname + location.hash); } catch { /* 무시 */ }
  }
  const IN_KAKAO = /KAKAOTALK/i.test(navigator.userAgent || "");

  const GOOGLE_G = `<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 2.9-2.2 5.4-4.7 7.1l7.6 5.9c4.4-4.1 6.9-10.1 6.9-17.5z"/><path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.2 0-11.5-4.1-13.4-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z"/></svg>`;

  function accountRowHTML() {
    const u = syncMod && syncMod.currentUser ? syncMod.currentUser() : null;
    if (u && !u.isAnonymous) return `<div class="account-row">${GOOGLE_G}<span class="grow">구글 계정으로 로그인됨<div class="muted small">${esc(u.email)}</div></span></div>`;
    return `<div class="account-row"><span class="grow">로그인 없이 사용 중<div class="muted small">폰을 바꾸면 다시 초대를 받아야 해요. 구글 계정을 연결해 두면 로그인만 하면 돼요.</div></span></div>
      <button class="btn google-btn" data-action="link-google">${GOOGLE_G} 구글 계정 연결하기</button>`;
  }

  function setupStage(stage) {
    // stage: "auth" 로그인 고르기 / "form" 새로 만들기·코드 입력 / "busy" 확인 중
    $("#authBox").classList.toggle("hidden", stage !== "auth");
    $("#setupForm").classList.toggle("hidden", stage !== "form");
    $("#joinBox").classList.toggle("hidden", stage !== "form");
    $("#setupLead").textContent = stage === "auth" && pendingInvite()
      ? "둘만의 공간에 초대받았어요 💌 로그인하면 바로 연결돼요."
      : stage === "form" && !pendingInvite() ? "우리만의 공간을 만들어볼까요?" : $("#setupLead").dataset.def;
    $("#kakaoNote").classList.toggle("hidden", !(stage === "auth" && IN_KAKAO));
  }

  // Firebase 모드 첫 화면: 로그인 → 내 공간 찾기 → (초대 링크면) 바로 참여 → 아니면 새로 만들기
  async function firebaseStart() {
    setupStage("busy");
    $("#setupMsg").textContent = "불러오는 중…";
    let s;
    try { s = await sync(); } catch (e) { console.error(e); setupStage("form"); $("#setupMsg").textContent = "서버에 연결하지 못했어요. 인터넷 연결을 확인해주세요."; return; }
    if (!s.currentUser()) { $("#setupMsg").textContent = ""; setupStage("auth"); return; }
    await afterSignIn();
  }

  async function afterSignIn() {
    const s = await sync();
    setupStage("busy");
    $("#setupMsg").textContent = "내 공간을 찾는 중…";
    const mine = await s.myRoom();
    if (mine) { clearInvite(); return enterFirebase(mine); }
    const code = pendingInvite();
    if (code) {
      $("#setupMsg").textContent = "초대받은 공간에 연결하는 중…";
      try {
        const r = await s.joinRoom(code);
        clearInvite();
        toast("연결됐어요! 💕");
        return enterFirebase(r);
      } catch (err) {
        setupStage("form");
        $("#joinForm").code.value = code;
        $("#setupMsg").textContent = err.friendly ? err.message : "연결에 실패했어요.";
        return;
      }
    }
    $("#setupMsg").textContent = "";
    setupStage("form");
  }

  function enterFirebase(r) {
    session = { roomId: r.roomId, role: r.role, ...(r.code ? { code: r.code } : {}) };
    saveSession();
    state = defaults();
    state.profile = { p1: "", p2: "", start: todayStr(), dayOne: true }; // 구독으로 곧 채워짐
    save(); boot();
  }

  $("#googleBtn").addEventListener("click", async () => {
    if (IN_KAKAO) { toast("카카오톡 안에서는 구글 로그인이 안 돼요. '다른 브라우저로 열기'를 눌러주세요"); return; }
    $("#googleBtn").disabled = true;
    try {
      const s = await sync();
      await s.signInGoogle();
      await afterSignIn();
    } catch (err) {
      $("#setupMsg").textContent = err.friendly ? err.message : "구글 로그인에 실패했어요.";
    } finally { $("#googleBtn").disabled = false; }
  });
  $("#anonBtn").addEventListener("click", async () => {
    try { await (await sync()).signInAnon(); await afterSignIn(); }
    catch (err) { console.error(err); $("#setupMsg").textContent = "연결에 실패했어요. 인터넷 연결을 확인해주세요."; }
  });
  $("#openExternal").addEventListener("click", () => {
    // 카카오톡 인앱 브라우저 → 폰 기본 브라우저로 열기
    location.href = "kakaotalk://web/openExternal?url=" + encodeURIComponent(location.href);
  });

  // ---- 앱 이름 (처음 만들 때 정하고, 설정에서 바꿀 수 있음) ----
  function invitedTitle() {
    try { const n = new URLSearchParams(location.search).get("n"); return n ? n.slice(0, 16) : ""; } catch { return ""; }
  }
  function appTitle() {
    return (state.profile && state.profile.title) || local.title || invitedTitle() || DEFAULT_TITLE;
  }
  let manifestURL = null;
  function applyTitle() {
    const t = appTitle();
    if (state.profile && state.profile.title !== undefined && local.title !== state.profile.title) {
      local.title = state.profile.title; saveLocal(); // 다음에 열 때 로그인 화면에도 이 이름이 보이도록
    }
    if (document.title === t) return;
    document.title = t;
    $("#appName").textContent = t;
    const apple = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (apple) apple.setAttribute("content", t);
    // 홈 화면에 추가할 때 이름 (안드로이드 크롬)
    try {
      const link = document.querySelector('link[rel="manifest"]');
      if (link && location.protocol.startsWith("http")) {
        const m = { name: t, short_name: t.slice(0, 12), start_url: location.origin + location.pathname, display: "standalone", background_color: "#dbe7f7", theme_color: "#7ea6e0", lang: "ko" };
        if (manifestURL) URL.revokeObjectURL(manifestURL);
        manifestURL = URL.createObjectURL(new Blob([JSON.stringify(m)], { type: "application/manifest+json" }));
        link.setAttribute("href", manifestURL);
      }
    } catch { /* 지원 안 하는 브라우저 */ }
  }

  function boot() {
    applyTitle();
    applyBg();
    const ready = !!state.profile;
    $("#loading").classList.add("hidden");
    $("#artifactJoin").classList.add("hidden");
    $("#setupForm").classList.remove("hidden");
    $("#setup").classList.toggle("hidden", ready);
    $("#app").classList.toggle("hidden", !ready);
    $("#joinBox").classList.toggle("hidden", !SHARE_ENABLED || !!artifactBackend);
    $("#authBox").classList.add("hidden");
    $("#kakaoNote").classList.add("hidden");
    $("#setupMsg").textContent = "";
    setBadge(null);
    if (ready) {
      if (shared()) connect();
      if (pendingInvite()) clearInvite(); // 이미 연결된 기기에서 초대 링크를 연 경우
      render();
    } else {
      $("#setupForm").start.value = todayStr();
      if (SHARE_ENABLED && !artifactBackend) firebaseStart(); // 구글 로그인 / 초대 링크
    }
  }

  // ---------------------------------------------------------
  // claude.ai 링크로 열렸는지 확인하고, 그렇다면 둘이 함께 쓰는 공간으로 연결
  // ---------------------------------------------------------
  function enterShared(r, room) {
    const theme = state;
    state = Object.assign(defaults(), { profile: room.profile, moods: room.moods || {} });
    // 공유 데이터가 오기 전까지는 이 기기에 있던 기록을 잠깐 보여줌
    if (r === "p1" && theme.profile) for (const c of COLLS) state[c] = theme[c] || [];
    session = { roomId: "artifact", role: r, artifact: true };
    memberCount = Array.isArray(room.members) ? room.members.length : Object.values(room.members || {}).filter(Boolean).length;
    save(); boot();
  }

  function showSetupMessage(html) {
    $("#loading").classList.add("hidden");
    $("#app").classList.add("hidden");
    $("#setup").classList.remove("hidden");
    $("#setupForm").classList.add("hidden");
    $("#joinBox").classList.add("hidden");
    $("#setupMsg").textContent = "";
    const box = $("#artifactJoin");
    box.innerHTML = html;
    box.classList.remove("hidden");
  }

  function showJoin(room, canWrite) {
    const members = room.members || {};
    const p = room.profile || {};
    if (canWrite === false) {
      showSetupMessage(`<p><b>${esc(p.p1 || "")}</b>${p.p1 ? "님의 " : ""}공간을 보기 권한으로 열었어요.</p>
        <p class="muted small">함께 기록하려면 공유한 사람에게 <b>편집자(Editor)</b>로 다시 초대해 달라고 해주세요.</p>`);
      return;
    }
    const free = ["p1", "p2"].filter((r) => !members[r]);
    const choices = free.length ? free : ["p1", "p2"];
    showSetupMessage(`<p style="margin:0 0 6px"><b>${esc(p.p1 || "")} ♥ ${esc(p.p2 || "")}</b></p>
      <p class="muted small" style="margin:0 0 16px">${free.length ? "둘만의 공간에 초대받았어요. 아래 버튼을 눌러 참여하세요." : "누구인지 골라주세요. (새 계정으로 다시 들어온 경우)"}</p>
      <div class="stack">${choices.map((r) => `<button class="btn primary" data-join-role="${r}">${esc(p[r] || "")}(으)로 참여하기</button>`).join("")}</div>`);
    $$("#artifactJoin [data-join-role]").forEach((b) => b.addEventListener("click", async () => {
      $$("#artifactJoin button").forEach((x) => (x.disabled = true));
      try {
        const sess = await artifactBackend.claim(b.dataset.joinRole);
        enterShared(sess.role, room);
        toast("연결됐어요! 💕");
      } catch (err) {
        console.error(err);
        $$("#artifactJoin button").forEach((x) => (x.disabled = false));
        toast("참여하지 못했어요. 편집자 권한으로 초대받았는지 확인해주세요.");
      }
    }));
  }

  async function startInArtifact() {
    $("#setup").classList.add("hidden");
    $("#app").classList.add("hidden");
    $("#loading").classList.remove("hidden");
    applyBg();
    const db = await withTimeout(window.claude.use("db"), 10000);
    const user = db ? await withTimeout(window.claude.use("user"), 10000) : null;
    const uid = user ? await withTimeout(user.id(), 10000) : null;
    if (!db || !uid) { boot(); return; } // 공유 저장소를 쓸 수 없으면 이 기기에만 저장
    artifactBackend = makeArtifactBackend(db, uid);
    const canWrite = await withTimeout(user.can ? user.can("data.write") : null, 5000);
    const snap = await withTimeout(db.doc(SPACE).get(), 10000);
    if (!snap) { artifactBackend = null; boot(); toast("공유 공간에 연결하지 못했어요. 지금은 이 기기에만 저장돼요."); return; }
    if (snap.exists) {
      const room = snap.data();
      const members = room.members || {};
      const mine = ["p1", "p2"].find((r) => members[r] === uid);
      if (mine) return enterShared(mine, room);
      return showJoin(room, canWrite);
    }
    if (canWrite === false) {
      showSetupMessage(`<p>아직 만들어진 공간이 없어요.</p><p class="muted small">이 링크를 만든 사람이 먼저 열어야 해요. 함께 쓰려면 <b>편집자(Editor)</b>로 초대받아야 해요.</p>`);
      return;
    }
    if (state.profile) {
      // 이 기기에서 쓰던 기록으로 둘만의 공간을 만듦
      $("#loadingMsg").textContent = "기록을 함께 쓰는 공간으로 옮기는 중…";
      try {
        session = await artifactBackend.createRoom(state.profile, state);
        enterShared("p1", { profile: state.profile, moods: state.moods, members: [uid] });
        toast("이제 이 링크에서 둘이 함께 쓸 수 있어요");
      } catch (err) {
        console.error(err);
        if (err && err.code === "exists") return startInArtifact(); // 그새 만들어졌으면 다시 확인
        artifactBackend = null; boot();
        toast("공유 공간을 만들지 못했어요. 지금은 이 기기에만 저장돼요.");
      }
      return;
    }
    boot(); // 처음이면 이름/날짜 입력 → 저장하면 공유 공간이 만들어짐
  }

  if (window.claude && typeof window.claude.use === "function") startInArtifact();
  else boot();
})();
