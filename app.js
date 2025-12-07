//============================================================
// 灯油配送管理システム - メインスクリプト v3.1
//============================================================

//------------------------------------------------------------
// グローバル変数
//------------------------------------------------------------
let customers = [];
let tanks = [];
let db;
let currentCustomer = null;

//------------------------------------------------------------
// IndexedDB初期化
//------------------------------------------------------------
function initDB() {
  const req = indexedDB.open("oilDB", 3); // バージョン3に更新

  req.onupgradeneeded = (e) => {
    db = e.target.result;
    const oldVersion = e.oldVersion;
    
    // 給油記録用
    if (!db.objectStoreNames.contains("records")) {
      const recordStore = db.createObjectStore("records", { keyPath: "id", autoIncrement: true });
      recordStore.createIndex("date", "date", { unique: false });
      recordStore.createIndex("exported", "exported", { unique: false });
    } else if (oldVersion < 3) {
      // バージョン3で exported フィールド追加
      const tx = e.target.transaction;
      const recordStore = tx.objectStore("records");
      if (!recordStore.indexNames.contains("exported")) {
        recordStore.createIndex("exported", "exported", { unique: false });
      }
    }
    
    // 顧客マスタ用
    if (!db.objectStoreNames.contains("customers")) {
      const customerStore = db.createObjectStore("customers", { keyPath: "customerCode" });
      customerStore.createIndex("officialName", "officialName", { unique: false });
    }
    
    // タンクマスタ用
    if (!db.objectStoreNames.contains("tanks")) {
      const tankStore = db.createObjectStore("tanks", { keyPath: "tankId" });
      tankStore.createIndex("customerCode", "customerCode", { unique: false });
    }
  };

  req.onsuccess = (e) => {
    db = e.target.result;
    console.log("IndexedDB initialized (version 3)");
    
    // マスタをDBから読み込み
    loadMastersFromDB();
    
    // 古いデータの自動クリーンアップ
    cleanupOldData();
  };

  req.onerror = (e) => {
    console.error("IndexedDB error:", e);
    alert("データベースの初期化に失敗しました");
  };
}

//------------------------------------------------------------
// 古いデータの自動クリーンアップ（1ヶ月以上前の出力済みデータ）
//------------------------------------------------------------
function cleanupOldData() {
  if (!db) return;
  
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  const cutoffDate = oneMonthAgo.toLocaleDateString('ja-JP');
  
  const tx = db.transaction(["records"], "readwrite");
  const store = tx.objectStore("records");
  let deletedCount = 0;
  
  store.openCursor().onsuccess = (e) => {
    const cur = e.target.result;
    if (cur) {
      const record = cur.value;
      
      // 出力済み かつ 1ヶ月以上前のデータを削除
      // exportedフィールドがない古いデータも対象外
      if (record.exported === true && record.date < cutoffDate) {
        cur.delete();
        deletedCount++;
      }
      cur.continue();
    } else {
      if (deletedCount > 0) {
        console.log(`古いデータをクリーンアップ: ${deletedCount}件削除`);
      }
    }
  };
}

//------------------------------------------------------------
// マスタデータをIndexedDBから読み込み
//------------------------------------------------------------
function loadMastersFromDB() {
  // 顧客マスタ読み込み
  const tx1 = db.transaction(["customers"], "readonly");
  const customerStore = tx1.objectStore("customers");
  const customerReq = customerStore.getAll();
  
  customerReq.onsuccess = (e) => {
    customers = e.target.result || [];
    console.log("顧客マスタ読込:", customers.length, "件");
    
    if (customers.length > 0) {
      populateCustomerSelect();
    } else {
      showInitialSetupMessage();
    }
  };
  
  // タンクマスタ読み込み
  const tx2 = db.transaction(["tanks"], "readonly");
  const tankStore = tx2.objectStore("tanks");
  const tankReq = tankStore.getAll();
  
  tankReq.onsuccess = (e) => {
    tanks = e.target.result || [];
    console.log("タンクマスタ読込:", tanks.length, "件");
  };
}

