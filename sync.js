// Firebase(Firestore) 실시간 공유 모듈
//   - 로그인: 구글 로그인(추천) 또는 로그인 없이(익명)
//   - 연결: 초대 링크(?invite=코드) 또는 6자리 초대 코드
//   - users/{uid} 에 내 공간을 기억해 두어서, 구글 로그인이면 폰을 바꿔도 그대로 이어짐
const config = window.FIREBASE_CONFIG;

const V = "10.14.1";
const CDN = `https://www.gstatic.com/firebasejs/${V}`;
export const COLLS = ["events", "bucket", "diary", "comments", "records", "expenses", "photos", "places"];
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 헷갈리는 0/O, 1/I 제외
const INVITE_DAYS = 7;

export const enabled = !!(config && config.projectId);

let fs, db, auth, A, appInst, M, messaging;

export async function init() {
  if (db) return;
  const [appMod, authMod, fsMod] = await Promise.all([
    import(`${CDN}/firebase-app.js`),
    import(`${CDN}/firebase-auth.js`),
    import(`${CDN}/firebase-firestore.js`),
  ]);
  fs = fsMod;
  A = authMod;
  const app = appMod.initializeApp(config);
  appInst = app;
  auth = A.getAuth(app);
  db = fs.getFirestore(app);
  if (config.emulatorHost) {
    A.connectAuthEmulator(auth, `http://${config.emulatorHost}:9099`, { disableWarnings: true });
    fs.connectFirestoreEmulator(db, config.emulatorHost, 8080);
  }
  await auth.authStateReady();
  // 리다이렉트 방식으로 로그인하고 돌아온 경우에만 결과 확인 (오류만 기록)
  if (sessionStorage.getItem("uridul-redirect")) {
    sessionStorage.removeItem("uridul-redirect");
    try { await A.getRedirectResult(auth); } catch (e) { console.warn("redirect result", e.code); }
  }
}

// ---------- 로그인 ----------
export function currentUser() {
  const u = auth && auth.currentUser;
  if (!u) return null;
  return { uid: u.uid, isAnonymous: u.isAnonymous, email: u.email || "", name: u.displayName || "" };
}

function googleProvider() {
  const p = new A.GoogleAuthProvider();
  p.setCustomParameters({ prompt: "select_account" });
  return p;
}

const POPUP_FALLBACK = ["auth/popup-blocked", "auth/operation-not-supported-in-this-environment", "auth/web-storage-unsupported"];

export async function signInGoogle() {
  await init();
  try {
    await A.signInWithPopup(auth, googleProvider());
  } catch (e) {
    if (POPUP_FALLBACK.includes(e.code)) { sessionStorage.setItem("uridul-redirect", "1"); return A.signInWithRedirect(auth, googleProvider()); } // 페이지가 이동함
    if (e.code === "auth/popup-closed-by-user" || e.code === "auth/cancelled-popup-request") throw friendly("로그인을 취소했어요.");
    throw friendly("구글 로그인에 실패했어요. 잠시 후 다시 시도해주세요.", e);
  }
  return currentUser();
}

export async function signInAnon() {
  await init();
  if (!auth.currentUser) await A.signInAnonymously(auth);
  return currentUser();
}

// 로그인 없이 쓰던 사람이 구글 계정을 연결 (같은 사용자로 유지되어 기록 그대로)
export async function linkGoogle() {
  await init();
  if (!auth.currentUser) return signInGoogle();
  try {
    await A.linkWithPopup(auth.currentUser, googleProvider());
  } catch (e) {
    if (e.code === "auth/credential-already-in-use" || e.code === "auth/email-already-in-use")
      throw friendly("이 구글 계정은 이미 다른 기기의 기록에 연결돼 있어요. 그 계정으로 로그인하면 그 기록이 열려요.");
    if (e.code === "auth/popup-closed-by-user" || e.code === "auth/cancelled-popup-request") throw friendly("연결을 취소했어요.");
    if (POPUP_FALLBACK.includes(e.code)) { sessionStorage.setItem("uridul-redirect", "1"); return A.linkWithRedirect(auth.currentUser, googleProvider()); }
    throw friendly("구글 계정 연결에 실패했어요.", e);
  }
  return currentUser();
}

export async function signOut() {
  await init();
  await A.signOut(auth);
}

function friendly(message, cause) {
  if (cause) console.error(cause);
  return Object.assign(new Error(message), { friendly: true });
}

const uid = () => auth.currentUser.uid;
const roomRef = (roomId) => fs.doc(db, "rooms", roomId);
const userRef = () => fs.doc(db, "users", uid());

async function ensureUser() {
  await init();
  if (!auth.currentUser) await A.signInAnonymously(auth);
}

