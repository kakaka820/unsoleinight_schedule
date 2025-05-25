// admin.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

// あなたのFirebase設定に差し替えてください
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "SENDER_ID",
  appId: "APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 定員数を表示する関数
async function displayCurrentCapacity() {
  try {
    const docRef = doc(db, "settings", "capacity");
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      const maxCapacity = data.maxCapacity;
      document.getElementById("currentCapacity").textContent = `現在の定員: ${maxCapacity}人`;
    } else {
      document.getElementById("currentCapacity").textContent = "定員データが見つかりません";
    }
  } catch (error) {
    console.error("定員取得エラー:", error);
    document.getElementById("currentCapacity").textContent = "エラーが発生しました";
  }
}

displayCurrentCapacity();
