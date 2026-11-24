(() => {
  "use strict";

  const KEY = "uridul-v1";
  const MOODS = ["😊", "🥰", "😴", "😢", "😠", "🤒"];
  const DAY = 86400000;

  // ---------- 저장소 ----------
  const defaults = () => ({
    profile: null, // { me, you, start, dayOne }
    events: [],    // { id, date, title }
    bucket: [],    // { id, title, done }
    letters: [],   // { id, from, body, at }
    photos: [],    // { id, src, at }
    moods: {},     // { "YYYY-MM-DD": { me, you } }
    theme: null,
  });

  let state;
  try {
    state = Object.assign(defaults(), JSON.parse(localStorage.getItem(KEY) || "{}"));
  } catch {
    state = defaults();
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      alert("저장 공간이 부족해요. 사진을 몇 장 지워주세요.");
    }
  }

  // ---------- 유틸 ----------
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const pad = (n) => String(n).padStart(2, "0");
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
  const diffDays = (a, b) => Math.round((parse(ymd(b)) - parse(ymd(a))) / DAY);
  const fmt = (d) => `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
  const WD = ["일", "월", "화", "수", "목", "금", "토"];
  const fmtW = (d) => `${d.getMonth() + 1}월 ${d.getDate()}일 (${WD[d.getDay()]})`;

  function ddayCount() {
    const p = state.profile;
    return diffDays(parse(p.start), today()) + (p.dayOne ? 1 : 0);
  }

  // 기념일 목록 (100일 단위 + 매년)
  function anniversaries(limitYears = 30) {
    const p = state.profile;
    const start = parse(p.start);
    const offset = p.dayOne ? 1 : 0;
    const list = [];
    for (let n = 100; n <= 365 * limitYears; n += 100) {
      list.push({ label: `${n}일`, date: addDays(start, n - offset) });
    }
    for (let y = 1; y <= limitYears; y++) {
      const d = new Date(start); d.setFullYear(start.getFullYear() + y);
      list.push({ label: `${y}주년`, date: d });
    }
    return list.sort((a, b) => a.date - b.date);
  }

  function upcomingAnniv(count) {
    const t = today();
    return anniversaries().filter((a) => a.date >= t).slice(0, count);
  }

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

  // ---------- 설정 / 시작 ----------
  $("#setupForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    state.profile = { me: f.get("me").trim(), you: f.get("you").trim(), start: f.get("start"), dayOne: true };
    save(); boot();
  });

  $("#settingsForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    state.profile = { me: f.get("me").trim(), you: f.get("you").trim(), start: f.get("start"), dayOne: f.get("dayOne") === "on" };
    save(); alert("저장했어요."); render();
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
    try {
      const data = JSON.parse(await file.text());
      if (!data.profile) throw new Error();
      state = Object.assign(defaults(), data);
      save(); boot(); alert("가져오기 완료!");
    } catch {
      alert("올바른 백업 파일이 아니에요.");
    }
    e.target.value = "";
  });

  $("#resetBtn").addEventListener("click", () => {
    if (!confirm("정말 모든 데이터를 지울까요? 되돌릴 수 없어요.")) return;
    state = defaults(); save(); boot();
  });

  // ---------- 기분 ----------
  $$(".mood-pick").forEach((el) => {
    el.innerHTML = MOODS.map((m) => `<button type="button" data-mood="${m}">${m}</button>`).join("");
    el.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      const k = ymd(today());
      const cur = state.moods[k] || {};
      cur[el.dataset.who] = cur[el.dataset.who] === b.dataset.mood ? null : b.dataset.mood;
      state.moods[k] = cur;
      save(); renderHome();
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
    state.events.push({ id: uid(), date: selDate, title });
    e.target.reset(); save(); renderCalendar();
  });
  $("#dayEvents").addEventListener("click", (e) => {
    const b = e.target.closest("[data-del]"); if (!b) return;
    state.events = state.events.filter((x) => x.id !== b.dataset.del);
    save(); renderCalendar();
  });

  // ---------- 버킷리스트 ----------
  $("#bucketForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const title = e.target.title.value.trim(); if (!title) return;
    state.bucket.unshift({ id: uid(), title, done: false });
    e.target.reset(); save(); renderBucket();
  });
  $("#bucketList").addEventListener("click", (e) => {
    const del = e.target.closest("[data-del]");
    if (del) { state.bucket = state.bucket.filter((x) => x.id !== del.dataset.del); save(); renderBucket(); return; }
    const chk = e.target.closest("input[data-id]");
    if (chk) { const it = state.bucket.find((x) => x.id === chk.dataset.id); it.done = chk.checked; save(); renderBucket(); }
  });

  // ---------- 편지 ----------
  $("#letterForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const body = e.target.body.value.trim(); if (!body) return;
    state.letters.unshift({ id: uid(), from: e.target.from.value, body, at: Date.now() });
    e.target.body.value = ""; save(); renderLetters();
  });
  $("#letterList").addEventListener("click", (e) => {
    const b = e.target.closest("[data-del]"); if (!b) return;
    if (!confirm("이 편지를 지울까요?")) return;
    state.letters = state.letters.filter((x) => x.id !== b.dataset.del);
    save(); renderLetters();
  });

  // ---------- 앨범 ----------
  function resizeImage(file, max = 1080) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(img.src);
        resolve(c.toDataURL("image/jpeg", 0.8));
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }
  $("#photoInput").addEventListener("change", async (e) => {
    for (const f of e.target.files) {
      try { state.photos.unshift({ id: uid(), src: await resizeImage(f), at: Date.now() }); } catch { /* skip */ }
    }
    e.target.value = ""; save(); renderAlbum();
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
    state.photos = state.photos.filter((p) => p.id !== viewing);
    save(); $("#viewer").classList.add("hidden"); renderAlbum();
  });

  // ---------- 렌더 ----------
  function renderHome() {
    const p = state.profile;
    const n = ddayCount();
    $("#nameMe").textContent = p.me;
    $("#nameYou").textContent = p.you;
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

    $("#moodMeLabel").textContent = p.me;
    $("#moodYouLabel").textContent = p.you;
    const mood = state.moods[ymd(today())] || {};
    $$(".mood-pick").forEach((el) => {
      $$("button", el).forEach((b) => b.classList.toggle("on", mood[el.dataset.who] === b.dataset.mood));
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
      items.push(`<li><span class="grow">${esc(x.title)}</span><button class="del" data-del="${x.id}" aria-label="삭제">✕</button></li>`);
    });
    $("#dayEvents").innerHTML = items.join("") || `<li class="empty">일정이 없어요</li>`;
  }

  function renderBucket() {
    const total = state.bucket.length, done = state.bucket.filter((x) => x.done).length;
    $("#bucketCount").textContent = `${done}/${total}`;
    $("#bucketBar").style.width = total ? `${(done / total) * 100}%` : "0";
    const sorted = [...state.bucket].sort((a, b) => a.done - b.done);
    $("#bucketList").innerHTML = sorted.length
      ? sorted.map((x) => `<li class="${x.done ? "done" : ""}"><input type="checkbox" data-id="${x.id}" ${x.done ? "checked" : ""} /><span class="grow">${esc(x.title)}</span><button class="del" data-del="${x.id}" aria-label="삭제">✕</button></li>`).join("")
      : `<li class="empty">함께 하고 싶은 일을 적어보세요</li>`;
  }

  function renderLetters() {
    const p = state.profile;
    const sel = $("#letterFrom"); const prev = sel.value;
    sel.innerHTML = [p.me, p.you].map((n) => `<option>${esc(n)}</option>`).join("");
    if (prev) sel.value = prev;
    $("#letterList").innerHTML = state.letters.map((l) => `
      <div class="card letter" style="margin-top:12px">
        <div class="meta"><span class="from">From. ${esc(l.from)}</span><span>${fmt(new Date(l.at))} <button class="link" data-del="${l.id}">삭제</button></span></div>
        <p>${esc(l.body)}</p>
      </div>`).join("");
  }

  function renderAlbum() {
    $("#photoGrid").innerHTML = state.photos.map((p) => `<img src="${p.src}" data-id="${p.id}" alt="사진" loading="lazy" />`).join("");
  }

  function renderSettings() {
    const f = $("#settingsForm"), p = state.profile;
    f.me.value = p.me; f.you.value = p.you; f.start.value = p.start; f.dayOne.checked = !!p.dayOne;
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
    if (ready) go("home");
    else $("#setupForm").start.value = ymd(today());
  }

  boot();
})();
