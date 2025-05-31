// admin.js（モジュール形式で使う場合の完全版）

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  updateDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
  orderBy,
  limit,
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
  // Firebase設定
  const firebaseConfig = {
    apiKey: "AIzaSyDs3xNPpmdzqD1nww2s6mIPbYHtsRvXeY0",
    authDomain: "ikinarimvp.firebaseapp.com",
    projectId: "ikinarimvp",
    storageBucket: "ikinarimvp.firebasestorage.app",
    messagingSenderId: "587616153202",
    appId: "1:587616153202:web:5b6cbc5ca3ac3e8c42dceb",
  };

  // 初期化
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  // 認証情報
  const ADMIN_ID = "admin";
  const ADMIN_PW = "password";
  let currentUserId = null;
  let currentUid = null;

  // --- 定員表示・更新 ---
  async function displayMaxCapacity() {
    const docRef = doc(db, "settings", "capacity");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      document.getElementById("maxCapacityInput").value = docSnap.data().value || 1;
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
    const docRef = doc(db, "settings", "capacity");
    await setDoc(docRef, { value });
    msg.textContent = "定員を更新しました。";
    msg.style.color = "green";
  }

  // --- 日程管理 ---
  async function displayDates() {
    const ul = document.getElementById("dateList");
    ul.innerHTML = "";

    const docRef = doc(db, "settings", "eventDates");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const dates = docSnap.data().list || [];
      dates.forEach((dateStr, index) => {
        const li = document.createElement("li");
        li.textContent = dateStr + " ";

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
      const docRef = doc(db, "settings", "eventDates");
      const docSnap = await getDoc(docRef);
      let dates = [];
      if (docSnap.exists()) {
        dates = docSnap.data().list || [];
      }
      if (dates.includes(dateStr)) {
        msg.textContent = "すでに同じ日程が存在します。";
        msg.style.color = "red";
        return;
      }
      dates.push(dateStr);
      await setDoc(docRef, { list: dates });

      await addLog({ userId, uid, from: "-", to: "追加: " + dateStr, date: dateStr });

      msg.textContent = "日程を追加しました。";
      msg.style.color = "green";
      displayDates();
      await populateDateFilterOptions();
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
      const docRef = doc(db, "settings", "eventDates");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const dates = docSnap.data().list || [];
        const removed = dates.splice(index, 1);
        await updateDoc(docRef, { list: dates });

        await addLog({ userId: currentUserId, uid: currentUid, from: "削除: " + removed[0], to: "-", date: removed[0] });

        msg.textContent = "日程を削除しました。";
        msg.style.color = "green";
        displayDates();
        await populateDateFilterOptions();
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
      const docRef = doc(db, "settings", "eventDates");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const dates = docSnap.data().list || [];

        if (dates.includes(newDateStr)) {
          msg.textContent = "すでに同じ日程が存在します。";
          msg.style.color = "red";
          return;
        }

        dates[index] = newDateStr;
        await updateDoc(docRef, { list: dates });
        msg.textContent = "日程を更新しました。";
        msg.style.color = "green";
        displayDates();
        await populateDateFilterOptions();
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
      const logsCol = collection(db, "logs");
      await addDoc(logsCol, {
        userId,
        uid,
        from,
        to,
        date,
        timestamp: serverTimestamp(),
      });
    } catch (e) {
      console.error("ログ追加失敗:", e);
    }
  }

  async function fetchLogs() {
    try {
      const logsCol = collection(db, "logs");
      const q = query(logsCol, orderBy("timestamp", "desc"), limit(100));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
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
      const docRef = doc(db, "settings", "eventDates");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const dates = docSnap.data().list || [];
        dates.forEach((dateStr) => {
          const option = document.createElement("option");
          option.value = dateStr;
          option.textContent = dateStr;
          select.appendChild(option);
        });
      }
    } catch (e) {
      console.error("日程取得失敗:", e);
    }
  }

  // 複数選択のフィルター適用 (ユーザーIDと日付複数対応)
  async function applyFilters() {
    const userIdFilter = document.getElementById("userFilter").value.trim();
    const dateSelect = document.getElementById("dateFilter");
    const selectedDates = Array.from(dateSelect.selectedOptions).map((opt) => opt.value);

    try {
      const logsCol = collection(db, "logs");
      let constraints = [];

      if (userIdFilter) {
        constraints.push(where("userId", "==", userIdFilter));
      }

      if (selectedDates.length === 1) {
        constraints.push(where("date", "==", selectedDates[0]));
      } else if (selectedDates.length > 1) {
        // Firestoreでは直接「in」演算子は配列サイズ最大10件まで
        // 日付が多い場合は先頭10件まで絞り込み対応
        const limitedDates = selectedDates.slice(0, 10);
        constraints.push(where("date", "in", limitedDates));
      }

      let q;
      if (constraints.length > 0) {
        q = query(logsCol, ...constraints, orderBy("timestamp", "desc"), limit(100));
      } else {
        q = query(logsCol, orderBy("timestamp", "desc"), limit(100));
      }

      const snapshot = await getDocs(q);
      const filteredLogs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      renderLogs(filteredLogs);
    } catch (e) {
      console.error("フィルター適用失敗:", e);
    }
  }

  function clearFilters() {
    document.getElementById("userFilter").value = "";
    document.getElementById("dateFilter").selectedIndex = -1;
    loadAllLogs();
  }

  // --- ログ全件表示 ---
  async function loadAllLogs() {
    const logs = await fetchLogs();
    renderLogs(logs);
  }

  // --- ログイン処理 ---
  function showLoginForm(show) {
    document.getElementById("loginForm").style.display = show ? "block" : "none";
    document.getElementById("adminPanel").style.display = show ? "none" : "block";
  }

  function login() {
    const inputId = document.getElementById("adminId").value.trim();
    const inputPw = document.getElementById("adminPw").value.trim();
    const msg = document.getElementById("loginMessage");

    if (inputId === ADMIN_ID && inputPw === ADMIN_PW) {
      currentUserId = ADMIN_ID;
      currentUid = "admin-uid";
      msg.textContent = "";
      showLoginForm(false);
      initializeAdminPanel();
    } else {
      msg.textContent = "IDかパスワードが違います";
      msg.style.color = "red";
    }
  }

  function logout() {
    currentUserId = null;
    currentUid = null;
    showLoginForm(true);
  }

  // --- 初期化 ---
  async function initializeAdminPanel() {
    await displayMaxCapacity();
    await displayDates();
    await populateDateFilterOptions();
    await loadAllLogs();
  }

  // --- イベント登録 ---
  document.getElementById("loginBtn").addEventListener("click", login);
  document.getElementById("logoutBtn").addEventListener("click", logout);

  document.getElementById("updateCapacityBtn").addEventListener("click", updateMaxCapacity);

  document.getElementById("addDateBtn").addEventListener("click", () => {
    const dateInput = document.getElementById("newDateInput");
    const dateStr = dateInput.value.trim();
    if (!dateStr) {
      alert("日程を入力してください。");
      return;
    }
    addDate(dateStr, currentUserId, currentUid);
    dateInput.value = "";
  });

  document.getElementById("applyFilterBtn").addEventListener("click", applyFilters);
  document.getElementById("clearFilterBtn").addEventListener("click", clearFilters);

  // 初期表示はログイン画面
  showLoginForm(true);
});
