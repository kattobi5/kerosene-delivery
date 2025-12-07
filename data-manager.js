//============================================================
// データ管理機能 - data-manager.js
//============================================================

//------------------------------------------------------------
// 過去データ閲覧
//------------------------------------------------------------
function viewPastData() {
  if (!db) {
    alert("⚠️ データベースが初期化されていません");
    return;
  }

  const tx = db.transaction(["records"], "readonly");
  const store = tx.objectStore("records");
  const allRecords = [];

  store.openCursor().onsuccess = (e) => {
    const cur = e.target.result;
    if (cur) {
      allRecords.push(cur.value);
      cur.continue();
    } else {
      if (allRecords.length === 0) {
        alert("📭 保存されているデータがありません");
        return;
      }
      
      showDataViewModal(allRecords);
    }
  };
}

//------------------------------------------------------------
// データ閲覧モーダル表示
//------------------------------------------------------------
function showDataViewModal(records) {
  // 日付でグループ化
  const groupedByDate = {};
  records.forEach(r => {
    if (!groupedByDate[r.date]) {
      groupedByDate[r.date] = [];
    }
    groupedByDate[r.date].push(r);
  });

  // 日付の降順でソート
  const dates = Object.keys(groupedByDate).sort((a, b) => {
    return new Date(b) - new Date(a);
  });

  let html = `
    <div id="dataViewModal" style="
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.8);
      z-index: 9999;
      overflow-y: auto;
      padding: 20px;
    ">
      <div style="
        max-width: 800px;
        margin: 0 auto;
        background: var(--bg-card);
        border-radius: 12px;
        padding: 24px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      ">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h2 style="margin: 0; color: var(--text-primary);">📊 過去データ一覧</h2>
          <button onclick="closeDataViewModal()" style="
            background: var(--danger-color);
            min-height: 40px;
            width: 40px;
            padding: 8px;
            font-size: 20px;
          ">✕</button>
        </div>
        
        <!-- フィルター -->
        <div style="
          background: var(--bg-secondary);
          padding: 16px;
          border-radius: 8px;
          margin-bottom: 20px;
        ">
          <div style="
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin-bottom: 12px;
          ">
            <select id="filterExported" onchange="filterDataView()" style="
              padding: 8px;
              border-radius: 6px;
              border: 2px solid var(--border-color);
              background: var(--bg-card);
              color: var(--text-primary);
            ">
              <option value="all">すべて</option>
              <option value="unexported">⚠️ 未出力のみ</option>
              <option value="exported">✅ 出力済のみ</option>
            </select>
            <input type="text" id="filterCustomer" onkeyup="filterDataView()" placeholder="🔍 顧客名で検索" style="
              padding: 8px;
              border-radius: 6px;
              border: 2px solid var(--border-color);
              background: var(--bg-card);
              color: var(--text-primary);
            ">
          </div>
          <div id="filterResult" style="
            color: var(--text-secondary);
            font-size: 14px;
          ">
            全${records.length}件のデータ（${dates.length}日分）
          </div>
        </div>
        
        <div id="dataViewContent">
  `;

  dates.forEach(date => {
    const dayRecords = groupedByDate[date];
    const totalQty = dayRecords.reduce((sum, r) => sum + r.qty, 0);
    const totalAmount = dayRecords.reduce((sum, r) => sum + r.total, 0);
    const unexportedCount = dayRecords.filter(r => !r.exported).length;
    const exportedCount = dayRecords.filter(r => r.exported).length;

    html += `
      <div data-day-container style="
        background: var(--bg-secondary);
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 16px;
        border-left: 4px solid ${unexportedCount > 0 ? 'var(--danger-color)' : 'var(--accent-color)'};
      ">
        <div style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          flex-wrap: wrap;
          gap: 8px;
        ">
          <div style="font-size: 18px; font-weight: bold; color: var(--text-primary);">
            📅 ${date}
          </div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            ${unexportedCount > 0 ? `
              <div style="
                background: var(--danger-color);
                color: white;
                padding: 6px 12px;
                border-radius: 6px;
                font-weight: 600;
              ">
                ⚠️ 未出力 ${unexportedCount}件
              </div>
            ` : ''}
            ${exportedCount > 0 ? `
              <div style="
                background: var(--success-color);
                color: white;
                padding: 6px 12px;
                border-radius: 6px;
                font-weight: 600;
              ">
                ✅ 出力済 ${exportedCount}件
              </div>
            ` : ''}
            <div style="
              background: var(--accent-color);
              color: white;
              padding: 6px 12px;
              border-radius: 6px;
              font-weight: 600;
            ">
              ${totalQty}L / ¥${totalAmount.toLocaleString()}
            </div>
          </div>
        </div>
        
        <table style="
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
          background: var(--bg-card);
          border-radius: 6px;
          overflow: hidden;
        ">
          <thead>
            <tr style="background: var(--bg-secondary);">
              <th style="padding: 8px; text-align: center; color: var(--text-secondary);">状態</th>
              <th style="padding: 8px; text-align: left; color: var(--text-secondary);">時刻</th>
              <th style="padding: 8px; text-align: left; color: var(--text-secondary);">顧客</th>
              <th style="padding: 8px; text-align: left; color: var(--text-secondary);">タンク</th>
              <th style="padding: 8px; text-align: right; color: var(--text-secondary);">数量</th>
              <th style="padding: 8px; text-align: right; color: var(--text-secondary);">合計</th>
            </tr>
          </thead>
          <tbody>
    `;

    dayRecords.forEach((r, idx) => {
      const statusIcon = r.exported ? '✅' : '⚠️';
      const statusColor = r.exported ? 'var(--success-color)' : 'var(--danger-color)';
      html += `
        <tr data-record-row data-exported="${r.exported ? 'true' : 'false'}" data-customer="${r.custName}" style="border-top: 1px solid var(--border-color);">
          <td style="padding: 8px; text-align: center; font-size: 16px;" title="${r.exported ? '出力済' : '未出力'}">${statusIcon}</td>
          <td style="padding: 8px; color: var(--text-primary);">${r.time}</td>
          <td style="padding: 8px; color: var(--text-primary);">${r.custName}</td>
          <td style="padding: 8px; color: var(--text-primary);">${r.tankName}</td>
          <td style="padding: 8px; text-align: right; color: var(--text-primary);">${r.qty}L</td>
          <td style="padding: 8px; text-align: right; font-weight: 600; color: var(--text-primary);">¥${r.total.toLocaleString()}</td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
      </div>
    `;
  });

  html += `
        </div>
        <div style="margin-top: 20px;">
          <button onclick="closeDataViewModal()" style="background: var(--accent-color);">
            閉じる
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', html);
}

function closeDataViewModal() {
  const modal = document.getElementById("dataViewModal");
  if (modal) modal.remove();
}

//------------------------------------------------------------
// データビューのフィルタリング
//------------------------------------------------------------
function filterDataView() {
  const exportedFilter = document.getElementById('filterExported').value;
  const customerFilter = document.getElementById('filterCustomer').value.toLowerCase();
  
  const allDays = document.querySelectorAll('[data-day-container]');
  let visibleCount = 0;
  let visibleDays = 0;
  
  allDays.forEach(dayDiv => {
    const rows = dayDiv.querySelectorAll('[data-record-row]');
    let dayHasVisible = false;
    
    rows.forEach(row => {
      const exported = row.dataset.exported === 'true';
      const customerName = row.dataset.customer.toLowerCase();
      
      let showRow = true;
      
      // 出力状態フィルター
      if (exportedFilter === 'unexported' && exported) showRow = false;
      if (exportedFilter === 'exported' && !exported) showRow = false;
      
      // 顧客名フィルター
      if (customerFilter && !customerName.includes(customerFilter)) showRow = false;
      
      if (showRow) {
        row.style.display = '';
        visibleCount++;
        dayHasVisible = true;
      } else {
        row.style.display = 'none';
      }
    });
    
    // 日付コンテナの表示制御
    if (dayHasVisible) {
      dayDiv.style.display = '';
      visibleDays++;
    } else {
      dayDiv.style.display = 'none';
    }
  });
  
  // フィルター結果表示
  const resultDiv = document.getElementById('filterResult');
  if (resultDiv) {
    resultDiv.textContent = `${visibleCount}件のデータ（${visibleDays}日分）を表示中`;
  }
}

//------------------------------------------------------------
// データバックアップ（JSON出力）
//------------------------------------------------------------
function backupData() {
  if (!db) {
    alert("⚠️ データベースが初期化されていません");
    return;
  }

  const tx = db.transaction(["records"], "readonly");
  const store = tx.objectStore("records");
  const allRecords = [];

  store.openCursor().onsuccess = (e) => {
    const cur = e.target.result;
    if (cur) {
      allRecords.push(cur.value);
      cur.continue();
    } else {
      if (allRecords.length === 0) {
        alert("📭 バックアップするデータがありません");
        return;
      }

      const json = JSON.stringify(allRecords, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup_${getTimestamp()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      alert(`✅ バックアップ完了\n\n${allRecords.length}件のデータを保存しました`);
    }
  };
}

//------------------------------------------------------------
// データ復元（JSON読み込み）
//------------------------------------------------------------
function restoreData() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';

  input.onchange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!Array.isArray(data) || data.length === 0) {
        alert("⚠️ バックアップファイルの形式が不正です");
        return;
      }

      // バックアップデータの確認
      const confirmMsg = `以下のデータを復元しますか？\n\n【件数】${data.length}件\n\n⚠️ 既存のデータは削除されます`;
      
      if (!confirm(confirmMsg)) return;

      // 既存データをクリア
      const tx1 = db.transaction(["records"], "readwrite");
      const store1 = tx1.objectStore("records");
      store1.clear();

      tx1.oncomplete = () => {
        // 新しいデータを追加
        const tx2 = db.transaction(["records"], "readwrite");
        const store2 = tx2.objectStore("records");

        data.forEach(record => {
          // idを削除（自動採番させる）
          delete record.id;
          store2.add(record);
        });

        tx2.oncomplete = () => {
          alert(`✅ データ復元完了\n\n${data.length}件のデータを復元しました`);
          updateSummary();
        };

        tx2.onerror = () => {
          alert("❌ データ復元に失敗しました");
        };
      };
    } catch (err) {
      console.error(err);
      alert("❌ バックアップファイルの読み込みに失敗しました");
    }

    document.body.removeChild(input);
  };

  document.body.appendChild(input);
  input.click();
}

//------------------------------------------------------------
// 全データ削除
//------------------------------------------------------------
function clearAllData() {
  if (!db) {
    alert("⚠️ データベースが初期化されていません");
    return;
  }

  const confirmMsg = "⚠️ 警告：全てのデータを削除します\n\nこの操作は取り消せません。\n本当に削除しますか？";
  
  if (!confirm(confirmMsg)) return;

  // 二重確認
  const confirmMsg2 = "最終確認：本当に全データを削除しますか？";
  if (!confirm(confirmMsg2)) return;

  const tx = db.transaction(["records"], "readwrite");
  const store = tx.objectStore("records");
  store.clear();

  tx.oncomplete = () => {
    alert("✅ 全データを削除しました");
    updateSummary();
  };

  tx.onerror = () => {
    alert("❌ データ削除に失敗しました");
  };
}