//------------------------------------------------------------
// 初回セットアップメッセージ
//------------------------------------------------------------
function showInitialSetupMessage() {
  const container = document.getElementById("tankContainer");
  container.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">🚀</div>
      <h3 style="color: var(--text-primary); margin: 16px 0;">初回セットアップが必要です</h3>
      <p style="color: var(--text-secondary); margin-bottom: 16px;">
        顧客・タンクマスタがまだ登録されていません。<br>
        画面下部の「データ管理」セクションから<br>
        <strong>customers.json</strong> と <strong>tanks.json</strong> を取り込んでください。
      </p>
      <button onclick="scrollToDataManagement()" style="
        background: var(--accent-color);
        max-width: 300px;
        margin: 0 auto;
      ">
        📚 データ管理セクションへ
      </button>
    </div>
  `;
}

function scrollToDataManagement() {
  const section = document.querySelector('.section:last-of-type');
  if (section) {
    section.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
    if (customers.length === 0) {
      showInitialSetupMessage();
    } else {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">⛽</div>
          <p>顧客を選択すると、タンク情報が表示されます</p>
        </div>
      `;
    }
    currentCustomer = null;
    return;
  }

  currentCustomer = customers.find(c => c.customerCode === code);
  if (!currentCustomer) return;

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
        data-tank-idx="${idx}"
        min="0" 
        max="${t.tankCapacity}"
        step="1"
        placeholder="0"
        inputmode="decimal"
        oninput="calculateTankTotal(${idx})"
      >
      
      <!-- 計算結果表示 -->
      <div class="calculation-result" id="calc_${idx}">
        <div class="calc-row">
          <span class="calc-label">数量:</span>
          <span class="calc-value" id="calc_qty_${idx}">0 L</span>
        </div>
        <div class="calc-row">
          <span class="calc-label">単価:</span>
          <span class="calc-value">¥${currentCustomer.unitPrice}/L</span>
        </div>
        <div class="calc-row">
          <span class="calc-label">小計:</span>
          <span class="calc-value" id="calc_amount_${idx}">¥0</span>
        </div>
        <div class="calc-row">
          <span class="calc-label">消費税(10%):</span>
          <span class="calc-value" id="calc_tax_${idx}">¥0</span>
        </div>
        <div class="calc-row calc-total">
          <span class="calc-label">合計:</span>
          <span class="calc-value" id="calc_total_${idx}">¥0</span>
        </div>
      </div>
    `;
    container.appendChild(div);
  });
}

//------------------------------------------------------------
// タンクごとの計算
//------------------------------------------------------------
function calculateTankTotal(idx) {
  const input = document.getElementById(`tankQty_${idx}`);
  const qty = Number(input.value) || 0;
  
  const calcDiv = document.getElementById(`calc_${idx}`);
  
  if (qty <= 0) {
    calcDiv.classList.remove('show');
    return;
  }
  
  if (!currentCustomer) return;
  
  const unit = currentCustomer.unitPrice || 0;
  const amount = qty * unit;
  const tax = Math.round(amount * 0.1);
  const total = amount + tax;
  
  // 表示更新
  document.getElementById(`calc_qty_${idx}`).textContent = `${qty} L`;
  document.getElementById(`calc_amount_${idx}`).textContent = `¥${amount.toLocaleString()}`;
  document.getElementById(`calc_tax_${idx}`).textContent = `¥${tax.toLocaleString()}`;
  document.getElementById(`calc_total_${idx}`).textContent = `¥${total.toLocaleString()}`;
  
  calcDiv.classList.add('show');
}

//------------------------------------------------------------
// JSON取り込み（マスタをDBに保存）
//------------------------------------------------------------
function importJSON() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.multiple = true;

  input.onchange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    let customersLoaded = false;
    let tanksLoaded = false;
    let customersData = null;
    let tanksData = null;

    for (const file of files) {
      try {
        const text = await file.text();
        const data = JSON.parse(text);

        if (Array.isArray(data) && data.length > 0 && data[0]?.customerCode && data[0]?.officialName) {
          customersData = data;
          customersLoaded = true;
          console.log("customers.json取り込み");
        }
        else if (Array.isArray(data) && data.length > 0 && data[0]?.tankId) {
          tanksData = data;
          tanksLoaded = true;
          console.log("tanks.json取り込み");
        }
        else {
          alert(`${file.name}: JSON形式が不正です`);
        }
      } catch (err) {
        console.error(err);
        alert(`${file.name}: JSON解析に失敗しました`);
      }
    }

    // DBに保存
    if (customersData) {
      saveCustomersToDB(customersData);
    }
    
    if (tanksData) {
      saveTanksToDB(tanksData);
    }

    // 結果通知
    if (customersLoaded && tanksLoaded) {
      alert("✅ customers.json と tanks.json を取り込みました！\n\nマスタデータをデータベースに保存しました。\n次回起動時から自動的に読み込まれます。");
    } else if (customersLoaded) {
      alert("✅ customers.json を取り込みました\n\nマスタデータをデータベースに保存しました。");
    } else if (tanksLoaded) {
      alert("✅ tanks.json を取り込みました\n\nマスタデータをデータベースに保存しました。");
    }
  };

  document.body.appendChild(input);
  input.click();
  setTimeout(() => document.body.removeChild(input), 500);
}

//------------------------------------------------------------
// 顧客マスタをDBに保存
//------------------------------------------------------------
function saveCustomersToDB(data) {
  const tx = db.transaction(["customers"], "readwrite");
  const store = tx.objectStore("customers");
  
  // 既存データをクリア
  store.clear();
  
  // 新しいデータを保存
  data.forEach(customer => {
    const cleanData = {
      customerCode: customer.customerCode,
      officialName: customer.officialName,
      officialKana: customer.officialKana || "",
      unitPrice: customer.unitPrice || 0
    };
    store.put(cleanData);
  });
  
  tx.oncomplete = () => {
    console.log("顧客マスタDB保存完了");
    loadMastersFromDB();
  };
}

//------------------------------------------------------------
// タンクマスタをDBに保存
//------------------------------------------------------------
function saveTanksToDB(data) {
  const tx = db.transaction(["tanks"], "readwrite");
  const store = tx.objectStore("tanks");
  
  // 既存データをクリア
  store.clear();
  
  // 新しいデータを保存
  data.forEach(tank => {
    store.put(tank);
  });
  
  tx.oncomplete = () => {
    console.log("タンクマスタDB保存完了");
    loadMastersFromDB();
  };
}

//------------------------------------------------------------
// 給油データ保存（exported: false で保存）
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
  const recordsToSave = [];

  // 保存するデータを収集
  custTanks.forEach((t, idx) => {
    const qtyInput = document.getElementById(`tankQty_${idx}`);
    const qty = Number(qtyInput.value);
    
    if (!qty || qty <= 0) return;

    const unit = cust.unitPrice || 0;
    const amount = qty * unit;
    const tax = Math.round(amount * 0.1);
    const total = amount + tax;

    recordsToSave.push({
      tankIdx: idx,
      tankName: t.tankName,
      qty,
      amount,
      tax,
      total,
      record: {
        custCode: cust.customerCode,
        custName: cust.officialName,
        date: new Date().toLocaleDateString('ja-JP'),
        time: new Date().toLocaleTimeString('ja-JP'),
        tankId: t.tankId,
        tankName: t.tankName,
        qty,
        unitPrice: unit,
        amount,
        tax,
        total,
        exported: false,        // 未出力
        exportedDate: null      // 出力日時なし
      }
    });
  });

  if (recordsToSave.length === 0) {
    alert("⚠️ 給油量が入力されていません");
    return;
  }

  // 確認ダイアログ
  let confirmMsg = `以下の内容で保存しますか？\n\n`;
  confirmMsg += `【顧客】${cust.officialName}\n`;
  confirmMsg += `【件数】${recordsToSave.length}件\n\n`;
  
  let totalQty = 0;
  let totalAmount = 0;
  
  recordsToSave.forEach((r, i) => {
    confirmMsg += `${i + 1}. ${r.tankName}: ${r.qty}L → ¥${r.total.toLocaleString()}\n`;
    totalQty += r.qty;
    totalAmount += r.total;
  });
  
  confirmMsg += `\n【合計】${totalQty}L / ¥${totalAmount.toLocaleString()}`;

  if (!confirm(confirmMsg)) return;

  // データベースに保存
  const tx = db.transaction(["records"], "readwrite");
  const store = tx.objectStore("records");

  recordsToSave.forEach(r => {
    store.put(r.record);
  });

  tx.oncomplete = () => {
    alert(`✅ ${recordsToSave.length}件の給油データを保存しました`);
    
    // 入力欄をクリア
    recordsToSave.forEach(r => {
      const input = document.getElementById(`tankQty_${r.tankIdx}`);
      if (input) {
        input.value = "";
        const calcDiv = document.getElementById(`calc_${r.tankIdx}`);
        if (calcDiv) calcDiv.classList.remove('show');
      }
    });
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
// CSV出力（未出力データのみ）
//------------------------------------------------------------
function exportTodayCSV() {
  const tx = db.transaction(["records"], "readonly");
  const store = tx.objectStore("records");
  const rows = [];

  // 全データを取得して未出力をフィルタリング
  store.openCursor().onsuccess = (e) => {
    const cur = e.target.result;
    if (cur) {
      const record = cur.value;
      // exportedフィールドがないか false のものだけ
      if (!record.exported) {
        rows.push(record);
      }
      cur.continue();
    } else {
      if (rows.length === 0) {
        alert("⚠️ 未出力のデータがありません");
        return;
      }
      
      // 日付順にソート
      rows.sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        return a.time.localeCompare(b.time);
      });
      
      // 確認ダイアログ
      const totalQty = rows.reduce((sum, r) => sum + r.qty, 0);
      const totalAmount = rows.reduce((sum, r) => sum + r.total, 0);
      
      // 日付範囲を取得
      const dates = [...new Set(rows.map(r => r.date))];
      const dateRange = dates.length === 1 ? dates[0] : `${dates[0]} 〜 ${dates[dates.length - 1]}`;
      
      const confirmMsg = `CSV出力します。よろしいですか？\n\n【期間】${dateRange}\n【件数】${rows.length}件\n【合計】${totalQty}L / ¥${totalAmount.toLocaleString()}\n\n※出力後、データに出力済みフラグが立ちます\n※1ヶ月経過後に自動削除されます`;
      
      if (!confirm(confirmMsg)) return;
      
      makeCSV(rows);
    }
  };
}

//------------------------------------------------------------
// CSV生成とダウンロード（出力済みフラグを立てる）
//------------------------------------------------------------
async function makeCSV(rows) {
  let csv = "得意先cd,得意先名,売上日,給油時刻,売上区分,数量,単価,金額,消費税,合計額,入金額,タンクID\n";

  rows.forEach(r => {
    csv += `${r.custCode},${r.custName},${r.date},${r.time},売掛,${r.qty},${r.unitPrice},${r.amount},${r.tax},${r.total},0,${r.tankId}\n`;
  });

  const filename = `delivery_${getTimestamp()}.csv`;

  try {
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

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
      alert(`✅ ${filename} を保存しました\n\n${rows.length}件のデータを出力しました`);
    } else {
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      alert(`✅ ${filename} をダウンロードしました\n\n${rows.length}件のデータを出力しました\n\n💡 共有シートからiCloud Driveに保存できます`);
    }
    
    // 出力済みフラグを立てる
    markAsExported(rows);
  } catch (e) {
    console.error(e);
    if (e.name !== 'AbortError') {
      alert("❌ CSV保存に失敗しました");
    }
  }
}

//------------------------------------------------------------
// 出力済みフラグを立てる
//------------------------------------------------------------
function markAsExported(rows) {
  const tx = db.transaction(["records"], "readwrite");
  const store = tx.objectStore("records");
  const exportedDate = new Date().toISOString();
  
  rows.forEach(row => {
    const request = store.get(row.id);
    request.onsuccess = (e) => {
      const record = e.target.result;
      if (record) {
        record.exported = true;
        record.exportedDate = exportedDate;
        store.put(record);
      }
    };
  });
  
  tx.oncomplete = () => {
    console.log(`${rows.length}件のデータに出力済みフラグを立てました`);
  };
}

//------------------------------------------------------------
// 初期化処理
//------------------------------------------------------------
window.addEventListener("DOMContentLoaded", () => {
  initDB();
  console.log("灯油配送管理システム v3.1 起動");
});