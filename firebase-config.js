// Firebase 프로젝트 설정 (README의 "실시간 공유 설정" 참고)
// 이 값들은 공개되어도 되는 클라이언트 설정입니다. 보안은 firestore.rules가 담당해요.
// null로 두면 공유 없이 이 기기에만 저장하는 모드로 동작합니다.

window.FIREBASE_CONFIG = null;

// 예시:
// window.FIREBASE_CONFIG = {
//   apiKey: "AIza...",
//   authDomain: "my-couple-app.firebaseapp.com",
//   projectId: "my-couple-app",
//   storageBucket: "my-couple-app.appspot.com",
//   messagingSenderId: "1234567890",
//   appId: "1:1234567890:web:abcdef",
// };
