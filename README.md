# 우리둘 💕

커플을 위한 모바일 웹앱. 두 사람이 초대 코드로 연결하면 일정·버킷리스트·편지·사진·기분이 **실시간으로 공유**됩니다.

## 기능
- **홈 대시보드**: D+day, 다음 기념일까지 남은 날, 함께한 주/시간, 오늘의 기분(각자 자기 기분 선택), 다가오는 일정, 기념일, 최근 편지
- **캘린더**: 월별 달력, 날짜별 일정, 100일 단위·매년 기념일 자동 표시
- **버킷리스트**: 함께 하고 싶은 일 체크리스트 + 진행률
- **편지**: 서로에게 편지 남기기
- **앨범**: 사진 업로드(자동 리사이즈), 크게 보기/삭제
- **설정**: 이름·처음 만난 날 수정, 실시간 공유 관리, 백업 내보내기/가져오기, 다크 모드

## 실시간 공유 설정 (Firebase, 무료 요금제로 충분)

1. https://console.firebase.google.com 에서 **프로젝트 만들기**
2. **빌드 → Authentication → 시작하기 → 로그인 방법 → 익명** 사용 설정
3. **빌드 → Firestore Database → 데이터베이스 만들기** (위치: `asia-northeast3 (서울)`, 프로덕션 모드)
4. **프로젝트 설정(⚙) → 내 앱 → 웹 앱(</>) 추가** → 나오는 `firebaseConfig` 값을 `firebase-config.js`에 붙여넣기
   ```js
   window.FIREBASE_CONFIG = { apiKey: "...", authDomain: "...", projectId: "...", appId: "..." };
   ```
5. 보안 규칙 적용 + 배포 (PC에 Node.js 필요)
   ```bash
   npm i -g firebase-tools
   firebase login
   firebase use --add          # 만든 프로젝트 선택
   firebase deploy             # firestore.rules + 웹앱 호스팅 배포
   ```
   배포가 끝나면 나오는 `https://<프로젝트>.web.app` 주소를 둘 다 폰에서 열고, **공유 → 홈 화면에 추가**하면 앱처럼 쓸 수 있어요.

> `firebase-config.js`의 값은 공개돼도 괜찮은 클라이언트 설정이에요. 데이터 보호는 `firestore.rules`가 담당합니다 (연결된 두 사람만 읽기/쓰기 가능).

## 사용 방법
1. 한 사람이 **새로 시작하기** → 홈 화면에 6자리 **초대 코드**가 나옴
2. 상대는 시작 화면의 **초대 코드로 연결하기**에 코드 입력 → 연결 완료
3. 상대가 폰을 바꾸면: 설정 → **상대 기기 다시 연결** → 새 코드를 상대에게 전달

`firebase-config.js`가 `null`이면 공유 없이 이 기기에만 저장하는 모드로 동작합니다 (`index.html`을 바로 열어도 됨).

## 파일 구조
| 파일 | 역할 |
|---|---|
| `index.html`, `style.css` | 화면 |
| `app.js` | 앱 로직 (로컬/공유 모드 공통) |
| `sync.js` | Firebase 실시간 동기화, 초대 코드 |
| `firebase-config.js` | Firebase 프로젝트 설정 |
| `firestore.rules` | 데이터 보안 규칙 |
| `firebase.json` | 배포·에뮬레이터 설정 |

## 참고
- 사진은 Firestore 문서에 압축해서 저장해요 (장당 약 100~300KB). 무료 요금제 저장 용량은 1GB입니다.
