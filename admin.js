// Firebase 初期化
const firebaseConfig = {
  // あなたのFirebase設定をここに貼り付けてください
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// 認証情報
const ADMIN_ID = "admin";
const ADMIN_PW = "password";
let currentUserId = null;
let currentUid = null;

// --- 定員表示・更新 ---
async function displayMaxCapacity() {
  const doc = await db.collection("settings").doc("capacity").get();
  if (doc.exists) {
    document.getElementById("maxCapacityInput").value = doc.data().value || 1;
  }
}

async function updateMaxCapacity() {
  const input = document.getElementById("maxCapacityInput");
  const value = parseInt(input.value, 10);
  const msg = document.getElementById("capacityMessage");
  if (!value || value < 1) {
    msg.textContent = "1以上の数値を入力してください。";
    msg.style.color = "red";
    return;
  }
  await db.collection("settings").doc("capacity").set({ value });
  msg.textContent = "定員を更新しました。";
  msg.style.color = "green";
}

// --- 日程管理 ---
async function displayDates() {
  const ul = document.getElementById("dateList");
  ul.innerHTML = "";

  const doc = await db.collection("settings").doc("eventDates").get();
  if (doc.exists) {
    const dates = doc.data().list || [];
    dates.forEach((dateStr, index) => {
      const li = document.createElement("li");
      li.textContent = dateStr;

      const editBtn = document.createElement("button");
      editBtn.textContent = "編集";
      editBtn.onclick = () => editDate(index, dateStr);
      li.appendChild(editBtn);

      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "削除";
      deleteBtn.onclick = () => deleteDate(index, dateStr);
      li.appendChild(deleteBtn);

      ul.appendChild(li);
    });
  }
}

async function addDate(dateStr, userId, uid) {
  const msg = document.getElementById("datesMessage");
  msg.textContent = "";

  try {
    const docRef = db.collection("settings").doc("eventDates");
    const doc = await docRef.get();
    let dates = [];
    if (doc.exists) {
      dates = doc.data().list || [];
    }
    if (dates.includes(dateStr)) {
      msg.textContent = "すでに同じ日程が存在します。";
      msg.style.color = "red";
      return;
    }
    dates.push(dateStr);
    await docRef.set({ list: dates });

    await addLog({ userId, uid, from: "-", to: "追加: " + dateStr, date: dateStr });

    msg.textContent = "日程を追加しました。";
    msg.style.color = "green";
    displayDates();
  } catch (e) {
    console.error("日程追加失敗:", e);
    msg.textContent = "日程の追加に失敗しました。";
    msg.style.color = "red";
  }
}

async function deleteDate(index, dateStr) {
  const confirmed = confirm("本当にこの日程を削除しますか？");
  if (!confirmed) return;

  const msg = document.getElementById("datesMessage");
  msg.textContent = "";

  try {
    const docRef = db.collection("settings").doc("eventDates");
    const doc = await docRef.get();
    if (doc.exists) {
      const data = doc.data();
      const dates = data.list || [];
      const removed = dates.splice(index, 1);
      await docRef.update({ list: dates });

      await addLog({ userId: currentUserId, uid: currentUid, from: "削除: " + removed[0], to: "-", date: removed[0] });

      msg.textContent = "日程を削除しました。";
      msg.style.color = "green";
      displayDates();
    }
  } catch (e) {
    console.error("日程削除失敗:", e);
    msg.textContent = "日程の削除に失敗しました。";
    msg.style.color = "red";
  }
}

async function editDate(index, oldDateStr) {
  const newDateStr = prompt("新しい日程を入力してください：", oldDateStr);
  if (!newDateStr || newDateStr === oldDateStr) return;

  const msg = document.getElementById("datesMessage");
  msg.textContent = "";

  try {
    const docRef = db.collection("settings").doc("eventDates");
    const doc = await docRef.get();
    if (doc.exists) {
      const data = doc.data();
      const dates = data.list || [];
      dates[index] = newDateStr;
      await docRef.update({ list: dates });
      msg.textContent = "日程を更新しました。";
      msg.style.color = "green";
      displayDates();
    } else {
      msg.textContent = "日程データが存在しません。";
      msg.style.color = "red";
    }
  } catch (e) {
    console.error("日程更新失敗:", e);
    msg.textContent = "日程の更新に失敗しました。";
    msg.style.color = "red";
  }
}

// --- ログ管理 ---
async function addLog({ userId, uid, from, to, date }) {
  try {
    await db.collection("logs").add({
      userId,
      uid,
      from,
      to,
      date,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    });
  } catch (e) {
    console.error("ログ追加失敗:", e);
  }
}

async function fetchLogs() {
  try {
    const snapshot = await db.collection("logs").orderBy("timestamp", "desc").limit(100).get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (e) {
    console.error("ログ取得失敗:", e);
    return [];
  }
}

function renderLogs(logs) {
  const tbody = document.querySelector("#logTable tbody");
  tbody.innerHTML = "";

  if (logs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#666;">ログがありません。</td></tr>`;
    return;
  }

  for (const log of logs) {
    const tr = document.createElement("tr");

    const userTd = document.createElement("td");
    userTd.textContent = log.userId || "-";
    tr.appendChild(userTd);

    const uidTd = document.createElement("td");
    uidTd.textContent = log.uid || "-";
    tr.appendChild(uidTd);

    const fromTd = document.createElement("td");
    fromTd.textContent = log.from || "-";
    tr.appendChild(fromTd);

    const toTd = document.createElement("td");
    toTd.textContent = log.to || "-";
    tr.appendChild(toTd);

    const dateTd = document.createElement("td");
    dateTd.textContent = log.date || "-";
    tr.appendChild(dateTd);

    const timeTd = document.createElement("td");
    if (log.timestamp && typeof log.timestamp.toDate === "function") {
      const date = log.timestamp.toDate();
      timeTd.textContent = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
    } else {
      timeTd.textContent = "-";
    }
    tr.appendChild(timeTd);

    tbody.appendChild(tr);
  }
}

// --- フィルタリング ---
async function populateDateFilterOptions() {
  const select = document.getElementById("dateFilter");
  select.innerHTML = "";

  try {
    const doc = await db.collection("settings").doc("eventDates").get();
    if (doc.exists) {
      const dates = doc.data().list || [];
      dates.forEach(dateStr => {
        const option = document.createElement("option");
        option.value = dateStr;
        option.textContent = dateStr;
        select.appendChild(option);
      });
    }
  } catch (e) {
    console.error("日付フィルター取得失敗:", e);
  }
}

async function applyFilter() {
  const userFilter = document.getElementById("userFilter").value.trim().toLowerCase();
  const dateFilter = document.getElementById("dateFilter");
  const selectedDates = Array.from(dateFilter.selectedOptions).map(option => option.value);
  let logs = await fetchLogs();
  if (userFilter) {
    logs = logs.filter(log => (log.userId || "").toLowerCase().includes(userFilter));
  }
  if (selectedDates.length > 0) {
    logs = logs.filter(log => selectedDates.includes(log.date));
  }
  renderLogs(logs);
}

function clearFilter() {
  document.getElementById("userFilter").value = "";
  const dateFilter = document.getElementById("dateFilter");
  for (let option of dateFilter.options) {
    option.selected = false;
  }
  loadLogs();
}

// --- ログイン処理 ---
document.getElementById("loginBtn").addEventListener("click", async () => {
  const id = document.getElementById("adminId").value;
  const pw = document.getElementById("adminPw").value;

  const msg = document.getElementById("loginMessage");
  msg.textContent = "";

  if (id === ADMIN_ID && pw === ADMIN_PW) {
    currentUserId = id;
    currentUid = "admin";
    document.getElementById("loginSection").classList.add("hidden");
    document.getElementById("adminSection").classList.remove("hidden");
    await displayMaxCapacity();
    await displayDates();
    await populateDateFilterOptions();
    const logs = await fetchLogs();
    renderLogs(logs);
  } else {
    msg.textContent = "IDまたはパスワードが違います。";
    msg.style.color = "red";
  }
});

// --- 初期化 ---
async function initializeAdmin() {
  await displayMaxCapacity();
  await displayDates();
  await loadLogs();
}

async function loadLogs() {
  const logs = await fetchLogs();
  renderLogs(logs);
}

// --- イベント登録 ---
document.getElementById("updateCapacityBtn").addEventListener("click", updateMaxCapacity);
document.getElementById("addDateBtn").addEventListener("click", () => {
  const dateStr = document.getElementById("newDateInput").value.trim();
  if (!dateStr) {
    document.getElementById("datesMessage").textContent = "日程を入力してください。";
    document.getElementById("datesMessage").style.color = "red";
    return;
  }
  addDate(dateStr, currentUserId, currentUid);
  document.getElementById("newDateInput").value = "";
});
document.getElementById("applyFilterBtn").addEventListener("click", applyFilter);
document.getElementById("clearFilterBtn").addEventListener("click", clearFilter);
