// Firebase モジュールのインポート
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";

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
const maruUsers = {}; // ✅ 宣言を1回だけに統一

async function fetchCandidateDates() {
  const docRef = doc(db, "settings", "eventDates");
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return docSnap.data().list || [];
  } else {
    console.log("No such document!");
    return [];
  }
}

async function renderForm() {
  const dates = await fetchCandidateDates();
  const tbody = document.getElementById("form-body");

  dates.forEach((date) => {
    const row = document.createElement("tr");

    const dateCell = document.createElement("td");
    dateCell.textContent = date;
    row.appendChild(dateCell);

    ["〇", "△", "×"].forEach((choice) => {
      const td = document.createElement("td");
      const input = document.createElement("input");
      input.type = "radio";
      input.name = `response-${date}`;
      input.value = choice;
      td.appendChild(input);
      row.appendChild(td);
    });

    tbody.appendChild(row);
  });
}

renderForm();

async function loadPreviousAnswers() {
  const userData = window.users[window.currentUser] || {};
  const answers = userData.answers || {};
  const comment = userData.comment || "";
  const dates = await fetchCandidateDates();

  dates.forEach(date => {
    const selected = answers[date];
    if (selected) {
      const el = document.querySelector(`input[name="response-${date}"][value="${selected}"]`);
      if (el) el.checked = true;
    }
  });

  document.getElementById("comment").value = comment;
}

async function showAllResults() {
  const tbody = document.getElementById("resultTable").querySelector("tbody");
  const status = document.getElementById("maruStatusResult");
  tbody.innerHTML = "";
  if (status) status.textContent = "";

  try {
    const configSnap = await getDoc(doc(db, "settings", "capacity"));
    let MAX = 3;
    if (configSnap.exists()) {
      MAX = configSnap.data().maxCapacity;
    }

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
    const dates = await fetchCandidateDates();

    dates.forEach(date => {
      maruUsers[date] = [];
    });

    docsArray.forEach(({ id, data }) => {
      window.users[id] = data;
      const a = data.answers || {};
      dates.forEach(date => {
        if (a[date] === "〇") {
          maruUsers[date].push(id);
        }
      });
    });

    const highlighted = {};
    dates.forEach(date => {
      highlighted[date] = maruUsers[date].length >= MAX ? maruUsers[date].slice(0, MAX) : [];
    });

    if (Object.values(maruUsers).some(arr => arr.length >= MAX)) {
      if (status) status.textContent = "この会はすでに満席となりました。以降は観戦/リザーバー枠での参加を募集いたします。";
    }

    docsArray.forEach(({ id, data }) => {
      const a = data.answers || {};
      const c = data.comment || "";
      const hasAnyAnswer = dates.some(date => a[date]);
      if (!hasAnyAnswer && !c) return;

      const row = document.createElement("tr");

      const idCell = document.createElement("td");
      idCell.textContent = id;
      row.appendChild(idCell);

      dates.forEach(date => {
        const cell = document.createElement("td");
        const answer = a[date] || "";
        if (highlighted[date]?.includes(id)) {
          cell.classList.add("highlight");
        }
        cell.textContent = answer;
        row.appendChild(cell);
      });

      const commentCell = document.createElement("td");
      commentCell.textContent = c;
      row.appendChild(commentCell);

      tbody.appendChild(row);
    });

  } catch (err) {
    console.error("データ取得エラー:", err);
  }
}

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

  const answerInputs = document.querySelectorAll('input[type="radio"]:checked');
const answers = {};
answerInputs.forEach(input => {
  const date = input.name.replace("response-", "");  // name 属性から日付を抽出
  answers[date] = input.value;
});


  const comment = document.getElementById("comment").value;
  const prevAnswers = window.users[window.currentUser]?.answers || {};

  const updateData = {
    answers,
    comment
  };

  // 🔴 ログ記録処理（変更があった場合のみ）

const userRef = doc(db, "users", window.currentUser);
const prevDoc = await getDoc(userRef);

const dates = await fetchCandidateDates();
logPromises.push(
  addDoc(collection(db, "logs"), {
    uid: window.currentUser,
    user: window.currentUser,
    date,
    from: oldVal,
    to: newVal,
    timestamp: new Date()
  })
);


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


function populateResults(dates, data) {
  const resultTable = document.getElementById("resultTable");
  const headerRow = document.getElementById("resultHeaderRow");
  headerRow.innerHTML = ""; // クリア

  // ヘッダー動的生成
  const headers = ["ユーザーID", ...dates, "コメント"];
  headers.forEach(header => {
    const th = document.createElement("th");
    th.textContent = header;
    headerRow.appendChild(th);
  });

  const tbody = resultTable.querySelector("tbody");
  tbody.innerHTML = "";

  data.forEach(entry => {
    const tr = document.createElement("tr");

    const uidTd = document.createElement("td");
    uidTd.textContent = entry.userId || "";
    tr.appendChild(uidTd);

    dates.forEach(date => {
      const td = document.createElement("td");
      td.textContent = entry.answers?.[date] || "";
      tr.appendChild(td);
    });

    const commentTd = document.createElement("td");
    commentTd.textContent = entry.comment || "";
    tr.appendChild(commentTd);

    tbody.appendChild(tr);
  });
}



