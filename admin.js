// Firebase 初期化
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

// ログイン処理（ハードコード）
function login() {
  const id = document.getElementById("adminId").value;
  const pw = document.getElementById("adminPw").value;
  const loginMsg = document.getElementById("loginMessage");

  if (id === "admin" && pw === "password") {
    document.getElementById("loginSection").classList.add("hidden");
    document.getElementById("adminSection").classList.remove("hidden");
    loginMsg.textContent = "";
    displayMaxCapacity(); // ログイン成功後に表示
  } else {
    loginMsg.textContent = "IDまたはパスワードが違います";
    loginMsg.style.color = "red";
  }
}

// Firestoreから定員を取得して画面に表示
async function getMaxCapacity() {
  try {
    const docRef = db.collection("settings").doc("capacity");
    const docSnap = await docRef.get();
    if (docSnap.exists) {
      const data = docSnap.data();
      return data.maxCapacity || 3;
    }
  } catch (e) {
    console.error("定員取得エラー:", e);
  }
  return 3;
}

async function displayMaxCapacity() {
  const current = await getMaxCapacity();
  document.getElementById("currentCapacity").textContent = current + "人";
}

// Firestoreの定員数を更新
async function updateMaxCapacity() {
  const newMax = parseInt(document.getElementById("newMax").value);
  const msg = document.getElementById("adminMessage");

  if (!newMax || newMax < 1) {
    msg.textContent = "正しい定員数を入力してください。";
    msg.style.color = "red";
    return;
  }

  try {
    await db.collection("settings").doc("capacity").set({ maxCapacity: newMax });
    msg.textContent = "定員を更新しました。";
    msg.style.color = "green";
    displayMaxCapacity(); // 更新後に再表示
  } catch (e) {
    console.error("更新エラー:", e);
    msg.textContent = "定員の更新に失敗しました。";
    msg.style.color = "red";
  }
}
