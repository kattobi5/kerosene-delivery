//============================================================
// 灯油配送管理システム - メインスクリプト
//============================================================

//------------------------------------------------------------
// グローバル変数
//------------------------------------------------------------
let customers = [];
let tanks = [];
let db;

//------------------------------------------------------------
// IndexedDB初期化
//------------------------------------------------------------
function initDB() {
  const req = indexedDB.open("oilDB", 1);

  req.onupgradeneeded = (e) => {
    db = e.target.result;
    if (!db.objectStoreNames.contains("records")) {
      db.createObjectStore("records", { keyPath: "id", autoIncrement: true });
    }
  };

  req.onsuccess = (e) => {
    db = e.target.result;
    console.log("IndexedDB initialized");
  };

  req.onerror = (e) => {
    console.error("IndexedDB error:", e);
    alert("データベースの初期化に失敗しました");
  };
}

//------------------------------------------------------------
// 初期データ読み込み
//------------------------------------------------------------
async function loadCustomers() {
  try {
    const res = await fetch("customers.json");
    customers = await res.json();
    populateCustomerSelect();
    console.log("顧客マスタ読込完了:", customers.length, "件");
  } catch (e) {
    console.error("顧客マスタ読込エラー:", e);
  }
}

async function loadTanks() {
  try {
    const res = await fetch("tanks.json");
    tanks = await res.json();
    console.log("タンクマスタ読込完了:", tanks.length, "件");
  } catch (e) {
    console.error("タンクマスタ読込エラー:", e);
  }
}

//------------------------------------------------------------
// 顧客ドロップダウン更新
//------------------------------------------------------------
function populateCustomerSelect() {
  const select = document.getElementById("customerSelect");
  select.innerHTML = '<option value="">-- 顧客を選択 --</option>';
  
  customers.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c.customerCode;
    opt.textContent = `${c.customerCode} : ${c.officialName}`;
    select.appendChild(opt);
  });
}

//------------------------------------------------------------
// 顧客選択 → タンク一覧更新
//------------------------------------------------------------
function onCustomerChange() {
  const code = document.getElementById("customerSelect").value;
  const container = document.getElementById("tankContainer");

  if (!code) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⛽</div>
        <p>顧客を選択すると、タンク情報が表示されます</p>
      </div>
    `;
    return;
  }

  const cust = customers.find(c => c.customerCode === code);
  if (!cust) return;

  const custTanks = tanks.filter(t => t.customerCode === code);

  if (custTanks.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <p>この顧客にはタンク情報が登録されていません</p>
      </div>
    `;
    return;
  }

  container.innerHTML = "";

  custTanks.forEach((t, idx) => {
    const div = document.createElement("div");
    div.className = "tank-box";
    div.innerHTML = `
      <div class="tank-header">
        <div>
          <div class="tank-name">${t.tankName}</div>
          <div class="tank-info">タンクID: ${t.tankId}</div>
        </div>
        <div class="tank-capacity">容量: ${t.tankCapacity}L</div>
      </div>
      <label for="tankQty_${idx}">給油量 (L)</label>
      <input 
        type="number" 
        id="tankQty_${idx}" 
        min="0" 
        max="${t.tankCapacity}"
        step="1"
        placeholder="0"
        inputmode="decimal"
      >
    `;
    container.appendChild(div);
  });
}

//------------------------------------------------------------
// JSON取り込み
//------------------------------------------------------------
function importJSON() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.multiple = true; // 複数ファイル選択可能に

  input.onchange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    let customersLoaded = false;
    let tanksLoaded = false;

    for (const file of files) {
      try {
        const text = await file.text();
        const data = JSON.parse(text);

        // customers.json判定
        if (Array.isArray(data) && data.length > 0 && data[0]?.customerCode && data[0]?.officialName) {
          customers = data;
          populateCustomerSelect();
          customersLoaded = true;
          console.log("customers.json取り込み完了");
        }
        // tanks.json判定
        else if (Array.isArray(data) && data.length > 0 && data[0]?.tankId) {
          tanks = data;
          tanksLoaded = true;
          console.log("tanks.json取り込み完了");
        }
        else {
          alert(`${file.name}: JSON形式が不正です`);
        }
      } catch (err) {
        console.error(err);
        alert(`${file.name}: JSON解析に失敗しました`);
      }
    }

    // 結果通知
    if (customersLoaded && tanksLoaded) {
      alert("✅ customers.json と tanks.json を取り込みました！");
    } else if (customersLoaded) {
      alert("✅ customers.json を取り込みました");
    } else if (tanksLoaded) {
      alert("✅ tanks.json を取り込みました");
    }
  };

  document.body.appendChild(input);
  input.click();
  setTimeout(() => document.body.removeChild(input), 500);
}

