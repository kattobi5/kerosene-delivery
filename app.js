//============================================================
// 灯油配送管理システム - メインスクリプト v3.2
//============================================================

//------------------------------------------------------------
// 定数定義
//------------------------------------------------------------
const CONFIG = {
  DB_NAME: "oilDB",
  DB_VERSION: 3,
  DATA_RETENTION_DAYS: 30,  // データ保持期間（日数）
  AUTO_FOCUS_DELAY: 300     // 自動フォーカスの遅延（ms）
};

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
  const req = indexedDB.open(CONFIG.DB_NAME, CONFIG.DB_VERSION);

  req.onupgradeneeded = (e) => {
    db = e.target.result;
    const oldVersion = e.oldVersion;
    
    // 給油記録用
    if (!db.objectStoreNames.contains("records")) {
      const recordStore = db.createObjectStore("records", { keyPath: "id", autoIncrement: true });
      recordStore.createIndex("date", "date", { unique: false });
      recordStore.createIndex("exported", "exported", { unique: false });
    } else if (oldVersion < 3) {
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
    
    // メタデータ用（新規追加）
    if (!db.objectStoreNames.contains("metadata")) {
      db.createObjectStore("metadata", { keyPath: "key" });
    }
  };

  req.onsuccess = (e) => {
    db = e.target.result;
    console.log(`IndexedDB initialized (version ${CONFIG.DB_VERSION})`);
    
    // マスタをDBから読み込み
    loadMastersFromDB();
    
    // 古いデータの自動クリーンアップ
    cleanupOldData();
    
    // マスタ取り込み日時を表示
    displayMasterImportDate();
  };

  req.onerror = (e) => {
    console.error("IndexedDB error:", e);
    showError("データベースの初期化に失敗しました", "ブラウザの設定を確認してください");
  };
  
  req.onblocked = () => {
    showError("データベースがブロックされています", "他のタブを閉じてページを再読み込みしてください");
  };
}

//------------------------------------------------------------
// エラー表示（統一）
//------------------------------------------------------------
function showError(title, message) {
  alert(`❌ ${title}\n\n${message}`);
}

//------------------------------------------------------------
// 古いデータの自動クリーンアップ
//------------------------------------------------------------
function cleanupOldData() {
  if (!db) return;
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - CONFIG.DATA_RETENTION_DAYS);
  const cutoffDateStr = cutoffDate.toLocaleDateString('ja-JP');
  
  const tx = db.transaction(["records"], "readwrite");
  const store = tx.objectStore("records");
  let deletedCount = 0;
  
  store.openCursor().onsuccess = (e) => {
    const cur = e.target.result;
    if (cur) {
      const record = cur.value;
      
      // 出力済み かつ 保持期間を超えたデータを削除
      if (record.exported === true && record.date < cutoffDateStr) {
        cur.delete();
        deletedCount++;
      }
      cur.continue();
    } else {
      if (deletedCount > 0) {
        console.log(`古いデータをクリーンアップ: ${deletedCount}件削除（${CONFIG.DATA_RETENTION_DAYS}日以上前）`);
      }
    }
  };
  
  tx.onerror = () => {
    console.error("クリーンアップ失敗");
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
  
  customerReq.onerror = () => {
    showError("顧客マスタの読み込みに失敗しました", "ページを再読み込みしてください");
  };
  
  // タンクマスタ読み込み
  const tx2 = db.transaction(["tanks"], "readonly");
  const tankStore = tx2.objectStore("tanks");
  const tankReq = tankStore.getAll();
  
  tankReq.onsuccess = (e) => {
    tanks = e.target.result || [];
    console.log("タンクマスタ読込:", tanks.length, "件");
  };
  
  tankReq.onerror = () => {
    showError("タンクマスタの読み込みに失敗しました", "ページを再読み込みしてください");
  };
}