// ---------- 내 공간 기억하기 ----------
export async function myRoom() {
  await init();
  if (!auth.currentUser) return null;
  try {
    const s = await fs.getDoc(userRef());
    if (!s.exists()) return null;
    const { roomId, role } = s.data();
    const r = await fs.getDoc(roomRef(roomId)); // 아직 멤버인지 확인 (아니면 권한 오류)
    if (!r.exists()) return null;
    return { roomId, role };
  } catch {
    return null;
  }
}

export async function remember(roomId, role) {
  await init();
  if (!auth.currentUser) return;
  // merge: 같은 문서에 저장한 내 기기 설정(prefs)은 지우지 않음
  await fs.setDoc(userRef(), { roomId, role, at: Date.now() }, { merge: true }).catch((e) => console.warn("remember", e.code));
}

// 내 기기 설정 (배경화면·블럭 유리 효과 등) — 앱을 지웠다 다시 깔아도 로그인하면 돌아오도록
export async function loadPrefs() {
  await init();
  if (!auth.currentUser) return null;
  try {
    const s = await fs.getDoc(userRef());
    return s.exists() ? s.data().prefs || null : null;
  } catch { return null; }
}
export async function savePrefs(prefs) {
  await init();
  if (!auth.currentUser) return;
  await fs.setDoc(userRef(), { prefs }, { merge: true });
}

// ---------- 초대 ----------
function randomCode(len = 6) {
  const buf = crypto.getRandomValues(new Uint32Array(len));
  return [...buf].map((n) => CODE_CHARS[n % CODE_CHARS.length]).join("");
}

async function makeInvite(roomId, role) {
  const code = randomCode();
  const expiresAt = fs.Timestamp.fromMillis(Date.now() + INVITE_DAYS * 86400000);
  await fs.setDoc(fs.doc(db, "invites", code), { roomId, role, expiresAt });
  return code;
}

// 새 커플 공간 만들기. local 데이터가 있으면 함께 올림.
export async function createRoom(profile, localData = {}) {
  await ensureUser();
  const local = JSON.parse(JSON.stringify(localData)); // Firestore가 거부하는 undefined 값 제거
  const ref = fs.doc(fs.collection(db, "rooms"));
  await fs.setDoc(ref, {
    members: [uid()],
    profile,
    moods: local.moods || {},
    createdAt: fs.serverTimestamp(),
  });
  // 기존 데이터 업로드 (사진이 들어있을 수 있어 문서별로 저장)
  const writes = [];
  for (const coll of COLLS) {
    for (const { id, ...rest } of local[coll] || []) {
      writes.push(fs.setDoc(fs.doc(db, "rooms", ref.id, coll, id), rest));
    }
  }
  await Promise.all(writes);
  const code = await makeInvite(ref.id, "p2");
  await remember(ref.id, "p1");
  return { roomId: ref.id, role: "p1", code };
}

// 초대 코드(또는 초대 링크의 코드)로 상대 공간에 참여
export async function joinRoom(rawCode) {
  await ensureUser();
  const code = String(rawCode || "").trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(code)) throw friendly("초대 코드는 6자리예요.");
  const inviteRef = fs.doc(db, "invites", code);
  let snap;
  try {
    snap = await fs.getDoc(inviteRef);
  } catch (e) {
    // 없는/만료된 코드는 보안 규칙에서 permission-denied로 거절됨
    if (e.code === "permission-denied") throw friendly("없거나 이미 사용된 초대예요. 상대에게 새 초대 링크를 받아주세요.");
    throw friendly("연결에 실패했어요. 인터넷 연결을 확인해주세요.", e);
  }
  if (!snap.exists()) throw friendly("없거나 이미 사용된 초대예요. 상대에게 새 초대 링크를 받아주세요.");
  const { roomId, role, expiresAt } = snap.data();
  if (expiresAt.toMillis() < Date.now()) throw friendly("만료된 초대예요. 상대에게 새 초대 링크를 받아주세요.");
  try {
    await fs.updateDoc(roomRef(roomId), { members: fs.arrayUnion(uid()) });
  } catch {
    throw friendly("이미 두 사람이 연결된 공간이에요.");
  }
  await fs.deleteDoc(inviteRef).catch(() => {});
  await remember(roomId, role);
  return { roomId, role };
}

// 상대가 기기를 바꿨을 때(로그인 없이 쓰던 경우): 나만 남기고 새 초대 발급
export async function resetInvite(roomId, myRole) {
  await init();
  await fs.updateDoc(roomRef(roomId), { members: [uid()] });
  return makeInvite(roomId, myRole === "p1" ? "p2" : "p1");
}

// 쓰지 않을 초대 지우기 (예: 내 자리를 바꿔서 상대 자리가 달라졌을 때)
export async function deleteInvite(code) {
  await init();
  if (code) await fs.deleteDoc(fs.doc(db, "invites", code)).catch(() => {});
}

// 초대 코드를 잃어버렸을 때 새로 발급 (멤버는 그대로)
export async function newInvite(roomId, myRole) {
  await init();
  return makeInvite(roomId, myRole === "p1" ? "p2" : "p1");
}

