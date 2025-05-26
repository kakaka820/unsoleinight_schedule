// Firebase初期化
const firebaseConfig = {
  apiKey: "AIzaSyBzYCHcumBzRw3DLs8mjLiGTiXxvxmjLDU",
  authDomain: "unsoleinight-schedule.firebaseapp.com",
  projectId: "unsoleinight-schedule",
  storageBucket: "unsoleinight-schedule.firebasestorage.app",
  messagingSenderId: "1040333692698",
  appId: "1:1040333692698:web:fb0e4f481dff8167f756a3"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let currentUserId = "";
let currentUid = "";

// 管理者認証情報（仮）
const ADMIN_ID = "admin";
const ADMIN_PW = "password";

// --- 定員管理 ---

async function getMaxCapacity() {
  try {
    const doc = await db.collection("settings").doc("capacity").get();
    if (doc.exists) {
      const data = doc.data();
      return data.maxCapacity || 3;
    }
  } catch (e) {
    console.error("定員取得失敗:", e);
  }
  return 3;
}

async function displayMaxCapacity() {
  const current = await getMaxCapacity();
  document.getElementById("currentCapacity").textContent = current + "人";
}

async function updateMaxCapacity() {
  const newMax = parseInt(document.getElementById("newMax").value);
  const msgEl = document.getElementById("adminMessage");
  if (!newMax || newMax < 1) {
    msgEl.textContent = "1以上の数字を入力してください。";
    msgEl.style.color = "red";
    return;
  }
  try {
    const ref = db.collection("settings").doc("capacity");
    const beforeDoc = await ref.get();
    const beforeData = beforeDoc.exists ? beforeDoc.data() : {};
    const beforeVal = beforeData.maxCapacity || null;

    await ref.set({ maxCapacity: newMax });

    msgEl.textContent = `定員数を${newMax}人に更新しました。`;
    msgEl.style.color = "green";
    document.getElementById("currentCapacity").textContent = newMax + "人";

    // ログ保存
    await saveLog({
      user: currentUserId,
      uid: currentUid,
      from: { maxCapacity: beforeVal },
      to: { maxCapacity: newMax },
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (e) {
    msgEl.textContent = "更新に失敗しました。";
    msgEl.style.color = "red";
    console.error(e);
  }
}

// --- 日程管理 ---

async function getEventDates() {
  try {
    const doc = await db.collection("settings").doc("eventDates").get();
    if (doc.exists) {
      const data = doc.data();
      return data.list || [];
    }
  } catch (e) {
    console.error("日程取得失敗:", e);
  }
  return [];
}

async function displayEventDates() {
  const dates = await getEventDates();
  const ul = document.getElementById("datesList");
  ul.innerHTML = "";
  dates.forEach((date, index) => {
    const li = document.createElement("li");
    li.textContent = date;
    const delBtn = document.createElement("button");
    delBtn.textContent = "削除";
    delBtn.addEventListener("click", () => removeDate(index));
    li.appendChild(delBtn);
    ul.appendChild(li);
  });
}

async function addDate() {
  const input = document.getElementById("newDateInput");
  const newDate = input.value.trim();
  const msgEl = document.getElementById("datesMessage");
  if (!newDate) {
    msgEl.textContent = "日程を入力してください。";
    msgEl.style.color = "red";
    return;
  }
  try {
    const ref = db.collection("settings").doc("eventDates");
    const doc = await ref.get();
    const beforeDates = doc.exists ? doc.data().list || [] : [];
    if (beforeDates.includes(newDate)) {
      msgEl.textContent = "同じ日程が既にあります。";
      msgEl.style.color = "red";
      return;
    }
    const newDates = [...beforeDates, newDate];
    await ref.set({ list: newDates });

    msgEl.textContent = "日程を追加しました。";
    msgEl.style.color = "green";
    input.value = "";
    await displayEventDates();

    // ログ保存
    await saveLog({
      user: currentUserId,
      uid: currentUid,
      from: { list: beforeDates },
      to: { list: newDates },
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (e) {
    msgEl.textContent = "追加に失敗しました。";
    msgEl.style.color = "red";
    console.error(e);
  }
}

async function removeDate(index) {
  const msgEl = document.getElementById("datesMessage");
  try {
    const ref = db.collection("settings").doc("eventDates");
    const doc = await ref.get();
    const beforeDates = doc.exists ? doc.data().list || [] : [];
    if (index < 0 || index >= beforeDates.length) {
      msgEl.textContent = "不正なインデックスです。";
      msgEl.style.color = "red";
      return;
    }
    const newDates = beforeDates.filter((_, i) => i !== index);
    await ref.set({ list: newDates });
    msgEl.textContent = "日程を削除しました。";
    msgEl.style.color = "green";
    await displayEventDates();

    // ログ保存
    await saveLog({
      user: currentUserId,
      uid: currentUid,
      from: { list: beforeDates },
      to: { list: newDates },
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (e) {
    msgEl.textContent = "削除に失敗しました。";
    msgEl.style.color = "red";
    console.error(e);
  }
}

// --- ログ機能 ---

async function saveLog(logData) {
  try {
    await db.collection("logs").add({
      user: logData.user || "unknown",
      uid: logData.uid || "",
      from: logData.from || {},
      to: logData.to || {},
      timestamp: logData.timestamp || firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (e) {
    console.error("ログ保存エラー:", e);
  }
}

async function getLogs(filterUser = "", filterDate = "") {
  try {
    let query = db.collection("logs").orderBy("timestamp", "desc");
    const snapshot = await query.get();
    const logs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp ? doc.data().timestamp.toDate() : null
    }));

    // フィルター適用
    return logs.filter(log => {
      let ok = true;
      if (filterUser) {
        ok = ok && log.user.toLowerCase().includes(filterUser.toLowerCase());
      }
      if (filterDate) {
        if (log.timestamp) {
          const yyyyMMdd = log.timestamp.toISOString().slice(0, 10);
          ok = ok && (yyyyMMdd === filterDate);
        } else {
          ok = false;
        }
      }
      return ok;
    });
  } catch (e) {
    console.error("ログ取得失敗:", e);
    return [];
  }
}

async function displayLogs(filterUser = "", filterDate = "") {
  const logs = await getLogs(filterUser, filterDate);
  const tbody = document.querySelector("#logTable tbody");
  tbody.innerHTML = "";
  if (logs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">ログがありません。</td></tr>`;
    return;
  }

  logs.forEach(log => {
    const tr = document.createElement("tr");

    // ユーザー
    const userTd = document.createElement("td");
    userTd.textContent = log.userId;
    tr.appendChild(userTd);

    // UID
    const uidTd = document.createElement("td");
    uidTd.textContent = log.uid || "";
    tr.appendChild(uidTd);

    // from（元の状態）
    const fromTd = document.createElement("td");
    fromTd.textContent = JSON.stringify(log.from);
    tr.appendChild(fromTd);

    // to（更新した状態）
    const toTd = document.createElement("td");
    toTd.textContent = JSON.stringify(log.to);
    tr.appendChild(toTd);

    // 日付（stringsで保存されているdateフィールドをそのまま表示）
const dateTd = document.createElement("td");
if (log.date) {
  dateTd.textContent = log.date;
} else {
  dateTd.textContent = "-";
}
tr.appendChild(dateTd);

// 時刻（timestampフィールドの値をDateオブジェクトに変換して表示）
const timeTd = document.createElement("td");
if (log.timestamp) {
  // FirestoreのTimestampをDateに変換
  const dt = log.timestamp.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
  timeTd.textContent = String(dt.getHours()).padStart(2, "0") + ":" +
                       String(dt.getMinutes()).padStart(2, "0") + ":" +
                       String(dt.getSeconds()).padStart(2, "0");
} else {
  timeTd.textContent = "-";
}
tr.appendChild(timeTd);

// --- ログイン処理 ---

function showLoginMessage(msg, isError = false) {
  const el = document.getElementById("loginMessage");
  el.textContent = msg;
  el.style.color = isError ? "red" : "green";
}

function showAdminSection() {
  document.getElementById("loginSection").classList.add("hidden");
  document.getElementById("adminSection").classList.remove("hidden");
}

document.getElementById("loginBtn").addEventListener("click", () => {
  const id = document.getElementById("adminId").value.trim();
  const pw = document.getElementById("adminPw").value.trim();
  if (id === ADMIN_ID && pw === ADMIN_PW) {
    currentUserId = id;
    currentUid = "admin-uid"; // 管理者用のUID（仮）
    showLoginMessage("ログイン成功！");
    showAdminSection();
    displayMaxCapacity();
    displayEventDates();
    displayLogs();
  } else {
    showLoginMessage("IDまたはパスワードが違います。", true);
  }
});

// --- ボタンイベント登録 ---
document.getElementById("updateCapacityBtn").addEventListener("click", updateMaxCapacity);
document.getElementById("addDateBtn").addEventListener("click", addDate);

document.getElementById("applyFilterBtn").addEventListener("click", () => {
  const userFilter = document.getElementById("userFilter").value.trim();
  const dateFilter = document.getElementById("dateFilter").value.trim();
  displayLogs(userFilter, dateFilter);
});
document.getElementById("clearFilterBtn").addEventListener("click", () => {
  document.getElementById("userFilter").value = "";
  document.getElementById("dateFilter").value = "";
  displayLogs();
});
