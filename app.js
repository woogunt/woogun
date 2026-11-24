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

  // =========================================================
  // 저장소
  // =========================================================
  const defaults = () => ({
    profile: null, // { p1, p2, start, dayOne }
    moods: {},     // { "YYYY-MM-DD": { p1, p2 } }
    events: [],    // { id, date, title, by, at }
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
  let local = Object.assign({ widgets: DEFAULT_WIDGETS.slice(), bg: null, lastSeen: Date.now() }, readJSON(LOCAL_KEY) || {});
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
  const role = () => (session && session.role) || "p1";
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
  const saveSession = () => (session ? writeJSON(SESSION_KEY, session) : localStorage.removeItem(SESSION_KEY));

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
  async function sync() {
    if (!syncMod) syncMod = await import("./sync.js");
    await syncMod.init();
    return syncMod;
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

  function koreaSVG(clickable) {
    const on = new Set(visited("kr-").map((p) => p.id.slice(3)));
    const m = window.MAP_KR;
    return `<svg class="map-svg" viewBox="${m.viewBox}" role="img" aria-label="대한민국 지도">${m.locations.map((l) =>
      `<path d="${l.path}" class="${on.has(l.id) ? "on" : ""}" ${clickable ? `data-action="place" data-id="kr-${l.id}"` : ""}><title>${l.name}</title></path>`
    ).join("")}</svg>`;
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
          cells += `<span class="${cls}">${d}</span>`;
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
        const pct = Math.round((visited("kr-").length / window.MAP_KR.locations.length) * 100);
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
        const slot = (p, empty, who) => p
          ? `<div class="slot has-photo" ${bgStyle(p.src)}><span class="who">${esc(nameOf(who))}</span></div>`
          : `<div class="slot">${empty}</div>`;
        return `<div class="w-title"><span><span class="em">📸</span>공유 앨범</span></div>
          <div class="duo">${slot(mine, "실시간 사진을 올려보세요!", role())}${slot(theirs, "상대방 사진은 아직이에요", other())}</div>
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
    return `<section class="widget glass ${w.cls || ""}" ${!opts.preview && w.page ? `data-open="${w.page}"` : ""} data-w="${key}">${w.html()}</section>`;
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
    const invite = shared() && memberCount < 2 && session.code
      ? `<section class="widget glass" data-open="settings" style="text-align:center">
          <div class="muted small">상대에게 이 초대 코드를 보내주세요</div>
          <div class="invite-code">${esc(session.code)}</div>
          <button class="btn ghost" data-action="copy-code">코드 복사</button></section>`
      : "";
    $("#widgets").innerHTML = invite + (local.widgets.map((k) => widgetHTML(k)).join("")
      || `<div class="widget glass" data-action="gallery"><div class="empty-hint">＋ 버튼을 눌러 위젯을 추가해보세요.</div></div>`);
    $("#bellDot").classList.toggle("hidden", !notifications().some((n) => n.at > local.lastSeen));
  }

  function applyBg() {
    const bg = $("#bg");
    const src = safeImg(local.bg);
    bg.style.backgroundImage = src ? `url('${src}')` : "";
    bg.classList.toggle("photo", !!src);
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
    if (!top) return;
    const p = PAGES[top.key];
    // 설정 페이지에서 입력 중이면 덮어쓰지 않음
    if (!scrollTop && top.key === "settings" && $("#pageBody").contains(document.activeElement) && document.activeElement.tagName === "INPUT") return;
    $("#pageTitle").textContent = typeof p.title === "function" ? p.title(top.arg) : p.title;
    $("#pageAction").innerHTML = p.action ? p.action(top.arg) : "";
    const scroll = $("#pageBody").scrollTop;
    $("#pageBody").innerHTML = p.html(top.arg);
    $("#pageBody").scrollTop = scrollTop ? 0 : scroll;
  }

  const addBtn = (action, label = "＋ 추가", extra = "") => `<button class="add-btn" data-action="${action}" ${extra}>${label}</button>`;

  const PAGES = {
    // ---- 위젯 갤러리 ----
    gallery: {
      title: "위젯",
      html() {
        const mine = local.widgets;
        const rest = Object.keys(WIDGETS).filter((k) => !mine.includes(k));
        return `<div class="card"><h3>내 홈 화면</h3>
            <ul class="list my-widgets">${mine.map((k, i) => `<li><span class="grow">${WIDGETS[k].name}</span>
              <button class="icon-sq" data-action="w-up" data-k="${k}" ${i === 0 ? "disabled" : ""} aria-label="위로">↑</button>
              <button class="icon-sq" data-action="w-down" data-k="${k}" ${i === mine.length - 1 ? "disabled" : ""} aria-label="아래로">↓</button>
              <button class="icon-sq" data-action="w-remove" data-k="${k}" aria-label="빼기">✕</button></li>`).join("") || `<li class="empty">위젯이 없어요</li>`}</ul>
          </div>
          ${rest.length ? `<h3 style="margin:22px 4px 12px">위젯 추가</h3>` : ""}
          ${rest.map((k) => `<div class="gallery-item" data-action="w-add" data-k="${k}">
            <div class="preview">${widgetHTML(k, { preview: true })}</div>
            <div class="label">${WIDGETS[k].name}</div></div>`).join("")}`;
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

    // ---- 캘린더 ----
    calendar: {
      title: "캘린더",
      action: () => addBtn("event-new", "＋ 일정"),
      html() {
        const cm = ui.calMonth || (ui.calMonth = new Date(today().getFullYear(), today().getMonth(), 1));
        const sel = ui.selDate || (ui.selDate = ymd(today()));
        const y = cm.getFullYear(), m = cm.getMonth();
        const first = new Date(y, m, 1);
        const startD = addDays(first, -first.getDay());
        const t = ymd(today());
        const special = specialDays();
        const ev = new Set(state.events.map((x) => x.date));
        let grid = "";
        for (let i = 0; i < 42; i++) {
          const d = addDays(startD, i); const k = ymd(d);
          const cls = [d.getMonth() !== m && "other", k === t && "today", k === sel && "sel", (ev.has(k) || special.has(k)) && "heart",
            d.getDay() === 0 && "sun", d.getDay() === 6 && "sat"].filter(Boolean).join(" ");
          grid += `<button type="button" data-action="cal-sel" data-v="${k}" class="${cls}">${d.getDate()}</button>`;
        }
        const items = [];
        if (special.has(sel)) items.push(`<li><span class="grow">♥ ${special.get(sel)}</span><span class="tag">기념일</span></li>`);
        state.events.filter((x) => x.date === sel).forEach((x) => items.push(
          `<li><span class="grow">${esc(x.title)}</span><span class="tag who-${x.by === "p2" ? "p2" : "p1"}">${esc(nameOf(x.by))}</span><button class="del" data-action="del" data-coll="events" data-id="${esc(x.id)}" aria-label="삭제">✕</button></li>`));
        state.diary.filter((x) => x.date === sel).forEach((x) => items.push(
          `<li data-action="open" data-page="diary"><span class="grow">✍️ ${esc(x.title)}</span><span class="tag">일기</span></li>`));
        return `<div class="card">
            <div class="cal-head"><button data-action="cal-move" data-v="-1" aria-label="이전 달">‹</button><strong>${y}년 ${m + 1}월</strong><button data-action="cal-move" data-v="1" aria-label="다음 달">›</button></div>
            <div class="cal-week">${WD.map((w) => `<span>${w}</span>`).join("")}</div>
            <div class="cal-grid">${grid}</div></div>
          <div class="card"><h3>${fmtW(parse(sel))}</h3><ul class="list">${items.join("") || `<li class="empty">일정이 없어요</li>`}</ul></div>`;
      },
    },

    // ---- 일기 ----
    diary: {
      title: "커플 일기장",
      action: () => addBtn("diary-new", "＋ 쓰기"),
      html() {
        if (!state.diary.length) return `<div class="card"><div class="empty-hint">아직 일기가 없어요. 오늘 있었던 일을 남겨보세요!</div></div>`;
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
        const on = new Set(visited("kr-").map((p) => p.id));
        const pct = Math.round((on.size / window.MAP_KR.locations.length) * 100);
        return `<div class="card"><div class="w-title"><span>전국 ${pct}% 정복</span><span class="side">${on.size}/${window.MAP_KR.locations.length}</span></div>
            ${koreaSVG(true)}
            <p class="muted small">지역을 눌러 함께 가본 곳을 표시하세요.</p>
            <div class="region-chips">${window.MAP_KR.locations.map((l) =>
              `<button class="chip ${on.has(`kr-${l.id}`) ? "on" : ""}" data-action="place" data-id="kr-${l.id}">${l.name}</button>`).join("")}</div></div>`;
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
            <div class="cal-head"><button data-action="bm-move" data-v="-1" aria-label="이전 달">‹</button><strong>${bm.getFullYear()}년 ${bm.getMonth() + 1}월</strong><button data-action="bm-move" data-v="1" aria-label="다음 달">›</button></div>
            <div class="money" style="text-align:center">${won(total)}</div>
            ${list.length ? payerBars(list) : ""}
          </div>
          ${cats.length ? `<div class="card"><h3>카테고리별</h3><div class="bars">${cats.map(([c, v]) =>
            `<div class="bar-row"><span>${esc(c)}</span><div class="bar"><i style="width:${(v / total) * 100}%"></i></div><span>${won(v)}</span></div>`).join("")}</div></div>` : ""}
          <div class="card"><h3>내역</h3><ul class="list">${list.map((x) => `<li data-action="exp-edit" data-id="${esc(x.id)}" style="cursor:pointer">
              <span class="grow">${esc(x.title)}<div class="muted small">${fmtW(parse(x.date))} · ${esc(x.cat)} · ${x.payer === "both" ? "같이" : esc(nameOf(x.payer))}</div></span>
              <strong>${won(x.amount)}</strong></li>`).join("") || `<li class="empty">이 달의 지출이 없어요</li>`}</ul></div>`;
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
        return `<div class="card"><h3>우리 정보</h3>
            <form id="profileForm" class="stack">
              <label>나의 이름<input name="me" required maxlength="12" value="${esc(p[role()])}" /></label>
              <label>상대 이름<input name="you" required maxlength="12" value="${esc(p[other()])}" /></label>
              <label>처음 만난 날<input name="start" type="date" required value="${esc(p.start)}" /></label>
              <label class="row"><input type="checkbox" name="dayOne" ${p.dayOne ? "checked" : ""} /> 만난 날을 1일로 세기</label>
              <button class="btn primary" type="submit">저장</button>
            </form></div>
          <div class="card stack"><h3 style="margin:0">배경 사진</h3>
            <p class="muted small" style="margin:0">홈 화면 배경은 이 기기에만 적용돼요.</p>
            <button class="btn" data-action="bg-change">배경 사진 바꾸기</button>
            ${local.bg ? `<button class="btn" data-action="bg-reset">기본 배경으로</button>` : ""}</div>
          ${SHARE_ENABLED || on ? `<div class="card stack">
            <div class="w-title" style="margin:0"><span style="font-size:16px">실시간 공유</span><span class="pill">${!on ? "꺼짐" : waiting ? "대기 중" : "연결됨"}</span></div>
            <p class="muted small" style="margin:0">${!on
              ? "초대 코드를 만들어 상대에게 보내면, 지금까지의 기록이 함께 공유되고 실시간으로 같이 볼 수 있어요."
              : waiting
                ? (session.code ? "상대가 아래 코드를 입력하면 연결돼요. (7일간 유효)" : "상대를 기다리고 있어요. 코드를 잃어버렸다면 새 초대 코드를 만드세요.")
                : `${esc(nameOf(other()))}님과 실시간으로 공유 중이에요.`}</p>
            ${waiting && session.code ? `<div class="invite-code" id="inviteCode">${esc(session.code)}</div><button class="btn" data-action="copy-code">코드 복사</button>` : ""}
            ${!on ? `<button class="btn primary" data-action="share-start">공유 시작하기 (초대 코드 만들기)</button>` : `
              <button class="btn" data-action="share-reset">상대 기기 다시 연결 (새 초대 코드)</button>
              <button class="btn danger" data-action="share-leave">이 기기에서 연결 끊기</button>`}
          </div>` : ""}
          <div class="card stack">
            <button class="btn" data-action="export">데이터 내보내기 (JSON)</button>
            <label class="btn" style="color:var(--text)">데이터 가져오기<input type="file" id="importInput" accept="application/json" hidden /></label>
            <button class="btn danger" data-action="reset">모든 데이터 초기화</button>
          </div>
          <p class="muted small" style="text-align:center">지도 데이터: svg-maps (CC BY 4.0)</p>`;
      },
    },
  };

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
        </div></div>`).join("") : `<div class="card"><div class="empty-hint">아직 기록이 없어요. ＋ 기록을 눌러 추가해보세요.</div></div>`}`;
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
    push(state.photos, (x) => ({ em: "📸", text: `${n}님이 사진을 올렸어요`, photo: x.src }));
    push(state.events, (x) => ({ em: "📅", text: `${n}님이 일정을 추가했어요: ${fmtW(parse(x.date))} ${x.title}` }));
    push(state.records, (x) => ({ em: "📜", text: `${n}님이 기록을 남겼어요: ${x.title}`, photo: x.photo }));
    push(state.expenses, (x) => ({ em: "💰", text: `${n}님이 지출을 기록했어요: ${x.title} ${won(x.amount)}` }));
    push(state.bucket, (x) => ({ em: "✅", text: `${n}님이 버킷리스트를 추가했어요: ${x.title}` }));
    push(state.places, (x) => ({ em: "🗺️", text: `${n}님이 지도에 표시했어요: ${placeName(x.id)}` }));
    return out.sort((a, b) => b.at - a.at).slice(0, 40);
  }
  function placeName(id) {
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

  async function addPhotos(capture) {
    const files = await pickImages({ multiple: !capture, capture });
    if (!files.length) return;
    if (shared()) toast("사진을 올리는 중…");
    for (const f of files) {
      try {
        // 공유 모드: 문서 1개당 1MB 제한이 있어 조금 더 작게 저장
        const src = await resizeImage(f, shared() ? 960 : 1080);
        await store.add("photos", { id: uid(), src });
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
    "w-add": (el) => { local.widgets.push(el.dataset.k); saveLocal(); render(); toast(`${WIDGETS[el.dataset.k].name} 위젯을 추가했어요`); },
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

    "event-new": () => openForm({
      title: `${fmtW(parse(ui.selDate || todayStr()))} 일정`,
      fields: [
        { name: "title", label: "일정", required: true, max: 40, placeholder: "예) 롯데월드 데이트" },
        { name: "date", label: "날짜", type: "date", value: ui.selDate || todayStr(), required: true },
      ],
      onSubmit: (v) => store.add("events", { id: uid(), date: v.date, title: v.title }),
    }),
    "cal-sel": (el) => {
      ui.selDate = el.dataset.v;
      const d = parse(ui.selDate);
      if (d.getMonth() !== ui.calMonth.getMonth()) ui.calMonth = new Date(d.getFullYear(), d.getMonth(), 1);
      renderPage();
    },
    "cal-move": (el) => { ui.calMonth = new Date(ui.calMonth.getFullYear(), ui.calMonth.getMonth() + +el.dataset.v, 1); renderPage(); },

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

    "photo-take": () => addPhotos(true),
    "photo-add": () => addPhotos(false),
    "view-photo": (el) => {
      const p = state.photos.find((x) => x.id === el.dataset.id); if (!p) return;
      viewing = p.id;
      $("#viewerImg").src = safeImg(p.src);
      $("#viewerCap").textContent = `${nameOf(p.by)} · ${fmt(new Date(p.at))}`;
      $("#viewer").classList.remove("hidden");
    },

    "bg-change": async () => {
      const [f] = await pickImages(); if (!f) return;
      try { local.bg = await resizeImage(f, 1280, 0.7); saveLocal(); applyBg(); render(); } catch { toast("사진을 읽을 수 없어요."); }
    },
    "bg-reset": () => { local.bg = null; saveLocal(); applyBg(); render(); },

    "copy-code": () => {
      if (!session?.code) return;
      navigator.clipboard?.writeText(session.code).then(() => toast("초대 코드를 복사했어요"), () => toast(session.code));
    },
    "share-start": async (el) => {
      el.disabled = true;
      try {
        const s = await sync();
        session = await s.createRoom(state.profile, state);
        saveSession(); save(); memberCount = 1;
        connect(); render();
        toast("초대 코드가 만들어졌어요!");
      } catch (err) {
        console.error(err); el.disabled = false;
        toast("연결에 실패했어요. 인터넷 연결을 확인해주세요.");
      }
    },
    "share-reset": async () => {
      if (!(await ask("상대 기기의 연결을 끊고 새 초대 코드를 만들까요?\n(상대가 폰을 바꿨거나 앱 데이터를 지웠을 때 사용해요)", "새 코드 만들기"))) return;
      try {
        const s = await sync();
        session.code = await s.resetInvite(session.roomId, role());
        saveSession(); render();
      } catch (err) { console.error(err); toast("실패했어요. 인터넷 연결을 확인해주세요."); }
    },
    "share-leave": async () => {
      if (!(await ask("이 기기에서 연결을 끊을까요?\n데이터는 상대 기기와 서버에 그대로 남아요. 다시 연결하려면 상대에게 새 초대 코드를 받아야 해요.", "연결 끊기"))) return;
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
      [role()]: f.get("me").trim(),
      [other()]: f.get("you").trim(),
      start: f.get("start"),
      dayOne: f.get("dayOne") === "on",
    });
    toast("저장했어요.");
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
    const profile = { p1: f.get("me").trim(), p2: f.get("you").trim(), start: f.get("start"), dayOne: true };
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
    if (!state.profile) return;
    renderHome();
    renderPage(false);
  }

  function boot() {
    applyBg();
    const ready = !!state.profile;
    $("#setup").classList.toggle("hidden", ready);
    $("#app").classList.toggle("hidden", !ready);
    $("#joinBox").classList.toggle("hidden", !SHARE_ENABLED);
    $("#setupMsg").textContent = "";
    setBadge(null);
    if (ready) {
      if (shared()) connect();
      render();
    } else {
      $("#setupForm").start.value = todayStr();
    }
  }

  boot();
})();