// 실시간 구독. onRoom(roomData), onColl(name, items), onError(err)
export function subscribe(roomId, { onRoom, onColl, onError }) {
  const unsubs = [
    fs.onSnapshot(roomRef(roomId), (s) => s.exists() ? onRoom(s.data()) : onError(new Error("not-found")), onError),
    ...COLLS.map((c) =>
      fs.onSnapshot(fs.collection(db, "rooms", roomId, c), (qs) => {
        onColl(c, qs.docs.map((d) => ({ id: d.id, ...d.data() })));
      }, (e) => onError(Object.assign(e, { coll: c }))) // 목록 하나가 실패해도 연결 자체는 유지
    ),
  ];
  return () => unsubs.forEach((u) => u());
}

export const ops = {
  add: (roomId, coll, { id, ...data }) => fs.setDoc(fs.doc(db, "rooms", roomId, coll, id), JSON.parse(JSON.stringify(data))),
  update: (roomId, coll, id, patch) => fs.updateDoc(fs.doc(db, "rooms", roomId, coll, id), JSON.parse(JSON.stringify(patch))),
  remove: (roomId, coll, id) => fs.deleteDoc(fs.doc(db, "rooms", roomId, coll, id)),
  setProfile: (roomId, profile) => fs.updateDoc(roomRef(roomId), { profile }),
  setWidgets: (roomId, widgets) => fs.updateDoc(roomRef(roomId), { widgets }),
  // 이 사람의 휴대폰 알림 토큰 (FCM). 비우면 알림 끔
  setPushToken: (roomId, role, token) =>
    fs.updateDoc(roomRef(roomId), new fs.FieldPath("push", role), token || fs.deleteField()),
  setMood: (roomId, date, role, mood) =>
    fs.updateDoc(roomRef(roomId), new fs.FieldPath("moods", date, role), mood ?? fs.deleteField()),
};

// ---------- 휴대폰 알림 (Firebase Cloud Messaging, 무료) ----------
async function loadMessaging() {
  if (messaging) return messaging;
  await init();
  M = await import(`${CDN}/firebase-messaging.js`);
  if (!(await M.isSupported())) return null;
  messaging = M.getMessaging(appInst);
  return messaging;
}
export async function pushSupported() {
  try { return !!(await loadMessaging()); } catch { return false; }
}
// 알림 허용은 버튼을 누른 순간에 이미 받아둔 상태여야 함
export async function enablePush(vapidKey) {
  const m = await loadMessaging();
  if (!m) throw friendly("이 브라우저에서는 휴대폰 알림을 쓸 수 없어요.");
  const reg = await navigator.serviceWorker.register("firebase-messaging-sw.js");
  await navigator.serviceWorker.ready;
  const token = await M.getToken(m, { vapidKey, serviceWorkerRegistration: reg });
  if (!token) throw friendly("알림 토큰을 받지 못했어요. 알림 허용을 확인해주세요.");
  return token;
}
export async function disablePush() {
  try { const m = await loadMessaging(); if (m) await M.deleteToken(m); } catch { /* 무시 */ }
}
// 앱을 보고 있을 때 온 알림 (폰 알림 대신 앱 안에서 보여줌)
export async function onForegroundPush(cb) {
  try { const m = await loadMessaging(); if (m) M.onMessage(m, cb); } catch { /* 무시 */ }
}

// ---------- 영상: 무료 요금제에는 파일 저장소가 없어, 조각(900KB)으로 나눠 Firestore에 저장 ----------
const MEDIA_CHUNK = 900 * 1024;
const mediaRef = (roomId, id, i) => fs.doc(db, "rooms", roomId, "media", `${id}_${i}`);
export async function putMedia(roomId, id, blob, onProgress) {
  await init();
  const buf = new Uint8Array(await blob.arrayBuffer());
  const n = Math.ceil(buf.length / MEDIA_CHUNK);
  for (let i = 0; i < n; i++) {
    await fs.setDoc(mediaRef(roomId, id, i), { i, data: fs.Bytes.fromUint8Array(buf.subarray(i * MEDIA_CHUNK, (i + 1) * MEDIA_CHUNK)) });
    if (onProgress) onProgress((i + 1) / n);
  }
  return n;
}
export async function getMedia(roomId, id, n, mime) {
  await init();
  const snaps = await Promise.all(Array.from({ length: n }, (_, i) => fs.getDoc(mediaRef(roomId, id, i))));
  if (snaps.some((s) => !s.exists())) throw new Error("media missing");
  return new Blob(snaps.map((s) => s.data().data.toUint8Array()), { type: mime || "video/mp4" });
}
export async function deleteMedia(roomId, id, n) {
  await init();
  await Promise.all(Array.from({ length: n }, (_, i) => fs.deleteDoc(mediaRef(roomId, id, i)).catch(() => {})));
}
