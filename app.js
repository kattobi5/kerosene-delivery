// 顧客マスタをロード
async function loadCustomers() {
  const response = await fetch("customers.json");
  const data = await response.json();
  return data;
}

let customers = [];

// ページ読み込み時に顧客マスタを読み込む
window.addEventListener("DOMContentLoaded", async () => {
  customers = await loadCustomers();
  console.log("顧客マスタ読込完了:", customers);

  // 顧客選択UIに反映
  populateCustomerSelector();
});
function populateCustomerSelector() {
  const select = document.getElementById("customerSelect");
  select.innerHTML = ""; // 初期化

  customers.forEach(cust => {
    const option = document.createElement("option");
    option.value = cust.customerCode;
    option.textContent = `${cust.kana}（${cust.officialName}）`;
    select.appendChild(option);
  });
}
function onCustomerChange() {
  const select = document.getElementById("customerSelect");
  const selectedCode = select.value;

  const cust = customers.find(c => c.customerCode === selectedCode);

  if (!cust) return;

  const tankArea = document.getElementById("tankList");
  tankArea.innerHTML = "";

  cust.tanks.forEach((tank, index) => {
    const div = document.createElement("div");
    div.innerHTML = `
      <label>${tank}</label>
      <input type="number" id="tank_${index}" placeholder="給油量（L）">
    `;
    tankArea.appendChild(div);
  });
}

function openJsonDialog() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.style.display = 'none';

  input.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (Array.isArray(data) && data.length > 0 && data[0].customerCode) {
        customers = data;
        populateCustomerSelectFromImport();
        alert('customers.json を取り込みました');
      } else if (Array.isArray(data) && data.length > 0 && data[0].tankId) {
        tanks = data;
        alert('tanks.json を取り込みました');
      } else {
        alert('JSONの形式が正しくありません');
      }
    } catch (err) {
      console.error(err);
      alert('JSON解析に失敗しました');
    }

    document.body.removeChild(input);
  });

  document.body.appendChild(input);
  input.click();
}

function populateCustomerSelectFromImport() {
  const customerSelect = document.getElementById('customerSelect');
  customerSelect.innerHTML = '';

  customers.forEach(c => {
    const option = document.createElement('option');
    option.value = c.customerCode;
    option.textContent = `${c.customerCode} : ${c.customerName}`;
    customerSelect.appendChild(option);
  });
}
