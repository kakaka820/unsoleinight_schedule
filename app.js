import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBzYCHcumBzRw3DLs8mjLiGTiXxvxmjLDU",
  authDomain: "unsoleinight-schedule.firebaseapp.com",
  projectId: "unsoleinight-schedule",
  storageBucket: "unsoleinight-schedule.appspot.com",
  messagingSenderId: "1040333692698",
  appId: "1:1040333692698:web:fb0e4f481dff8167f756a3"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);


window.users = {};
window.currentUser = "";
const maruUsers = {};
const highlighted = {}; 


function sha256(str) {
  const buffer = new TextEncoder().encode(str);
  return crypto.subtle.digest("SHA-256", buffer).then(buf =>
    Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("")
  );
}

async function fetchCandidateDates() {
  const docRef = doc(db, "settings", "eventDates");
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? docSnap.data().list || [] : [];
}

async function renderForm() {
  const dates = await fetchCandidateDates();
  const tbody = document.getElementById("form-body");
  tbody.innerHTML = "";

  dates.forEach(date => {
    const row = document.createElement("tr");
    const dateCell = document.createElement("td");
    dateCell.textContent = `${date}`;
    row.appendChild(dateCell);

    ["〇", "×", "観戦"].forEach(choice => {
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

async function loadPreviousAnswers() {
  const dates = await fetchCandidateDates();
  const userData = window.users[window.currentUser] || {};
  const answers = userData.answers || {};
  const comment = userData.comment || "";

  dates.forEach(date => {
    const selected = answers[String(date)]?.value;
if (selected) {
  const el = document.querySelector(
    `input[name="response-${String(date)}"][value="${selected}"]`
  );
  if (el) el.checked = true;
}
  });
  document.getElementById("comment").value = comment;
}

async function showAllResults() {
  const dates = await fetchCandidateDates();
  const headerRow = document.getElementById("resultHeaderRow");
  headerRow.innerHTML = "";

  const thUser = document.createElement("th");
  thUser.textContent = "ユーザーID";
  headerRow.appendChild(thUser);

  dates.forEach(date => {
    const th = document.createElement("th");
    th.textContent = date;
    headerRow.appendChild(th);
  });

  const thComment = document.createElement("th");
  thComment.textContent = "コメント";
  headerRow.appendChild(thComment);

  const tbody = document.getElementById("resultTable").querySelector("tbody");
  const status = document.getElementById("maruStatusResult");
  tbody.innerHTML = "";
  if (status) status.textContent = "";

  const configSnap = await getDoc(doc(db, "settings", "capacity"));
  let MAX = configSnap.exists() ? configSnap.data().maxCapacity : 3;

  const snapshot = await getDocs(collection(db, "users"));
  const docsArray = snapshot.docs.map(d => ({ id: d.id, data: d.data() }));

  docsArray.sort((a, b) => (a.data.updatedAt?.toMillis() || 0) - (b.data.updatedAt?.toMillis() || 0));
  window.users = {};
  dates.forEach(date => { maruUsers[date] = []; });

  docsArray.forEach(({ id, data }) => {
    window.users[id] = data;
    const a = data.answers || {};
   dates.forEach(date => {
  if (a[String(date)]?.value === "〇") {
    maruUsers[date].push({ id, ts: a[String(date)].ts });
  }
});
dates.forEach(date => {
  maruUsers[date].sort((x, y) => (x.ts?.toMillis?.() || 0) - (y.ts?.toMillis?.() || 0));
  highlighted[date] = maruUsers[date].slice(0, MAX).map(u => u.id);
});

  });

 
  dates.forEach(date => {
    highlighted[String(date)] = maruUsers[String(date)].length >= MAX ? maruUsers[String(date)].slice(0, MAX).map(u => u.id): [];
  });

  if (Object.values(maruUsers).some(arr => arr.length >= MAX)) {
    if (status) status.textContent = "満席となった会に関しましてはリザーバー枠での参加を募集いたします。";
  }

  docsArray.forEach(({ id, data }) => {
    const a = data.answers || {};
    const c = data.comment || "";
    if (!Object.keys(a).length && !c) return;

    const row = document.createElement("tr");
    const idCell = document.createElement("td");
    idCell.textContent = id;
    row.appendChild(idCell);

    dates.forEach(date => {
      const cell = document.createElement("td");
      const answer = a[String(date)]?.value || "";
      const key = String(date);
      const isOverCapacity = maruUsers[key].length > MAX;
      const position = maruUsers[key].findIndex(u => u.id === id);
　　　const circledNums = ["①","②","③","④","⑤","⑥","⑦","⑧","⑨","⑩","⑪","⑫","⑬","⑭"];
　　　const displayRank = position >= 0 ? circledNums[position] : "";
const isReserve = isOverCapacity &&position >= MAX && maruUsers[key].some(u => u.id === id) && !highlighted[key].includes(id);
      if (highlighted[key]?.includes(id)) {cell.classList.add("highlight");}
     if (answer === "〇" && isReserve) {
    cell.textContent = "リザーバー";
  } else if(answer === "〇") {
    cell.textContent = displayRank || "〇";
  }
      } else {
    cell.textContent = answer;
  }
    if (highlighted[key]?.includes(id)) {
    cell.classList.add("highlight");
  }
      row.appendChild(cell);
    });

    const commentCell = document.createElement("td");
    commentCell.textContent = c;
    row.appendChild(commentCell);
    tbody.appendChild(row);
  });

// フォームの日付セルもハイライト
const formRows = document.querySelectorAll("#form-body tr");
formRows.forEach(row => {
  const dateCell = row.cells[0];
  const date = dateCell.textContent;
  if (highlighted[String(date)]?.length > 0) {
    console.log("ハイライト対象日付:", date, "ユーザー:", highlighted[String(date)]);
    dateCell.classList.add("highlight");
  } else {
    dateCell.classList.remove("highlight");
  }
});

  
}

window.login = async function () {
  const id = document.getElementById("userId").value.trim();
  const pass = document.getElementById("password").value;
  if (!id || !pass) {
    document.getElementById("loginError").textContent = "IDとパスワードを入力してください。";
    return;
  }

  const docSnap = await getDoc(doc(db, "users", id));
  if (docSnap.exists()) {
    const data = docSnap.data();
    const hashedInput = await sha256(pass);
    if (data.password === hashedInput) {
      window.currentUser = id;
      window.users[id] = data;
      document.getElementById("loginSection").classList.add("hidden");
      document.getElementById("formSection").classList.remove("hidden");
      document.getElementById("resultSection").classList.remove("hidden");
      document.getElementById("welcomeMsg").textContent = `${id} さんとしてログイン中`;
// 匿名認証でログインして uid を取得し、users/{id} に保存
try {
  const userCredential = await signInAnonymously(auth);
  const uid = userCredential.user.uid;
  window.uid = uid;
  console.log("UID取得成功", uid);
  const userRef = doc(db, "users", id);
  await setDoc(userRef, { uid }, { merge: true });  // uidだけを追記保存
  console.log("UID保存成功:", uid);
} catch (error) {
  console.error("UID保存失敗:", error);
}
     
      await renderForm();
      await showAllResults();
      await loadPreviousAnswers();
      document.getElementById("loginError").textContent = "";
      document.getElementById("submitMessage").textContent = "";
    } else {
      document.getElementById("loginError").textContent = "パスワードが違います。";
    }
  } else {
    document.getElementById("loginError").textContent = "IDが存在しません。";
  }
};

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
    const hashedPass = await sha256(pass);
    await setDoc(doc(db, "users", id), {
      password: hashedPass,
      answers: {},
      comment: ""
    });
    document.getElementById("registerMessage").style.color = "green";
    document.getElementById("registerMessage").textContent = "登録成功！ログイン画面に戻ってください。";
  }
};

window.showRegister = () => {
  document.getElementById("loginSection").classList.add("hidden");
  document.getElementById("registerSection").classList.remove("hidden");
};
window.backToLogin = () => {
  document.getElementById("registerSection").classList.add("hidden");
  document.getElementById("loginSection").classList.remove("hidden");
};

document.getElementById("scheduleForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!window.currentUser) return alert("ログインしてください。");

  const answerInputs = document.querySelectorAll('input[type="radio"]:checked');
  const answers = {};
  answerInputs.forEach(input => {
    const date = input.name.replace("response-", "");
   answers[String(date)] = { value: input.value, ts: null };

  });

  const comment = document.getElementById("comment").value;
  const prevAnswers = window.users[window.currentUser]?.answers || {};
  const prevComment = window.users[window.currentUser]?.comment || "";

  const userRef = doc(db, "users", window.currentUser);
  const userSnap = await getDoc(userRef);
  const dates = await fetchCandidateDates();
  const logPromises = [];

 dates.forEach(date => {
  const oldVal = prevAnswers[String(date)]?.value || "";
  const newVal = answers[String(date)]?.value || "";

  if (oldVal !== newVal) {
    logPromises.push(addDoc(collection(db, "logs"), {
      userId: window.currentUser,
      uid: window.uid || "unknown",
      date,
      from: oldVal,
      to: newVal,
      timestamp: serverTimestamp()
    }));

    answers[String(date)] = {
      value: newVal || "",
      ts: newVal === "〇" ? serverTimestamp() : null
    };
  } else {
    answers[String(date)] = prevAnswers[String(date)] || { value: "", ts: null };
  }
});

  if (comment !== prevComment) {
    logPromises.push(addDoc(collection(db, "logs"), {
      userId: window.currentUser,
      uid: window.uid || "unknown",
      field: "comment",
      from: prevComment,
      to: comment,
      timestamp: serverTimestamp()
    }));
  }

  await Promise.all(logPromises);
  await setDoc(userRef, {
    ...window.users[window.currentUser],
    answers,
    comment,
    updatedAt: serverTimestamp()
  });

  await showAllResults();
  document.getElementById("submitMessage").textContent = "送信しました！";
});
// すでに他のスクリプトがある部分

// エンターキーのイベントリスナー
document.addEventListener('keydown', function(event) {
  if (event.key === 'Enter') {
    // フォーカスされているボタンを取得
    const focusedButton = document.activeElement;

   // ボタンがフォーカスされているか確認し、特定のボタンにのみ反応
    if (focusedButton && focusedButton.tagName === 'BUTTON') {
      {
        // 該当のボタンをクリック
        focusedButton.click();
      }
    }
  }
});
