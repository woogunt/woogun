// 우리 앱 휴대폰 알림 중계 (Google Apps Script, 무료)
// 앱에서 {token, title, body}를 보내면 Firebase Cloud Messaging으로 상대 폰에 알림을 보냅니다.
const PROJECT_ID = "woogunt-a9c74";
const APP_URL = "https://woogunt-a9c74.web.app/";

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    if (!d.token || typeof d.token !== "string" || d.token.length > 400) return out({ ok: false, error: "bad token" });
    const message = {
      message: {
        token: d.token,
        webpush: {
          notification: {
            title: String(d.title || "우리 앱").slice(0, 80),
            body: String(d.body || "").slice(0, 200),
            icon: APP_URL + "icon-192.png",
          },
          fcm_options: { link: APP_URL },
        },
      },
    };
    const res = UrlFetchApp.fetch("https://fcm.googleapis.com/v1/projects/" + PROJECT_ID + "/messages:send", {
      method: "post",
      contentType: "application/json",
      headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken(), "x-goog-user-project": PROJECT_ID },
      payload: JSON.stringify(message),
      muteHttpExceptions: true,
    });
    return out({ ok: res.getResponseCode() === 200, code: res.getResponseCode(), detail: res.getResponseCode() === 200 ? "" : res.getContentText().slice(0, 300) });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  }
}

function doGet() {
  return out({ ok: true, service: "uridul-push" });
}

// 처음 한 번 실행해서 권한을 허용하는 용도
function authorize() {
  ScriptApp.getOAuthToken();
  UrlFetchApp.fetch("https://www.google.com");
}

function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