//------------------------------------------------------------
// マスタ取り込み日時を表示
//------------------------------------------------------------
function displayMasterImportDate() {
  if (!db) return;
  
  const tx = db.transaction(["metadata"], "readonly");
  const store = tx.objectStore("metadata");
  const req = store.get("masterImportDate");
  
  req.onsuccess = (e) => {
    const data = e.target.result;
    if (data && data.value) {
      const date = new Date(data.value);
      const dateStr = date.toLocaleString('ja-JP');
      
      // データ管理セクションに表示
      const infoMsg = document.querySelector('.info-message');
      if (infoMsg) {
        infoMsg.innerHTML = `
          💡 <strong>マスタ更新時</strong>：顧客・タンク情報が変更された場合はJSON取り込みで更新してください<br>
          📅 <strong>最終取り込み</strong>：${dateStr}
        `;
      }
    }
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
        data-tank-capacity="${t.tankCapacity}"
        min="0" 
        max="${t.tankCapacity}"
        step="1"
        placeholder="0"
        inputmode="decimal"
        oninput="calculateTankTotal(${idx})"
        onkeypress="handleEnterKey(event, ${idx}, ${custTanks.length})"
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
  
  // 1つ目のタンクに自動フォーカス
  setTimeout(() => {
    const firstInput = document.getElementById("tankQty_0");
    if (firstInput) firstInput.focus();
  }, CONFIG.AUTO_FOCUS_DELAY);
}

//------------------------------------------------------------
// Enterキーで次の入力欄へ移動
//------------------------------------------------------------
function handleEnterKey(event, currentIdx, totalCount) {
  if (event.key === 'Enter') {
    event.preventDefault();
    const nextIdx = currentIdx + 1;
    if (nextIdx < totalCount) {
      const nextInput = document.getElementById(`tankQty_${nextIdx}`);
      if (nextInput) nextInput.focus();
    }
  }
}

//------------------------------------------------------------
// タンクごとの計算（バリデーション強化）
//------------------------------------------------------------
function calculateTankTotal(idx) {
  const input = document.getElementById(`tankQty_${idx}`);
  const qty = Number(input.value) || 0;
  const capacity = Number(input.dataset.tankCapacity);
  
  const calcDiv = document.getElementById(`calc_${idx}`);
  
  // バリデーション
  if (qty < 0) {
    input.value = 0;
    alert("⚠️ 0以上の値を入力してください");
    calcDiv.classList.remove('show');
    return;
  }
  
  if (qty > capacity) {
    input.value = capacity;
    alert(`⚠️ タンク容量（${capacity}L）を超えています\n\n容量まで自動調整しました`);
  }
  
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
// JSON取り込み（エラーハンドリング強化）
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
    const errors = [];

    for (const file of files) {
      try {
        // ファイルサイズチェック（10MB以上は警告）
        if (file.size > 10 * 1024 * 1024) {
          errors.push(`${file.name}: ファイルサイズが大きすぎます（10MB以下にしてください）`);
          continue;
        }
        
        const text = await file.text();
        const data = JSON.parse(text);

        // 配列チェック
        if (!Array.isArray(data) || data.length === 0) {
          errors.push(`${file.name}: 配列形式のJSONではありません`);
          continue;
        }

        // customers.json判定
        if (data[0]?.customerCode && data[0]?.officialName) {
          customersData = data;
          customersLoaded = true;
          console.log("customers.json取り込み:", data.length, "件");
        }
        // tanks.json判定
        else if (data[0]?.tankId && data[0]?.customerCode) {
          tanksData = data;
          tanksLoaded = true;
          console.log("tanks.json取り込み:", data.length, "件");
        }
        else {
          errors.push(`${file.name}: 顧客またはタンクのJSONではありません\n必須フィールドを確認してください`);
        }
      } catch (err) {
        console.error(err);
        errors.push(`${file.name}: ${err.message}`);
      }
    }

    // エラー表示
    if (errors.length > 0) {
      showError("JSONファイルの取り込みエラー", errors.join('\n\n'));
    }

    // DBに保存
    if (customersData) {
      await saveCustomersToDB(customersData);
    }
    
    if (tanksData) {
      await saveTanksToDB(tanksData);
    }

    // 成功時に取り込み日時を保存
    if (customersLoaded || tanksLoaded) {
      saveMasterImportDate();
    }

    // 結果通知
    if (customersLoaded && tanksLoaded) {
      alert(`✅ 取り込み完了！\n\n顧客マスタ: ${customersData.length}件\nタンクマスタ: ${tanksData.length}件`);
    } else if (customersLoaded) {
      alert(`✅ 顧客マスタを取り込みました\n\n${customersData.length}件のデータを登録しました`);
    } else if (tanksLoaded) {
      alert(`✅ タンクマスタを取り込みました\n\n${tanksData.length}件のデータを登録しました`);
    } else if (errors.length === 0) {
      alert("⚠️ 有効なJSONファイルが見つかりませんでした");
    }
  };

  document.body.appendChild(input);
  input.click();
  setTimeout(() => document.body.removeChild(input), 500);
}