//------------------------------------------------------------
// 給油データ保存
//------------------------------------------------------------
function saveRecord() {
  const code = document.getElementById("customerSelect").value;
  
  if (!code) {
    alert("⚠️ 顧客を選択してください");
    return;
  }

  const cust = customers.find(c => c.customerCode === code);
  if (!cust) return;

  const custTanks = tanks.filter(t => t.customerCode === code);
  let savedCount = 0;

  const tx = db.transaction(["records"], "readwrite");
  const store = tx.objectStore("records");
  const now = new Date();

  custTanks.forEach((t, idx) => {
    const qtyInput = document.getElementById(`tankQty_${idx}`);
    const qty = Number(qtyInput.value);
    
    if (!qty || qty <= 0) return;

    const unit = cust.unitPrice || 0;
    const amount = qty * unit;
    const tax = Math.round(amount * 0.1);
    const total = amount + tax;

    store.put({
      custCode: cust.customerCode,
      custName: cust.officialName,
      date: now.toLocaleDateString('ja-JP'),
      time: now.toLocaleTimeString('ja-JP'),
      tankId: t.tankId,
      tankName: t.tankName,
      qty,
      unitPrice: unit,
      amount,
      tax,
      total
    });

    savedCount++;
    
    // 保存後に入力欄をクリア
    qtyInput.value = "";
  });

  tx.oncomplete = () => {
    if (savedCount > 0) {
      alert(`✅ ${savedCount}件の給油データを保存しました`);
    } else {
      alert("⚠️ 給油量が入力されていません");
    }
  };

  tx.onerror = () => {
    alert("❌ データ保存に失敗しました");
  };
}

//------------------------------------------------------------
// タイムスタンプ生成（ファイル名用）
//------------------------------------------------------------
function getTimestamp() {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(-2);
  const MM = String(d.getMonth() + 1).padStart(2, '0');
  const DD = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${yy}${MM}${DD}${hh}${mm}${ss}`;
}

//------------------------------------------------------------
// CSV出力
//------------------------------------------------------------
function exportTodayCSV() {
  const today = new Date().toLocaleDateString('ja-JP');
  const tx = db.transaction(["records"], "readonly");
  const store = tx.objectStore("records");
  const rows = [];

  store.openCursor().onsuccess = (e) => {
    const cur = e.target.result;
    if (cur) {
      if (cur.value.date === today) {
        rows.push(cur.value);
      }
      cur.continue();
    } else {
      if (rows.length === 0) {
        alert("⚠️ 本日のデータがありません");
        return;
      }
      makeCSV(rows);
      // CSV出力後にデータ削除
      clearTodayData();
    }
  };
}

//------------------------------------------------------------
// CSV生成とダウンロード
//------------------------------------------------------------
async function makeCSV(rows) {
  let csv = "得意先cd,得意先名,売上日,給油時刻,売上区分,数量,単価,金額,消費税,合計額,入金額,タンクID\n";

  rows.forEach(r => {
    csv += `${r.custCode},${r.custName},${r.date},${r.time},売掛,${r.qty},${r.unitPrice},${r.amount},${r.tax},${r.total},0,${r.tankId}\n`;
  });

  const filename = `delivery_${getTimestamp()}.csv`;

  try {
    // Safari判定
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

    // File System Access API対応（Safari以外）
    if (window.showSaveFilePicker && !isSafari) {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{
          description: "CSV File",
          accept: { "text/csv": [".csv"] }
        }],
        excludeAcceptAllOption: false,
        startIn: "documents"
      });

      const writable = await handle.createWritable();
      await writable.write(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
      await writable.close();
      alert(`✅ ${filename} を保存しました\n${rows.length}件のデータを出力`);
    } else {
      // Safari/iOS用：ダウンロード
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      alert(`✅ ${filename} をダウンロードしました\n${rows.length}件のデータを出力\n\n共有シートからiCloud Driveに保存できます`);
    }
  } catch (e) {
    console.error(e);
    if (e.name !== 'AbortError') {
      alert("❌ CSV保存に失敗しました");
    }
  }
}

//------------------------------------------------------------
// 今日のデータ削除
//------------------------------------------------------------
function clearTodayData() {
  const today = new Date().toLocaleDateString('ja-JP');
  const tx = db.transaction(["records"], "readwrite");
  const store = tx.objectStore("records");
  let deletedCount = 0;

  store.openCursor().onsuccess = (e) => {
    const cur = e.target.result;
    if (cur) {
      if (cur.value.date === today) {
        cur.delete();
        deletedCount++;
      }
      cur.continue();
    } else {
      console.log(`${deletedCount}件のデータを削除しました`);
    }
  };
}

//------------------------------------------------------------
// 初期化処理
//------------------------------------------------------------
window.addEventListener("DOMContentLoaded", () => {
  initDB();
  loadCustomers();
  loadTanks();
  console.log("灯油配送管理システム起動");
});