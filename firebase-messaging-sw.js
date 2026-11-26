// 휴대폰 알림을 받는 서비스 워커 (앱이 꺼져 있어도 알림 표시)
self.window = self; // firebase-config.js 가 window.FIREBASE_CONFIG 에 설정을 넣음
importScripts("firebase-config.js");
importScripts(
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js"
);
firebase.initializeApp(self.FIREBASE_CONFIG);
const messaging = firebase.messaging();

// 알림 내용(webpush.notification)이 있으면 Firebase가 자동으로 알림을 띄워요.
// 알림을 누르면 앱을 열거나, 열려 있으면 그 창으로
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL("./", self.location.href).href;
  event.waitUntil((async () => {
    const all = await clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) if (c.url.startsWith(url) && "focus" in c) return c.focus();
    return clients.openWindow(url);
  })());
});