//------------------------------------------------------------
// マスタ取り込み日時を保存
//------------------------------------------------------------
function saveMasterImportDate() {
  if (!db) return;
  
  const tx = db.transaction(["metadata"], "readwrite");
  const store = tx.objectStore("metadata");
  
  store.put({
    key: "masterImportDate",
    value: new Date().toISOString()
  });
  
  tx.oncomplete = () => {
    displayMasterImportDate();
  };
}

//------------------------------------------------------------
// 顧客マスタをDBに保存
//------------------------------------------------------------
function saveCustomersToDB(data) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["customers"], "readwrite");
    const store = tx.objectStore("customers");
    
    store.clear();
    
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
      resolve();
    };
    
    tx.onerror = () => {
      showError("顧客マスタの保存に失敗しました", "ブラウザのストレージ容量を確認してください");
      reject();
    };
  });
}

//------------------------------------------------------------
// タンクマスタをDBに保存
//------------------------------------------------------------
function saveTanksToDB(data) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["tanks"], "readwrite");
    const store = tx.objectStore("tanks");
    
    store.clear();
    
    data.forEach(tank => {
      store.put(tank);
    });
    
    tx.oncomplete = () => {
      console.log("タンクマスタDB保存完了");
      loadMastersFromDB();
      resolve();
    };
    
    tx.onerror = () => {
      showError("タンクマスタの保存に失敗しました", "ブラウザのストレージ容量を確認してください");
      reject();
    };
  });
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
  const recordsToSave = [];

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
        exported: false,
        exportedDate: null
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
    
    // 1つ目のタンクに再フォーカス
    setTimeout(() => {
      const firstInput = document.getElementById("tankQty_0");
      if (firstInput) firstInput.focus();
    }, 100);
  };

  tx.onerror = () => {
    showError("給油データの保存に失敗しました", "ブラウザのストレージ容量を確認してください");
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
// CSV生成とダウンロード
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
    
    markAsExported(rows);
  } catch (e) {
    console.error(e);
    if (e.name !== 'AbortError') {
      showError("CSV保存に失敗しました", "ファイルシステムへのアクセスが拒否されました");
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
  
  tx.onerror = () => {
    console.error("出力済みフラグ設定に失敗");
  };
}

//------------------------------------------------------------
// オンライン/オフライン状態管理
//------------------------------------------------------------
function updateOnlineStatus() {
  const isOnline = navigator.onLine;
  const csvButton = document.querySelector('button[onclick="exportTodayCSV()"]');
  
  if (csvButton) {
    if (isOnline) {
      csvButton.disabled = false;
      csvButton.style.opacity = '1';
      csvButton.innerHTML = '📊 CSV出力';
    } else {
      csvButton.disabled = true;
      csvButton.style.opacity = '0.5';
      csvButton.innerHTML = '🚫 CSV出力（オフライン）';
    }
  }
  
  console.log(`ネットワーク状態: ${isOnline ? 'オンライン' : 'オフライン'}`);
}

//------------------------------------------------------------
// CSV出力（オンラインチェック追加）
//------------------------------------------------------------
function exportTodayCSV() {
  // オフラインチェック
  if (!navigator.onLine) {
    alert("⚠️ オフラインのためCSV出力できません\n\nオンラインになってから再度試してください。\nデータは保存されています。");
    return;
  }
  
  const tx = db.transaction(["records"], "readonly");
  const store = tx.objectStore("records");
  const rows = [];

  store.openCursor().onsuccess = (e) => {
    const cur = e.target.result;
    if (cur) {
      const record = cur.value;
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
      
      const dates = [...new Set(rows.map(r => r.date))];
      const dateRange = dates.length === 1 ? dates[0] : `${dates[0]} 〜 ${dates[dates.length - 1]}`;
      
      const confirmMsg = `CSV出力します。よろしいですか？\n\n【期間】${dateRange}\n【件数】${rows.length}件\n【合計】${totalQty}L / ¥${totalAmount.toLocaleString()}\n\n※出力後、データに出力済みフラグが立ちます\n※${CONFIG.DATA_RETENTION_DAYS}日経過後に自動削除されます`;
      
      if (!confirm(confirmMsg)) return;
      
      makeCSV(rows);
    }
  };
  
  tx.onerror = () => {
    showError("CSV出力に失敗しました", "ページを再読み込みしてください");
  };
}

//------------------------------------------------------------
// 初期化処理
//------------------------------------------------------------
window.addEventListener("DOMContentLoaded", () => {
  initDB();
  
  // オンライン/オフライン状態の監視
  updateOnlineStatus();
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  
  console.log("灯油配送管理システム v3.2 起動");
});