// Firebase モジュールのインポート
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";


// Firebase 設定と初期化
const firebaseConfig = {
  apiKey: "AIzaSyBzYCHcumBzRw3DLs8mjLiGTiXxvxmjLDU",
  authDomain: "unsoleinight-schedule.firebaseapp.com",
  projectId: "unsoleinight-schedule",
  storageBucket: "unsoleinight-schedule.firebasestorage.app",
  messagingSenderId: "1040333692698",
  appId: "1:1040333692698:web:fb0e4f481dff8167f756a3"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// グローバル変数
window.users = {};
window.currentUser = "";

// 回答の読み込み
function loadPreviousAnswers() {
  const userData = window.users[window.currentUser] || {};
  const answers = userData.answers || {};
  const comment = userData.comment || "";

  ["date1", "date2", "date3"].forEach(name => {
    const selected = answers[name];
    if (selected) {
      const el = document.querySelector(`input[name="${name}"][value="${selected}"]`);
      if (el) el.checked = true;
    }
  });

  document.getElementById("comment").value = comment;
}

// 回答の集計と表示
async function showAllResults() {
  const tbody = document.getElementById("resultTable").querySelector("tbody");
  const status = document.getElementById("maruStatusResult");
  tbody.innerHTML = "";
  if (status) status.textContent = "";

  try {
    const configSnap = await getDoc(doc(db, "settings", "capacity"));
    let MAX;
    if (configSnap.exists()) {
      MAX = configSnap.data().maxCapacity;
      console.log("Firestoreから取得した maxCapacity:", MAX);
    } else {
      console.warn("settings/capacity ドキュメントが見つかりません。デフォルト値 3 を使用します。");
      MAX = 3;
    }

    const MIN_HIGHLIGHT = MAX;

    const docsArray = [];
    const snapshot = await getDocs(collection(db, "users"));
    snapshot.forEach(docSnap => {
      docsArray.push({ id: docSnap.id, data: docSnap.data() });
    });

    docsArray.sort((a, b) => {
      const t1 = a.data.updatedAt?.toMillis() || 0;
      const t2 = b.data.updatedAt?.toMillis() || 0;
      return t1 - t2;
    });

    window.users = {};
    const maruUsers = { date1: [], date2: [], date3: [] };

    docsArray.forEach(({ id, data }) => {
      window.users[id] = data;
      const a = data.answers || {};
      if (a.date1 === "〇") maruUsers.date1.push(id);
      if (a.date2 === "〇") maruUsers.date2.push(id);
      if (a.date3 === "〇") maruUsers.date3.push(id);
    });

    const highlighted = {
      date1: maruUsers.date1.length >= MAX ? maruUsers.date1.slice(0, MAX) : [],
      date2: maruUsers.date2.length >= MAX ? maruUsers.date2.slice(0, MAX) : [],
      date3: maruUsers.date3.length >= MAX ? maruUsers.date3.slice(0, MAX) : [],
    };

    if (Object.values(maruUsers).some(arr => arr.length >= MAX)) {
      if (status) status.textContent = "この会はすでに満席となりました。以降は観戦/リザーバー枠での参加を募集いたします。";
    }

    docsArray.forEach(({ id, data }) => {
      const a = data.answers || {};
      const c = data.comment || "";
      if (!a.date1 && !a.date2 && !a.date3 && !c) return;

      const row = `
        <tr>
          <td>${id}</td>
          <td class="${highlighted.date1.includes(id) ? "highlight" : ""}">${a.date1 || ""}</td>
          <td class="${highlighted.date2.includes(id) ? "highlight" : ""}">${a.date2 || ""}</td>
          <td class="${highlighted.date3.includes(id) ? "highlight" : ""}">${a.date3 || ""}</td>
          <td>${c}</td>
        </tr>
      `;
      tbody.innerHTML += row;
    });

  } catch (err) {
    console.error("データ取得エラー:", err);
  }
}

// 以下、login/registerなどは元のまま省略（必要なら展開します）


// ログイン機能
window.login = async function () {
  const id = document.getElementById("userId").value.trim();
  const pass = document.getElementById("password").value;

  if (!id || !pass) {
    document.getElementById("loginError").textContent = "IDとパスワードを入力してください。";
    return;
  }

  try {
    const docSnap = await getDoc(doc(db, "users", id));
    if (docSnap.exists()) {
      const data = docSnap.data();
      const hashedInput = sha256(pass);

      if (data.password === hashedInput) {
        window.currentUser = id;
        window.users[id] = data;

        document.getElementById("loginSection").classList.add("hidden");
        document.getElementById("formSection").classList.remove("hidden");
        document.getElementById("resultSection").classList.remove("hidden");
        document.getElementById("welcomeMsg").textContent = `${id} さんとしてログイン中`;

        loadPreviousAnswers();
        await showAllResults();

        document.getElementById("loginError").textContent = "";
        document.getElementById("submitMessage").textContent = "";
      } else {
        document.getElementById("loginError").textContent = "パスワードが違います。";
      }
    } else {
      document.getElementById("loginError").textContent = "IDが存在しません。";
    }
  } catch (err) {
    console.error(err);
    document.getElementById("loginError").textContent = "ログイン中にエラーが発生しました。";
  }
};

// 登録機能
window.register = async function () {
  const id = document.getElementById("newUserId").value.trim();
  const pass = document.getElementById("newPassword").value;

  if (!id || !pass) {
    document.getElementById("registerMessage").textContent = "IDとパスワードを入力してください。";
    return;
  }

  if (/[<>]/.test(id)) {
    document.getElementById("registerMessage").textContent = "IDに < や > を含めないでください。";
    return;
  }

  const docSnap = await getDoc(doc(db, "users", id));
  if (docSnap.exists()) {
    document.getElementById("registerMessage").textContent = "このIDはすでに使われています。";
  } else {
    const hashedPass = sha256(pass);
    await setDoc(doc(db, "users", id), {
      password: hashedPass,
      answers: {},
      comment: ""
    });
    document.getElementById("registerMessage").style.color = "green";
    document.getElementById("registerMessage").textContent = "登録成功！ログイン画面に戻ってください。";
  }
};

// 表示切り替え
window.showRegister = () => {
  document.getElementById("loginSection").classList.add("hidden");
  document.getElementById("registerSection").classList.remove("hidden");
};

window.backToLogin = () => {
  document.getElementById("registerSection").classList.add("hidden");
  document.getElementById("loginSection").classList.remove("hidden");
};

// 回答送信
document.getElementById("scheduleForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!window.currentUser) {
    alert("ログインしてください。");
    return;
  }

  const answers = {};
  ["date1", "date2", "date3"].forEach(date => {
    answers[date] = document.querySelector(`input[name="${date}"]:checked`)?.value || "";
  });

  const comment = document.getElementById("comment").value;
  const prevAnswers = window.users[window.currentUser]?.answers || {};

  const updateData = {
    answers,
    comment
  };

  // 🔴 ログ記録処理（変更があった場合のみ）
  const logPromises = [];

  ["date1", "date2", "date3"].forEach(date => {
    const oldVal = prevAnswers[date] || "";
    const newVal = answers[date] || "";

    if (oldVal !== newVal) {
      logPromises.push(
        addDoc(collection(db, "logs"), {
          user: window.currentUser,
          field: date,
          from: oldVal,
          to: newVal,
          timestamp: serverTimestamp()
        })
      );
    }
  });

  // 🔄 タイムスタンプ更新
  if (JSON.stringify(answers) !== JSON.stringify(prevAnswers)) {
    updateData.updatedAt = serverTimestamp();
  }

  await Promise.all([
    setDoc(doc(db, "users", window.currentUser), updateData, { merge: true }),
    ...logPromises
  ]);

  window.users[window.currentUser] = { ...window.users[window.currentUser], ...updateData };

  document.getElementById("submitMessage").textContent = "回答を保存しました！";
  await showAllResults();
});
