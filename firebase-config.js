// Firebase 프로젝트 설정 (README의 "둘이 같이 쓰기 — 방법 2" 참고)
// 이 값들은 공개되어도 되는 클라이언트 설정입니다. 보안은 firestore.rules가 담당해요.
// null로 두면 공유 없이 이 기기에만 저장하는 모드로 동작합니다.

window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyAweHUVyxvmYrIDbVEKGSv5qnfKhRbW3pA",
  // 아이폰 사파리/홈 화면 앱에서 구글 로그인이 잘 되도록 호스팅 주소(web.app)를 사용
  authDomain: "woogunt-a9c74.web.app",
  projectId: "woogunt-a9c74",
  storageBucket: "woogunt-a9c74.firebasestorage.app",
  messagingSenderId: "502888567138",
  appId: "1:502888567138:web:84de079bd2f185cf0b9c3b",
};
