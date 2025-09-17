// admin.js（デバッグ強化版）

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
  arrayUnion,
  arrayRemove,
  writeBatch,
  deleteDoc
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

  // デバッグ用：データ構造確認関数
  async function debugDataStructure() {
    console.log("=== Firebase設定確認 ===");
    console.log("Project ID:", firebaseConfig.projectId);
    
    try {
      // ユーザーデータのサンプル確認
      const usersSnapshot = await getDocs(collection(db, "users"));
      console.log("=== ユーザーデータサンプル ===");
      usersSnapshot.docs.slice(0, 3).forEach(doc => {
        const data = doc.data();
        console.log(`ユーザー ${doc.id}:`, {
          answersKeys: Object.keys(data.answers || {}),
          sampleAnswers: data.answers
        });
      });

      // ログデータのサンプル確認
      const logsSnapshot = await getDocs(query(collection(db, "logs"), limit(5)));
      console.log("=== ログデータサンプル ===");
      logsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        console.log(`ログ ${doc.id}:`, {
          date: data.date,
          dateType: typeof data.date
        });
      });

      // 設定データ確認
      const settingsSnap = await getDoc(doc(db, "settings", "eventDates"));
      if (settingsSnap.exists()) {
        console.log("=== 設定データ ===");
        console.log("Event dates:", settingsSnap.data().list);
      }
    } catch (e) {
      console.error("デバッグ確認失敗:", e);
    }
  }

  // --- 定員表示・更新 ---
  async function getMaxCapacity() {
    try {
      const docSnap = await getDoc(doc(db, "settings", "capacity"));
      if (docSnap.exists()) {
        const data = docSnap.data();
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
    const msg = document.getElementById("adminMessage");
    msg.textContent = "";

    if (!newMax || newMax < 1) {
      msg.textContent = "1以上の数値を入力してください。";
      msg.style.color = "red";
      return;
    }

    try {
      await setDoc(doc(db, "settings", "capacity"), { maxCapacity: newMax });
      msg.textContent = "定員数を更新しました。";
      msg.style.color = "green";
      document.getElementById("newMax").value = "";
      await displayMaxCapacity();
    } catch (e) {
      msg.textContent = "更新に失敗しました。";
      msg.style.color = "red";
    }
  }

  async function displayDates() {
    const list = document.getElementById("datesList");
    list.innerHTML = "";
    try {
      const docSnap = await getDoc(doc(db, "settings", "eventDates"));
      if (docSnap.exists()) {
        const data = docSnap.data();
        const dates = data.list || [];
        if (dates.length === 0) {
          list.innerHTML = "<li>登録されている日程がありません。</li>";
          return;
        }
        dates.forEach((dateStr, index) => {
          const li = document.createElement("li");
          li.textContent = dateStr;
          
          const debugBtn = document.createElement("button");
          debugBtn.textContent = "🔍Debug";
          debugBtn.onclick = () => debugDateData(dateStr);
          
          const editBtn = document.createElement("button");
          editBtn.textContent = "編集";
          editBtn.onclick = () => editDate(index, dateStr);

          const delBtn = document.createElement("button");
          delBtn.textContent = "削除";
          delBtn.onclick = () => removeDate(dateStr);

          li.appendChild(debugBtn);
          li.appendChild(editBtn);
          li.appendChild(delBtn);
          list.appendChild(li);
        });
      } else {
        list.innerHTML = "<li>日程データが存在しません。</li>";
      }
    } catch (e) {
      console.error("日程取得失敗:", e);
      list.innerHTML = "<li>日程の取得に失敗しました。</li>";
    }
  }

  // デバッグ用：特定日程のデータ確認
  async function debugDateData(dateStr) {
    console.log(`=== ${dateStr} のデータ確認 ===`);
    
    try {
      // ユーザーデータで該当キーを探す
      const usersSnapshot = await getDocs(collection(db, "users"));
      const usersWithDate = [];
      
      usersSnapshot.forEach(doc => {
        const data = doc.data();
        const answers = data.answers || {};
        
        // 完全一致
        if (answers.hasOwnProperty(dateStr)) {
          usersWithDate.push({
            userId: doc.id,
            exactMatch: true,
            value: answers[dateStr]
          });
        }
        
        // 部分一致チェック
        Object.keys(answers).forEach(key => {
          if (key.includes(dateStr) || dateStr.includes(key)) {
            usersWithDate.push({
              userId: doc.id,
              exactMatch: false,
              key: key,
              value: answers[key]
            });
          }
        });
      });
      
      console.log(`ユーザーデータマッチ数: ${usersWithDate.length}`);
      usersWithDate.forEach(item => console.log(item));
      
      // ログデータで該当を探す
      const logsQuery = query(collection(db, "logs"), where("date", "==", dateStr));
      const logsSnapshot = await getDocs(logsQuery);
      console.log(`ログデータマッチ数: ${logsSnapshot.docs.length}`);
      
      // 部分一致のログも確認
      const allLogsSnapshot = await getDocs(collection(db, "logs"));
      const partialLogMatches = [];
      allLogsSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.date && (data.date.includes(dateStr) || dateStr.includes(data.date))) {
          partialLogMatches.push({
            logId: doc.id,
            date: data.date,
            exactMatch: data.date === dateStr
          });
        }
      });
      console.log(`ログ部分一致数: ${partialLogMatches.length}`);
      partialLogMatches.forEach(item => console.log(item));
      
      alert(`Debug完了！\n完全一致ユーザー: ${usersWithDate.filter(u => u.exactMatch).length}件\n完全一致ログ: ${logsSnapshot.docs.length}件\n\nコンソールで詳細確認してください。`);
      
    } catch (e) {
      console.error("デバッグ失敗:", e);
      alert("デバッグ処理でエラーが発生しました。");
    }
  }

  document.getElementById("addDateBtn").addEventListener("click", async () => {
    const dateStr = document.getElementById("newDateInput").value.trim();
    const msg = document.getElementById("datesMessage");
    msg.textContent = "";

    if (!dateStr) {
      msg.textContent = "日程を入力してください。";
      msg.style.color = "red";
      return;
    }
    try {
      await updateDoc(doc(db, "settings", "eventDates"), {
        list: arrayUnion(dateStr)
      });
      msg.textContent = "日程を追加しました。";
      msg.style.color = "green";
      document.getElementById("newDateInput").value = "";
      displayDates();
    } catch (e) {
      console.error("日程追加失敗:", e);
      msg.textContent = "日程の追加に失敗しました。";
      msg.style.color = "red";
    }
  });

  async function cleanUpLogs(dateStr) {
    console.log(`=== ログクリーンアップ開始: ${dateStr} ===`);
    
    try {
      // 効率的なクエリ: 特定の日付のログのみ取得
      const q = query(collection(db, "logs"), where("date", "==", dateStr));
      const snapshot = await getDocs(q);
      const docs = snapshot.docs;
      let deleteCount = 0;
      
      console.log(`マッチしたログ件数: ${docs.length}`);
      docs.forEach(doc => {
        console.log(`削除対象ログ:`, doc.id, doc.data());
      });
      
      if (docs.length === 0) {
        console.warn(`⚠️ 警告: ログで "${dateStr}" にマッチするデータが見つかりません`);
        return { 
          success: false, 
          count: 0, 
          message: `⚠️ 警告: ログで "${dateStr}" にマッチするデータが見つかりません。キー形式を確認してください。` 
        };
      }

      // バッチ分割処理（Firestoreの500件制限対応）
      const BATCH_SIZE = 500;
      const batches = [];
      
      for (let i = 0; i < docs.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const batchDocs = docs.slice(i, i + BATCH_SIZE);
        
        batchDocs.forEach(docSnapshot => {
          batch.delete(docSnapshot.ref);
          deleteCount++;
        });
        
        batches.push(batch);
      }
      
      // 全てのバッチを順次実行
      for (const batch of batches) {
        await batch.commit();
        console.log(`ログバッチ削除完了: ${deleteCount}件`);
      }
      
      return { success: true, count: deleteCount, message: `${deleteCount} 件の不要ログを削除しました。` };

    } catch (error) {
      console.error("ログのクリーンアップ中にエラー:", error);
      return { success: false, count: 0, message: "ログのクリーンアップでエラーが発生しました: " + error.message };
    }
  }

  async function cleanUpUserAnswers(dateStr) {
    console.log(`=== ユーザー回答クリーンアップ開始: ${dateStr} ===`);
    
    try {
      const snapshot = await getDocs(collection(db, "users"));
      const docsToUpdate = [];
      
      // 更新対象のドキュメントを特定
      snapshot.forEach(docSnapshot => {
        const data = docSnapshot.data();
        const answers = data.answers || {};
        
        console.log(`ユーザー ${docSnapshot.id} の回答キー:`, Object.keys(answers));
        
        // hasOwnPropertyで存在チェック（falsy値でも正しく処理）
        if (answers.hasOwnProperty(dateStr)) {
          console.log(`✓ マッチ発見: ユーザー ${docSnapshot.id} に "${dateStr}" の回答あり:`, answers[dateStr]);
          
          const updatedAnswers = { ...answers };
          delete updatedAnswers[dateStr];
          
          docsToUpdate.push({
            ref: docSnapshot.ref,
            userId: docSnapshot.id,
            answers: updatedAnswers
          });
        } else {
          console.log(`✗ マッチなし: ユーザー ${docSnapshot.id} に "${dateStr}" の回答なし`);
        }
      });
      
      console.log(`更新対象ユーザー数: ${docsToUpdate.length}`);
      
      if (docsToUpdate.length === 0) {
        console.warn(`⚠️ 警告: ユーザー回答で "${dateStr}" にマッチするデータが見つかりません`);
        return { 
          success: false, 
          count: 0, 
          message: `⚠️ 警告: ユーザー回答で "${dateStr}" にマッチするデータが見つかりません。キー形式を確認してください。` 
        };
      }

      // バッチ分割処理（Firestoreの500件制限対応）
      const BATCH_SIZE = 500;
      const batches = [];
      let updateCount = 0;
      
      for (let i = 0; i < docsToUpdate.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const batchDocs = docsToUpdate.slice(i, i + BATCH_SIZE);
        
        batchDocs.forEach(docUpdate => {
          console.log(`バッチ更新予定: ユーザー ${docUpdate.userId}`);
          
          batch.update(docUpdate.ref, {
            answers: docUpdate.answers,
            updatedAt: serverTimestamp()
          });
          updateCount++;
        });
        
        batches.push(batch);
      }
      
      // 全てのバッチを順次実行
      for (const batch of batches) {
        await batch.commit();
        console.log(`ユーザーバッチ更新完了: ${updateCount}件`);
      }
      
      return { success: true, count: updateCount, message: `${updateCount} 名のユーザーから該当日程のデータを削除しました。` };

    } catch (error) {
      console.error("ユーザーデータのクリーンアップ中にエラー:", error);
      return { success: false, count: 0, message: "ユーザーデータのクリーンアップでエラーが発生しました: " + error.message };
    }
  }

  async function removeDate(dateStr) {
    const msg = document.getElementById("datesMessage");
    msg.textContent = "";

    // デバッグ情報を先に確認
    console.log(`=== 削除開始: "${dateStr}" ===`);
    await debugDateData(dateStr);

    if (!confirm(`今削除しようとしている日程は「${dateStr}」です。本当に削除しますか？\n\n※この操作により以下のデータが削除されます：\n・該当日程の設定\n・全ユーザーの該当日程への回答\n・該当日程に関するログ\n\n⚠️ 削除前にコンソールでデバッグ情報を確認してください。`)) return;

    try {
      msg.textContent = "関連データをクリーンアップ中...";
      msg.style.color = "blue";
      
      // 1. 先にユーザーデータのクリーンアップ
      const userResult = await cleanUpUserAnswers(dateStr);
      if (!userResult.success) {
        msg.textContent = userResult.message;
        msg.style.color = "orange";
        console.warn("ユーザーデータクリーンアップで警告:", userResult.message);
        
        if (!confirm("ユーザーデータで該当日程が見つかりませんでした。続行しますか？")) {
          return;
        }
      }
      
      // 2. ログデータのクリーンアップ
      const logResult = await cleanUpLogs(dateStr);
      if (!logResult.success) {
        msg.textContent = logResult.message;
        msg.style.color = "orange";
        console.warn("ログデータクリーンアップで警告:", logResult.message);
        
        if (!confirm("ログデータで該当日程が見つかりませんでした。続行しますか？")) {
          return;
        }
      }
      
      msg.textContent = "設定から日程を削除中...";
      
      // 3. クリーンアップ成功後に設定から日程を削除
      await updateDoc(doc(db, "settings", "eventDates"), {
        list: arrayRemove(dateStr)
      });
      
      // 成功メッセージで結果を表示
      const totalProcessed = userResult.count + logResult.count;
      if (totalProcessed > 0) {
        msg.textContent = `日程と関連データを削除しました。(ユーザー: ${userResult.count}件, ログ: ${logResult.count}件)`;
        msg.style.color = "green";
      } else {
        msg.textContent = "⚠️ 日程を削除しましたが、関連データは見つかりませんでした。キー形式を確認してください。";
        msg.style.color = "orange";
      }
      
      displayDates();
      
    } catch (e) {
      console.error("日程削除失敗:", e);
      msg.textContent = "日程の削除に失敗しました: " + e.message;
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
        const data = docSnap.data();
        const dates = data.list || [];
        dates[index] = newDateStr;
        await updateDoc(docRef, { list: dates });
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

  async function addLog({ userId, uid, from, to, date }) {
    try {
      await addDoc(collection(db, "logs"), {
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
      const q = query(collection(db, "logs"), orderBy("timestamp", "desc"), limit(100));
      const snapshot = await getDocs(q);
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
      console.log("log内容:", log);
      const tr = document.createElement("tr");

      const userTd = document.createElement("td");
      userTd.textContent = log.userId || "-";
      tr.appendChild(userTd);

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

      const uidTd = document.createElement("td");
      uidTd.textContent = log.uid || "-";
      tr.appendChild(uidTd);

      tbody.appendChild(tr);
    }
  }

  async function populateDateFilterOptions() {
    const select = document.getElementById("dateFilter");
    select.innerHTML = "";
    try {
      const docSnap = await getDoc(doc(db, "settings", "eventDates"));
      if (docSnap.exists()) {
        const dates = docSnap.data().list || [];
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

  async function sha256(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  }

  document.getElementById("loginBtn").addEventListener("click", async () => {
    const id = document.getElementById("adminId").value.trim();
    const pw = document.getElementById("adminPw").value;

    const msg = document.getElementById("loginMessage");
    msg.textContent = "";
    msg.style.color = "red";

    try {
      const docSnap = await getDoc(doc(db, "adminUsers", id));

      if (!docSnap.exists()) {
        msg.textContent = "管理者に連絡してください（エラーコード：200）";
        return;
      }

      const data = docSnap.data(); 
      const hashedPw = await sha256(pw);

      if (data.password !== hashedPw) {
        msg.textContent = "パスワードが間違っています。";
        return;
      }
      currentUserId = id;

      document.getElementById("loginSection").classList.add("hidden");
      document.getElementById("adminSection").classList.remove("hidden");

      await displayMaxCapacity();
      await displayDates();
      await populateDateFilterOptions();
      const logs = await fetchLogs();
      renderLogs(logs);

      // ログイン後にデバッグ情報を表示
      await debugDataStructure();

    } catch (error) {
      console.error("ログイン中にエラー:", error);
      msg.textContent = "ログイン処理中にエラーが発生しました。";
    }
  }); 

  async function applyFilter() {
    const userFilter = document.getElementById("userFilter").value.trim().toLowerCase();
    const uidFilter = document.getElementById("uidFilter").value.trim().toLowerCase();  
    const dateFilter = document.getElementById("dateFilter");
    const selectedDates = Array.from(dateFilter.selectedOptions).map(option => option.value);
    let logs = await fetchLogs();
    if (userFilter) {
      logs = logs.filter(log => (log.userId || "").toLowerCase().includes(userFilter));
    }
    if (uidFilter) {
      logs = logs.filter(log => (log.uid || "").toLowerCase().includes(uidFilter));
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

  async function loadLogs() {
    const logs = await fetchLogs();
    renderLogs(logs);
  }

  document.getElementById("updateCapacityBtn").addEventListener("click", updateMaxCapacity);
  document.getElementById("applyFilterBtn").addEventListener("click", applyFilter);
  document.getElementById("clearFilterBtn").addEventListener("click", clearFilter);
});
