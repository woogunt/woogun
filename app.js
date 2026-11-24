(() => {
  "use strict";

  const KEY = "uridul-v1";
  const SESSION_KEY = "uridul-session";
  const MOODS = ["😊", "🥰", "😴", "😢", "😠", "🤒"];
  const DAY = 86400000;
  const SHARE_ENABLED = !!(window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.projectId);

  // ---------- 저장소 ----------
  const defaults = () => ({
    profile: null, // { p1, p2, start, dayOne }
    events: [],    // { id, date, title }
    bucket: [],    // { id, title, done, at }
    letters: [],   // { id, from, body, at }
    photos: [],    // { id, src, at }
    moods: {},     // { "YYYY-MM-DD": { p1, p2 } }
    theme: null,
  });

  const readJSON = (k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } };
  const writeJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };

  let state = Object.assign(defaults(), readJSON(KEY) || {});
  // 이전 버전 데이터 변환 ({me, you} → {p1, p2})
  if (state.profile && state.profile.me !== undefined) {
    const { me, you, ...rest } = state.profile;
    state.profile = { p1: me, p2: you, ...rest };
    for (const k in state.moods) {
      const { me, you } = state.moods[k];
      state.moods[k] = JSON.parse(JSON.stringify({ p1: me || undefined, p2: you || undefined }));
    }
  }

  // session: 공유 모드일 때 { roomId, role, code? }
  let session = readJSON(SESSION_KEY);
  const shared = () => !!(session && session.roomId);
  const role = () => (session && session.role) || "p1";
  const other = () => (role() === "p1" ? "p2" : "p1");

  function save() {
    // 공유 모드에서는 사진을 서버에서 다시 받으므로 로컬 캐시에서 제외 (용량 절약)
    const data = shared() ? { ...state, photos: [] } : state;
    if (!writeJSON(KEY, data)) toast("저장 공간이 부족해요. 사진을 몇 장 지워주세요.");
  }
  const saveSession = () => (session ? writeJSON(SESSION_KEY, session) : localStorage.removeItem(SESSION_KEY));

  // ---------- 유틸 ----------
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const pad = (n) => String(n).padStart(2, "0");
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
  const diffDays = (a, b) => Math.round((parse(ymd(b)) - parse(ymd(a))) / DAY);
  const fmt = (d) => `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
  const WD = ["일", "월", "화", "수", "목", "금", "토"];
  const fmtW = (d) => `${d.getMonth() + 1}월 ${d.getDate()}일 (${WD[d.getDay()]})`;

  let toastTimer;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg; t.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add("hidden"), 2500);
  }

  // ---------- 공유 모듈 ----------
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

  // 데이터 변경은 모두 store를 통해서: 로컬 모드면 바로 저장, 공유 모드면 서버에 쓰고 실시간 구독으로 화면 갱신
  const store = {
    async add(coll, item) {
      if (shared()) return remote((s) => s.ops.add(session.roomId, coll, item));
      state[coll].unshift(item); save(); render();
    },
    async update(coll, id, patch) {
      if (shared()) return remote((s) => s.ops.update(session.roomId, coll, id, patch));
      Object.assign(state[coll].find((x) => x.id === id) || {}, patch); save(); render();
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

  async function remote(fn) {
    try {
      await fn(await sync());
    } catch (e) {
      console.error(e);
      toast("저장에 실패했어요. 인터넷 연결을 확인해주세요.");
    }
  }

  // ---------- 실시간 구독 ----------
  let unsubscribe = null;
  let memberCount = 2;

  const SORTERS = {
    events: (a, b) => a.date.localeCompare(b.date),
    bucket: (a, b) => (b.at || 0) - (a.at || 0),
    letters: (a, b) => b.at - a.at,
    photos: (a, b) => b.at - a.at,
  };

  async function connect() {
    if (unsubscribe) unsubscribe();
    setBadge("연결 중…", true);
    let s;
    try {
      s = await sync();
    } catch (e) {
      console.error(e);
      setBadge("오프라인", true);
      return;
    }
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
        state[coll] = items.sort(SORTERS[coll]);
        save(); render();
      },
      onError(e) {
        console.error(e);
        if (e.code === "permission-denied" || e.message === "not-found") {
          setBadge("연결 끊김", true);
          toast("이 기기의 연결이 해제됐어요. 상대에게 새 초대 코드를 받아주세요.");
          disconnectLocal(false);
        } else {
          setBadge("오프라인", true);
        }
      },
    });
  }

  function disconnectLocal(keepData) {
    if (unsubscribe) unsubscribe();
    unsubscribe = null;
    session = null; saveSession();
    if (!keepData) state = Object.assign(defaults(), { theme: state.theme });
    save(); boot();
  }

  // ---------- 날짜 계산 ----------
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

  // ---------- 라우팅 ----------
  const TITLES = { home: "홈", calendar: "캘린더", bucket: "버킷리스트", letters: "편지", album: "앨범", settings: "설정" };

  function go(page) {
    $$(".page").forEach((p) => p.classList.toggle("hidden", p.dataset.page !== page));
    $$(".tabbar button").forEach((b) => b.classList.toggle("active", b.dataset.go === page));
    $("#pageTitle").textContent = TITLES[page];
    window.scrollTo(0, 0);
    render();
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-go]");
    if (b) go(b.dataset.go);
    const c = e.target.closest("[data-copy-code]");
    if (c && session?.code) {
      navigator.clipboard?.writeText(session.code).then(() => toast("초대 코드를 복사했어요"), () => toast(session.code));
    }
  });

  // ---------- 테마 ----------
  function applyTheme() {
    const t = state.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.dataset.theme = t;
  }
  $("#themeBtn").addEventListener("click", () => {
    state.theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    save(); applyTheme();
  });

  // ---------- 시작 화면 ----------
  function busy(form, on) { $$("button, input", form).forEach((el) => (el.disabled = on)); }

  $("#setupForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const profile = { p1: f.get("me").trim(), p2: f.get("you").trim(), start: f.get("start"), dayOne: true };
    if (!SHARE_ENABLED) {
      state.profile = profile; save(); boot(); return;
    }
    busy(e.target, true);
    $("#setupMsg").textContent = "우리 공간을 만드는 중…";
    try {
      const s = await sync();
      session = await s.createRoom(profile);
      saveSession();
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
      state = Object.assign(defaults(), { theme: state.theme });
      state.profile = { p1: "", p2: "", start: ymd(today()), dayOne: true }; // 구독으로 곧 채워짐
      save(); boot();
      toast("연결됐어요! 💕");
    } catch (err) {
      console.error(err);
      $("#setupMsg").textContent = err.message || "연결에 실패했어요.";
    } finally {
      busy(e.target, false);
    }
  });

  // ---------- 설정 ----------
  $("#settingsForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    await store.setProfile({
      [role()]: f.get("me").trim(),
      [other()]: f.get("you").trim(),
      start: f.get("start"),
      dayOne: f.get("dayOne") === "on",
    });
    toast("저장했어요.");
  });

  $("#startShareBtn").addEventListener("click", async (e) => {
    e.target.disabled = true;
    try {
      const s = await sync();
      session = await s.createRoom(state.profile, state);
      saveSession(); save();
      connect(); render();
      toast("초대 코드가 만들어졌어요!");
    } catch (err) {
      console.error(err);
      toast("연결에 실패했어요. 인터넷 연결을 확인해주세요.");
    } finally {
      e.target.disabled = false;
    }
  });

  $("#resetInviteBtn").addEventListener("click", async () => {
    if (!confirm("상대 기기의 연결을 끊고 새 초대 코드를 만들까요?\n(상대가 폰을 바꿨거나 앱 데이터를 지웠을 때 사용해요)")) return;
    try {
      const s = await sync();
      session.code = await s.resetInvite(session.roomId, role());
      saveSession(); render();
    } catch (err) {
      console.error(err);
      toast("실패했어요. 인터넷 연결을 확인해주세요.");
    }
  });

  $("#leaveBtn").addEventListener("click", () => {
    if (!confirm("이 기기에서 연결을 끊을까요?\n데이터는 상대 기기와 서버에 그대로 남아요. 다시 연결하려면 상대에게 새 초대 코드를 받아야 해요.")) return;
    disconnectLocal(false);
  });

  $("#exportBtn").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `uridul-backup-${ymd(today())}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  $("#importInput").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (shared()) { toast("공유 중에는 가져오기를 할 수 없어요."); e.target.value = ""; return; }
    try {
      const data = JSON.parse(await file.text());
      if (!data.profile) throw new Error();
      if (data.profile.me !== undefined) data.profile = { p1: data.profile.me, p2: data.profile.you, start: data.profile.start, dayOne: data.profile.dayOne };
      state = Object.assign(defaults(), data);
      save(); boot(); toast("가져오기 완료!");
    } catch {
      toast("올바른 백업 파일이 아니에요.");
    }
    e.target.value = "";
  });

  $("#resetBtn").addEventListener("click", () => {
    const msg = shared()
      ? "이 기기의 데이터를 지우고 연결을 끊을까요?\n(서버와 상대 기기의 데이터는 남아있어요)"
      : "정말 모든 데이터를 지울까요? 되돌릴 수 없어요.";
    if (!confirm(msg)) return;
    disconnectLocal(false);
  });

  // ---------- 기분 ----------
  $$(".mood-pick").forEach((el) => {
    el.innerHTML = MOODS.map((m) => `<button type="button" data-mood="${m}">${m}</button>`).join("");
    el.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      if (el.dataset.who !== "me") { toast("상대의 기분은 상대가 골라요 😉"); return; }
      const k = ymd(today());
      const cur = (state.moods[k] || {})[role()];
      store.setMood(k, role(), cur === b.dataset.mood ? null : b.dataset.mood);
    });
  });

  // ---------- 캘린더 ----------
  let calMonth = new Date(today().getFullYear(), today().getMonth(), 1);
  let selDate = ymd(today());

  $("#prevMonth").addEventListener("click", () => { calMonth.setMonth(calMonth.getMonth() - 1); renderCalendar(); });
  $("#nextMonth").addEventListener("click", () => { calMonth.setMonth(calMonth.getMonth() + 1); renderCalendar(); });
  $("#calGrid").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-date]"); if (!b) return;
    selDate = b.dataset.date;
    const d = parse(selDate);
    if (d.getMonth() !== calMonth.getMonth()) calMonth = new Date(d.getFullYear(), d.getMonth(), 1);
    renderCalendar();
  });
  $("#eventForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const title = e.target.title.value.trim(); if (!title) return;
    store.add("events", { id: uid(), date: selDate, title });
    e.target.reset();
  });
  $("#dayEvents").addEventListener("click", (e) => {
    const b = e.target.closest("[data-del]"); if (!b) return;
    store.remove("events", b.dataset.del);
  });

  // ---------- 버킷리스트 ----------
  $("#bucketForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const title = e.target.title.value.trim(); if (!title) return;
    store.add("bucket", { id: uid(), title, done: false, at: Date.now() });
    e.target.reset();
  });
  $("#bucketList").addEventListener("click", (e) => {
    const del = e.target.closest("[data-del]");
    if (del) { store.remove("bucket", del.dataset.del); return; }
    const chk = e.target.closest("input[data-id]");
    if (chk) store.update("bucket", chk.dataset.id, { done: chk.checked });
  });

  // ---------- 편지 ----------
  $("#letterForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const body = e.target.body.value.trim(); if (!body) return;
    store.add("letters", { id: uid(), from: state.profile[role()], body, at: Date.now() });
    e.target.body.value = "";
  });
  $("#letterList").addEventListener("click", (e) => {
    const b = e.target.closest("[data-del]"); if (!b) return;
    if (!confirm("이 편지를 지울까요?")) return;
    store.remove("letters", b.dataset.del);
  });

  // ---------- 앨범 ----------
  function resizeImage(file, max) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(img.src);
        resolve(c.toDataURL("image/jpeg", 0.75));
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }
  $("#photoInput").addEventListener("change", async (e) => {
    const files = [...e.target.files];
    e.target.value = "";
    if (files.length && shared()) toast("사진을 올리는 중…");
    for (const f of files) {
      try {
        // 공유 모드: 문서 1개당 1MB 제한이 있어 조금 더 작게 저장
        const src = await resizeImage(f, shared() ? 960 : 1080);
        await store.add("photos", { id: uid(), src, at: Date.now() });
      } catch { /* 읽을 수 없는 파일은 건너뜀 */ }
    }
  });
  let viewing = null;
  $("#photoGrid").addEventListener("click", (e) => {
    const img = e.target.closest("img[data-id]"); if (!img) return;
    viewing = img.dataset.id;
    $("#viewerImg").src = img.src;
    $("#viewer").classList.remove("hidden");
  });
  $("#viewerClose").addEventListener("click", () => $("#viewer").classList.add("hidden"));
  $("#viewerDel").addEventListener("click", () => {
    if (!confirm("이 사진을 지울까요?")) return;
    store.remove("photos", viewing);
    $("#viewer").classList.add("hidden");
  });

  // ---------- 렌더 ----------
  const myName = () => state.profile[role()] || "나";
  const partnerName = () => state.profile[other()] || "상대";

  function renderInvite() {
    const code = shared() && memberCount < 2 ? session.code : null;
    $("#inviteBanner").classList.toggle("hidden", !code);
    $("#inviteCodeHome").textContent = code || "";
  }

  function renderHome() {
    const p = state.profile;
    renderInvite();
    const n = ddayCount();
    $("#nameMe").textContent = myName();
    $("#nameYou").textContent = partnerName();
    $("#ddayNum").textContent = n >= 0 ? `D+${n}` : `D${n}`;
    $("#startText").textContent = `${fmt(parse(p.start))}부터 함께`;

    const next = upcomingAnniv(1)[0];
    if (next) {
      const left = diffDays(today(), next.date);
      $("#nextAnniv").textContent = next.label;
      $("#nextAnnivDate").textContent = left === 0 ? "오늘이에요! 🎉" : `${left}일 남음 · ${fmt(next.date)}`;
    }
    const days = Math.max(0, diffDays(parse(p.start), today()));
    $("#togetherWeeks").textContent = `${Math.floor(days / 7).toLocaleString()}주`;
    $("#togetherHours").textContent = `약 ${(days * 24).toLocaleString()}시간`;

    $("#moodMeLabel").textContent = myName();
    $("#moodYouLabel").textContent = partnerName();
    const mood = state.moods[ymd(today())] || {};
    $$(".mood-pick").forEach((el) => {
      const who = el.dataset.who === "me" ? role() : other();
      el.classList.toggle("readonly", el.dataset.who !== "me");
      $$("button", el).forEach((b) => b.classList.toggle("on", mood[who] === b.dataset.mood));
    });

    const t = ymd(today());
    const up = state.events.filter((x) => x.date >= t).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);
    $("#upcomingList").innerHTML = up.length
      ? up.map((x) => `<li><span class="grow">${esc(x.title)}</span><span class="tag">${fmtW(parse(x.date))}</span></li>`).join("")
      : `<li class="empty">예정된 일정이 없어요</li>`;

    $("#annivList").innerHTML = upcomingAnniv(5).map((a) => {
      const left = diffDays(today(), a.date);
      return `<li><span class="grow"><strong>${a.label}</strong> <span class="muted small">${fmt(a.date)}</span></span><span class="tag">${left === 0 ? "오늘" : `D-${left}`}</span></li>`;
    }).join("");

    const l = state.letters[0];
    $("#latestLetter").innerHTML = l
      ? `<div class="letter"><div class="meta"><span class="from">From. ${esc(l.from)}</span><span>${fmt(new Date(l.at))}</span></div><p>${esc(l.body.length > 120 ? l.body.slice(0, 120) + "…" : l.body)}</p></div>`
      : "아직 편지가 없어요.";
  }

  function renderCalendar() {
    const y = calMonth.getFullYear(), m = calMonth.getMonth();
    $("#calTitle").textContent = `${y}년 ${m + 1}월`;
    const first = new Date(y, m, 1);
    const startD = addDays(first, -first.getDay());
    const t = ymd(today());
    const evDates = new Set(state.events.map((x) => x.date));
    const anDates = new Map(anniversaries().map((a) => [ymd(a.date), a.label]));
    anDates.set(state.profile.start, "처음 만난 날");
    let html = "";
    for (let i = 0; i < 42; i++) {
      const d = addDays(startD, i); const k = ymd(d);
      const cls = [d.getMonth() !== m && "other", k === t && "today", k === selDate && "sel", evDates.has(k) && "has", anDates.has(k) && "anniv"].filter(Boolean).join(" ");
      html += `<button type="button" data-date="${k}" class="${cls}">${d.getDate()}</button>`;
    }
    $("#calGrid").innerHTML = html;

    $("#selDateTitle").textContent = fmtW(parse(selDate));
    const items = [];
    if (anDates.has(selDate)) items.push(`<li><span class="grow">♥ ${anDates.get(selDate)}</span><span class="tag">기념일</span></li>`);
    state.events.filter((x) => x.date === selDate).forEach((x) => {
      items.push(`<li><span class="grow">${esc(x.title)}</span><button class="del" data-del="${esc(x.id)}" aria-label="삭제">✕</button></li>`);
    });
    $("#dayEvents").innerHTML = items.join("") || `<li class="empty">일정이 없어요</li>`;
  }

  function renderBucket() {
    const total = state.bucket.length, done = state.bucket.filter((x) => x.done).length;
    $("#bucketCount").textContent = `${done}/${total}`;
    $("#bucketBar").style.width = total ? `${(done / total) * 100}%` : "0";
    const sorted = [...state.bucket].sort((a, b) => a.done - b.done);
    $("#bucketList").innerHTML = sorted.length
      ? sorted.map((x) => `<li class="${x.done ? "done" : ""}"><input type="checkbox" data-id="${esc(x.id)}" ${x.done ? "checked" : ""} /><span class="grow">${esc(x.title)}</span><button class="del" data-del="${esc(x.id)}" aria-label="삭제">✕</button></li>`).join("")
      : `<li class="empty">함께 하고 싶은 일을 적어보세요</li>`;
  }

  function renderLetters() {
    $("#letterFrom").textContent = `From. ${myName()} → To. ${partnerName()}`;
    $("#letterList").innerHTML = state.letters.map((l) => `
      <div class="card letter" style="margin-top:12px">
        <div class="meta"><span class="from">From. ${esc(l.from)}</span><span>${fmt(new Date(l.at))} <button class="link" data-del="${esc(l.id)}">삭제</button></span></div>
        <p>${esc(l.body)}</p>
      </div>`).join("");
  }

  function renderAlbum() {
    $("#photoGrid").innerHTML = state.photos
      .filter((p) => typeof p.src === "string" && p.src.startsWith("data:image/"))
      .map((p) => `<img src="${p.src}" data-id="${esc(p.id)}" alt="사진" loading="lazy" />`).join("");
  }

  function renderSettings() {
    const f = $("#settingsForm"), p = state.profile;
    if (!f.contains(document.activeElement)) {
      f.me.value = p[role()] || ""; f.you.value = p[other()] || ""; f.start.value = p.start; f.dayOne.checked = !!p.dayOne;
    }

    const on = shared();
    $("#shareCard").classList.toggle("hidden", !SHARE_ENABLED && !on);
    const waiting = on && memberCount < 2;
    $("#shareStatus").textContent = !on ? "꺼짐" : waiting ? "대기 중" : "연결됨";
    $("#shareDesc").textContent = !on
      ? "초대 코드를 만들어 상대에게 보내면, 지금까지의 기록이 함께 공유되고 실시간으로 같이 볼 수 있어요."
      : waiting
        ? (session.code ? "상대가 아래 코드를 입력하면 연결돼요. (7일간 유효)" : "상대를 기다리고 있어요. 코드를 잃어버렸다면 새 초대 코드를 만드세요.")
        : `${partnerName()}님과 실시간으로 공유 중이에요.`;
    $("#shareInvite").classList.toggle("hidden", !(waiting && session.code));
    $("#inviteCodeSettings").textContent = session?.code || "";
    $("#startShareBtn").classList.toggle("hidden", on);
    $("#resetInviteBtn").classList.toggle("hidden", !on);
    $("#leaveBtn").classList.toggle("hidden", !on);
  }

  function render() {
    if (!state.profile) return;
    const page = $(".page:not(.hidden)").dataset.page;
    ({ home: renderHome, calendar: renderCalendar, bucket: renderBucket, letters: renderLetters, album: renderAlbum, settings: renderSettings })[page]();
  }

  function boot() {
    applyTheme();
    const ready = !!state.profile;
    $("#setup").classList.toggle("hidden", ready);
    $("#app").classList.toggle("hidden", !ready);
    $("#joinBox").classList.toggle("hidden", !SHARE_ENABLED);
    $("#setupMsg").textContent = "";
    setBadge(null);
    if (ready) {
      if (shared()) connect();
      go("home");
    } else {
      $("#setupForm").start.value = ymd(today());
    }
  }

  boot();
})();
