// Firebase(Firestore) 실시간 공유 모듈
const config = window.FIREBASE_CONFIG;

const V = "10.14.1";
const CDN = `https://www.gstatic.com/firebasejs/${V}`;
export const COLLS = ["events", "bucket", "diary", "records", "expenses", "photos", "places"];
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 헷갈리는 0/O, 1/I 제외
const INVITE_DAYS = 7;

export const enabled = !!(config && config.projectId);

let fs, db, auth;

export async function init() {
  if (db) return;
  const [appMod, authMod, fsMod] = await Promise.all([
    import(`${CDN}/firebase-app.js`),
    import(`${CDN}/firebase-auth.js`),
    import(`${CDN}/firebase-firestore.js`),
  ]);
  fs = fsMod;
  const app = appMod.initializeApp(config);
  auth = authMod.getAuth(app);
  db = fs.getFirestore(app);
  if (config.emulatorHost) {
    authMod.connectAuthEmulator(auth, `http://${config.emulatorHost}:9099`, { disableWarnings: true });
    fs.connectFirestoreEmulator(db, config.emulatorHost, 8080);
  }
  await auth.authStateReady();
  if (!auth.currentUser) await authMod.signInAnonymously(auth);
}

const uid = () => auth.currentUser.uid;
const roomRef = (roomId) => fs.doc(db, "rooms", roomId);

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
  await init();
  const local = JSON.parse(JSON.stringify(localData)); // Firestore가 거부하는 undefined/null 값 제거
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
  return { roomId: ref.id, role: "p1", code };
}

// 초대 코드로 상대 공간에 참여
export async function joinRoom(rawCode) {
  await init();
  const code = rawCode.trim().toUpperCase();
  const inviteRef = fs.doc(db, "invites", code);
  let snap;
  try {
    snap = await fs.getDoc(inviteRef);
  } catch (e) {
    // 없는/만료된 코드는 보안 규칙에서 permission-denied로 거절됨
    if (e.code === "permission-denied") throw new Error("없거나 이미 사용된 초대 코드예요.");
    throw new Error("연결에 실패했어요. 인터넷 연결을 확인해주세요.");
  }
  if (!snap.exists()) throw new Error("없거나 이미 사용된 초대 코드예요.");
  const { roomId, role, expiresAt } = snap.data();
  if (expiresAt.toMillis() < Date.now()) throw new Error("만료된 초대 코드예요.");
  try {
    await fs.updateDoc(roomRef(roomId), { members: fs.arrayUnion(uid()) });
  } catch {
    throw new Error("이미 두 사람이 연결된 공간이에요.");
  }
  await fs.deleteDoc(inviteRef).catch(() => {});
  return { roomId, role };
}

// 상대가 기기를 바꿨을 때: 나만 남기고 새 초대 코드 발급
export async function resetInvite(roomId, myRole) {
  await init();
  await fs.updateDoc(roomRef(roomId), { members: [uid()] });
  return makeInvite(roomId, myRole === "p1" ? "p2" : "p1");
}

// 실시간 구독. onRoom(roomData), onColl(name, items), onError(err)
export function subscribe(roomId, { onRoom, onColl, onError }) {
  const unsubs = [
    fs.onSnapshot(roomRef(roomId), (s) => s.exists() ? onRoom(s.data()) : onError(new Error("not-found")), onError),
    ...COLLS.map((c) =>
      fs.onSnapshot(fs.collection(db, "rooms", roomId, c), (qs) => {
        onColl(c, qs.docs.map((d) => ({ id: d.id, ...d.data() })));
      }, onError)
    ),
  ];
  return () => unsubs.forEach((u) => u());
}

export const ops = {
  add: (roomId, coll, { id, ...data }) => fs.setDoc(fs.doc(db, "rooms", roomId, coll, id), data),
  update: (roomId, coll, id, patch) => fs.updateDoc(fs.doc(db, "rooms", roomId, coll, id), patch),
  remove: (roomId, coll, id) => fs.deleteDoc(fs.doc(db, "rooms", roomId, coll, id)),
  setProfile: (roomId, profile) => fs.updateDoc(roomRef(roomId), { profile }),
  setMood: (roomId, date, role, mood) =>
    fs.updateDoc(roomRef(roomId), new fs.FieldPath("moods", date, role), mood ?? fs.deleteField()),
  memberCount: async (roomId) => (await fs.getDoc(roomRef(roomId))).data().members.length,
};
