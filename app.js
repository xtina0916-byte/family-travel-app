// ---------- 資料層 ----------
const STORAGE_KEY = "familyTravelApp.trips.v1";

function loadTrips() {
  try {
    const trips = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    return trips.map(normalizeTrip);
  } catch {
    return [];
  }
}
function normalizeTrip(trip) {
  trip.packing = trip.packing || [];
  trip.members = trip.members || [];
  trip.expenses = trip.expenses || [];
  trip.currency = trip.currency || "NT$";
  return trip;
}
function saveTrips() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.trips));
  pushTripsToFirestore();
}
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function toLocalISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function dateRange(start, end) {
  const days = [];
  let cur = new Date(start + "T00:00:00");
  const last = new Date(end + "T00:00:00");
  while (cur <= last) {
    days.push({ date: toLocalISO(cur), items: [] });
    cur.setDate(cur.getDate() + 1);
  }
  return days.length ? days : [{ date: start, items: [] }];
}
function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  const weekday = ["日","一","二","三","四","五","六"][d.getDay()];
  return `${d.getMonth() + 1}/${d.getDate()} (${weekday})`;
}

const DEFAULT_PACKING_TEMPLATE = [
  { name: "證件與金錢", items: ["護照", "簽證/入境證明", "機票/電子登機證", "當地貨幣/信用卡", "旅遊保險資料", "駕照/國際駕照"] },
  { name: "3C 電子", items: ["手機與充電線", "行動電源", "萬國轉接頭", "相機", "耳機"] },
  { name: "衣物", items: ["換洗衣物", "外套/保暖衣物", "睡衣", "襪子/內衣褲", "拖鞋", "泳衣"] },
  { name: "個人清潔/藥品", items: ["牙刷牙膏", "保養品/防曬乳", "常備藥品", "暈車藥", "口罩", "生理用品"] },
  { name: "兒童用品", items: ["尿布/濕紙巾", "兒童奶粉/零食", "兒童常備藥", "玩具/平板", "兒童證件影本"] },
  { name: "其他", items: ["雨具", "行李秤", "環保袋", "轉換插座延長線", "隨身小包"] },
];

// ---------- 狀態 ----------
const state = {
  trips: loadTrips(),
  currentTripId: null,
  activeTab: "itinerary",
  activeDayIndex: 0,
  activeMapDayIndex: 0,
};

function currentTrip() {
  return state.trips.find(t => t.id === state.currentTripId);
}

// ---------- DOM refs ----------
const homeView = document.getElementById("homeView");
const tripView = document.getElementById("tripView");
const tripList = document.getElementById("tripList");
const emptyHint = document.getElementById("emptyHint");
const tripTitle = document.getElementById("tripTitle");
const tripDates = document.getElementById("tripDates");
const dayPills = document.getElementById("dayPills");
const dayItems = document.getElementById("dayItems");
const mapDayPills = document.getElementById("mapDayPills");
const mapList = document.getElementById("mapList");
const packingList = document.getElementById("packingList");

// ---------- 導覽 ----------
document.getElementById("homeBtn").addEventListener("click", showHome);
document.getElementById("backBtn").addEventListener("click", showHome);

function showHome() {
  state.currentTripId = null;
  homeView.classList.remove("hidden");
  tripView.classList.add("hidden");
  renderTripList();
}

function showTrip(tripId) {
  state.currentTripId = tripId;
  state.activeDayIndex = 0;
  state.activeMapDayIndex = 0;
  state.activeTab = "itinerary";
  homeView.classList.add("hidden");
  tripView.classList.remove("hidden");
  renderTrip();
}

document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    state.activeTab = btn.dataset.tab;
    document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b === btn));
    document.getElementById("itineraryTab").classList.toggle("hidden", state.activeTab !== "itinerary");
    document.getElementById("mapTab").classList.toggle("hidden", state.activeTab !== "map");
    document.getElementById("packingTab").classList.toggle("hidden", state.activeTab !== "packing");
    document.getElementById("expenseTab").classList.toggle("hidden", state.activeTab !== "expense");
    if (state.activeTab === "map") renderMapTab();
    if (state.activeTab === "packing") renderPackingTab();
    if (state.activeTab === "expense") renderExpenseTab();
  });
});

// ---------- 首頁：行程列表 ----------
function renderTripList() {
  tripList.innerHTML = "";
  emptyHint.classList.toggle("hidden", state.trips.length > 0);
  state.trips
    .slice()
    .sort((a, b) => (a.startDate || "").localeCompare(b.startDate || ""))
    .forEach(trip => {
      const card = document.createElement("div");
      card.className = "trip-card";
      card.innerHTML = `
        <h3>${escapeHtml(trip.name)}</h3>
        <div class="sub">${formatDate(trip.startDate)} - ${formatDate(trip.endDate)}・共 ${trip.days.length} 天</div>
      `;
      card.addEventListener("click", () => showTrip(trip.id));
      tripList.appendChild(card);
    });
}

document.getElementById("newTripBtn").addEventListener("click", () => {
  openModal("新增行程", [
    { name: "name", label: "行程名稱", type: "text", required: true, placeholder: "例：日本關西家族旅行" },
    { name: "startDate", label: "出發日期", type: "date", required: true },
    { name: "endDate", label: "回程日期", type: "date", required: true },
    { name: "currency", label: "幣別（顯示用）", type: "text", value: "NT$", placeholder: "例：NT$、JPY、USD" },
  ], (values) => {
    const trip = normalizeTrip({
      id: uid(),
      name: values.name,
      startDate: values.startDate,
      endDate: values.endDate,
      days: dateRange(values.startDate, values.endDate),
      currency: values.currency,
    });
    state.trips.push(trip);
    saveTrips();
    showTrip(trip.id);
  });
});

document.getElementById("editTripBtn").addEventListener("click", () => {
  const trip = currentTrip();
  openModal("編輯行程資訊", [
    { name: "name", label: "行程名稱", type: "text", required: true, value: trip.name },
    { name: "startDate", label: "出發日期", type: "date", required: true, value: trip.startDate },
    { name: "endDate", label: "回程日期", type: "date", required: true, value: trip.endDate },
    { name: "currency", label: "幣別（顯示用）", type: "text", value: trip.currency },
  ], (values) => {
    const oldDays = trip.days;
    trip.name = values.name;
    trip.startDate = values.startDate;
    trip.endDate = values.endDate;
    trip.currency = values.currency || trip.currency;
    const newDays = dateRange(values.startDate, values.endDate);
    newDays.forEach(d => {
      const old = oldDays.find(o => o.date === d.date);
      if (old) d.items = old.items;
    });
    trip.days = newDays;
    if (state.activeDayIndex >= trip.days.length) state.activeDayIndex = 0;
    saveTrips();
    renderTrip();
  });
});

document.getElementById("deleteTripBtn").addEventListener("click", () => {
  const trip = currentTrip();
  if (!confirm(`確定要刪除「${trip.name}」這個行程嗎？此動作無法復原。`)) return;
  state.trips = state.trips.filter(t => t.id !== trip.id);
  saveTrips();
  showHome();
});

// ---------- 匯出 / 匯入 ----------
document.getElementById("exportBtn").addEventListener("click", () => {
  const trip = currentTrip();
  const blob = new Blob([JSON.stringify(trip, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${trip.name.replace(/[\\/:*?"<>|]/g, "")}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById("importBtn").addEventListener("click", () => {
  document.getElementById("importFile").click();
});
document.getElementById("importFile").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      const trips = Array.isArray(data) ? data : [data];
      trips.forEach(t => {
        t.id = uid(); // 避免與現有行程 id 衝突
        state.trips.push(normalizeTrip(t));
      });
      saveTrips();
      renderTripList();
      alert(`已匯入 ${trips.length} 個行程！`);
    } catch (err) {
      alert("匯入失敗，檔案格式不正確。");
    }
  };
  reader.readAsText(file);
  e.target.value = "";
});

// ---------- 行程主畫面 ----------
function renderTrip() {
  const trip = currentTrip();
  if (!trip) return showHome();
  tripTitle.textContent = trip.name;
  tripDates.textContent = `${formatDate(trip.startDate)} - ${formatDate(trip.endDate)}・共 ${trip.days.length} 天`;
  renderDayPills();
  renderDayItems();
}

function renderDayPills() {
  const trip = currentTrip();
  dayPills.innerHTML = "";
  trip.days.forEach((day, idx) => {
    const pill = document.createElement("button");
    pill.className = "day-pill" + (idx === state.activeDayIndex ? " active" : "");
    pill.textContent = `Day ${idx + 1} ${formatDate(day.date)}`;
    pill.addEventListener("click", () => {
      state.activeDayIndex = idx;
      renderDayPills();
      renderDayItems();
    });
    dayPills.appendChild(pill);
  });
}

function renderDayItems() {
  const trip = currentTrip();
  const day = trip.days[state.activeDayIndex];
  dayItems.innerHTML = "";
  if (!day.items.length) {
    dayItems.innerHTML = `<div class="empty-day">這天還沒有安排行程，點下方新增吧！</div>`;
    return;
  }
  const sorted = day.items.slice().sort((a, b) => (a.time || "").localeCompare(b.time || ""));
  sorted.forEach(item => {
    const card = document.createElement("div");
    card.className = "activity-card";
    const mapUrl = item.location ? googleMapsSearchUrl(item.location) : "";
    card.innerHTML = `
      <div class="activity-time">${item.time || ""}</div>
      <div class="activity-body">
        <div class="activity-title">${escapeHtml(item.title)}</div>
        ${item.location ? `<div class="activity-location">📍 ${escapeHtml(item.location)}</div>` : ""}
        ${item.note ? `<div class="activity-note">${escapeHtml(item.note)}</div>` : ""}
        <div class="activity-links">
          ${mapUrl ? `<a class="map-link" href="${mapUrl}" target="_blank" rel="noopener">在 Google 地圖開啟</a>` : ""}
        </div>
      </div>
      <div class="activity-buttons">
        <button class="edit-btn" title="編輯">✏️</button>
        <button class="del-btn" title="刪除">🗑️</button>
      </div>
    `;
    card.querySelector(".edit-btn").addEventListener("click", () => editActivity(item.id));
    card.querySelector(".del-btn").addEventListener("click", () => deleteActivity(item.id));
    dayItems.appendChild(card);
  });
}

function googleMapsSearchUrl(place) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`;
}

document.getElementById("addActivityBtn").addEventListener("click", () => {
  openActivityModal();
});

function openActivityModal(existing) {
  openModal(existing ? "編輯行程項目" : "新增行程項目", [
    { name: "time", label: "時間", type: "time", value: existing?.time || "" },
    { name: "title", label: "行程內容", type: "text", required: true, placeholder: "例：抵達關西機場", value: existing?.title || "" },
    { name: "location", label: "地點（用於開啟地圖）", type: "text", placeholder: "例：關西國際機場", value: existing?.location || "" },
    { name: "note", label: "備註", type: "textarea", value: existing?.note || "" },
  ], (values) => {
    const trip = currentTrip();
    const day = trip.days[state.activeDayIndex];
    if (existing) {
      Object.assign(existing, values);
    } else {
      day.items.push({ id: uid(), ...values });
    }
    saveTrips();
    renderDayItems();
  });
}

function editActivity(itemId) {
  const trip = currentTrip();
  const day = trip.days[state.activeDayIndex];
  const item = day.items.find(i => i.id === itemId);
  if (item) openActivityModal(item);
}

function deleteActivity(itemId) {
  const trip = currentTrip();
  const day = trip.days[state.activeDayIndex];
  if (!confirm("確定要刪除這個行程項目嗎？")) return;
  day.items = day.items.filter(i => i.id !== itemId);
  saveTrips();
  renderDayItems();
}

// ---------- 地圖分頁 ----------
function renderMapTab() {
  const trip = currentTrip();
  mapDayPills.innerHTML = "";
  trip.days.forEach((day, idx) => {
    const pill = document.createElement("button");
    pill.className = "day-pill" + (idx === state.activeMapDayIndex ? " active" : "");
    pill.textContent = `Day ${idx + 1} ${formatDate(day.date)}`;
    pill.addEventListener("click", () => {
      state.activeMapDayIndex = idx;
      renderMapTab();
    });
    mapDayPills.appendChild(pill);
  });

  const day = trip.days[state.activeMapDayIndex];
  const located = day.items
    .filter(i => i.location)
    .sort((a, b) => (a.time || "").localeCompare(b.time || ""));

  mapList.innerHTML = "";
  if (!located.length) {
    mapList.innerHTML = `<div class="empty-day">這天還沒有標記地點的行程，先到「每日行程」新增吧！</div>`;
  } else {
    located.forEach((item, idx) => {
      const row = document.createElement("div");
      row.className = "map-item";
      row.innerHTML = `
        <div class="label"><span class="idx">${idx + 1}</span>${escapeHtml(item.location)}${item.time ? ` (${item.time})` : ""}</div>
        <a class="map-link" href="${googleMapsSearchUrl(item.location)}" target="_blank" rel="noopener">開啟</a>
      `;
      mapList.appendChild(row);
    });
  }

  const routeBtn = document.getElementById("openRouteBtn");
  routeBtn.onclick = () => {
    if (located.length < 2) {
      if (located.length === 1) {
        window.open(googleMapsSearchUrl(located[0].location), "_blank");
      } else {
        alert("這天還沒有足夠的地點可以規劃路線。");
      }
      return;
    }
    const origin = encodeURIComponent(located[0].location);
    const destination = encodeURIComponent(located[located.length - 1].location);
    const waypoints = located.slice(1, -1).map(i => encodeURIComponent(i.location)).join("|");
    let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
    if (waypoints) url += `&waypoints=${waypoints}`;
    window.open(url, "_blank");
  };
}

// ---------- 攜帶物品清單 ----------
function renderPackingTab() {
  const trip = currentTrip();
  packingList.innerHTML = "";
  if (!trip.packing.length) {
    packingList.innerHTML = `<div class="empty-day">還沒有清單項目，可以點「套用預設清單」快速開始，或自行新增分類。</div>`;
    return;
  }
  trip.packing.forEach(cat => {
    const catEl = document.createElement("div");
    catEl.className = "packing-category";
    const checkedCount = cat.items.filter(i => i.checked).length;
    catEl.innerHTML = `
      <div class="packing-category-header">
        <h4>${escapeHtml(cat.name)} (${checkedCount}/${cat.items.length})</h4>
        <div class="cat-actions">
          <button class="del-cat" title="刪除分類">🗑️</button>
        </div>
      </div>
      <div class="cat-items"></div>
      <div class="add-item-row">
        <input type="text" placeholder="新增項目..." />
        <button class="add-item-btn">新增</button>
      </div>
    `;
    const itemsEl = catEl.querySelector(".cat-items");
    cat.items.forEach(item => {
      const row = document.createElement("label");
      row.className = "packing-item";
      row.innerHTML = `
        <input type="checkbox" ${item.checked ? "checked" : ""}>
        <span class="${item.checked ? "checked" : ""}">${escapeHtml(item.text)}</span>
        <button type="button" class="del-item" title="刪除">✕</button>
      `;
      row.querySelector("input").addEventListener("change", (e) => {
        item.checked = e.target.checked;
        saveTrips();
        renderPackingTab();
      });
      row.querySelector(".del-item").addEventListener("click", () => {
        cat.items = cat.items.filter(i => i.id !== item.id);
        saveTrips();
        renderPackingTab();
      });
      itemsEl.appendChild(row);
    });

    const input = catEl.querySelector(".add-item-row input");
    const addBtn = catEl.querySelector(".add-item-btn");
    const addItem = () => {
      const text = input.value.trim();
      if (!text) return;
      cat.items.push({ id: uid(), text, checked: false });
      saveTrips();
      renderPackingTab();
    };
    addBtn.addEventListener("click", addItem);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addItem(); } });

    catEl.querySelector(".del-cat").addEventListener("click", () => {
      if (!confirm(`確定要刪除「${cat.name}」這個分類嗎？`)) return;
      trip.packing = trip.packing.filter(c => c.id !== cat.id);
      saveTrips();
      renderPackingTab();
    });

    packingList.appendChild(catEl);
  });
}

document.getElementById("addCategoryBtn").addEventListener("click", () => {
  openModal("新增分類", [
    { name: "name", label: "分類名稱", type: "text", required: true, placeholder: "例：文具用品" },
  ], (values) => {
    const trip = currentTrip();
    trip.packing.push({ id: uid(), name: values.name, items: [] });
    saveTrips();
    renderPackingTab();
  });
});

document.getElementById("loadTemplateBtn").addEventListener("click", () => {
  const trip = currentTrip();
  if (trip.packing.length && !confirm("已有清單內容，套用預設清單會新增預設分類（不會刪除現有項目），是否繼續？")) return;
  DEFAULT_PACKING_TEMPLATE.forEach(cat => {
    let target = trip.packing.find(c => c.name === cat.name);
    if (!target) {
      target = { id: uid(), name: cat.name, items: [] };
      trip.packing.push(target);
    }
    cat.items.forEach(text => {
      if (!target.items.some(i => i.text === text)) {
        target.items.push({ id: uid(), text, checked: false });
      }
    });
  });
  saveTrips();
  renderPackingTab();
});

document.getElementById("resetCheckBtn").addEventListener("click", () => {
  const trip = currentTrip();
  if (!confirm("確定要將這個行程的清單全部取消勾選嗎？（適合重複使用清單規劃下一趟旅行）")) return;
  trip.packing.forEach(cat => cat.items.forEach(i => (i.checked = false)));
  saveTrips();
  renderPackingTab();
});

// ---------- 旅費分攤 ----------
function renderExpenseTab() {
  renderMemberChips();
  renderExpenseList();
  renderSettlement();
}

function renderMemberChips() {
  const trip = currentTrip();
  const memberChips = document.getElementById("memberChips");
  memberChips.innerHTML = "";
  if (!trip.members.length) {
    memberChips.innerHTML = `<div class="empty-day">還沒有成員，先新增家人吧！</div>`;
    return;
  }
  trip.members.forEach(m => {
    const chip = document.createElement("span");
    chip.className = "member-chip";
    chip.innerHTML = `${escapeHtml(m.name)}<button class="del-member" title="移除">✕</button>`;
    chip.querySelector(".del-member").addEventListener("click", () => deleteMember(m.id));
    memberChips.appendChild(chip);
  });
}

document.getElementById("addMemberBtn").addEventListener("click", () => {
  openModal("新增成員", [
    { name: "name", label: "姓名/稱呼", type: "text", required: true, placeholder: "例：爸爸" },
  ], (values) => {
    const trip = currentTrip();
    trip.members.push({ id: uid(), name: values.name });
    saveTrips();
    renderExpenseTab();
  });
});

function deleteMember(memberId) {
  const trip = currentTrip();
  const member = trip.members.find(m => m.id === memberId);
  const used = trip.expenses.some(e => e.paidBy === memberId || e.splitAmong.includes(memberId));
  if (used && !confirm(`「${member.name}」已經被用在支出紀錄中，移除後相關支出的付款人/分攤對象會一併調整，確定要移除嗎？`)) return;
  trip.members = trip.members.filter(m => m.id !== memberId);
  trip.expenses.forEach(e => {
    if (e.paidBy === memberId) e.paidBy = null;
    e.splitAmong = e.splitAmong.filter(id => id !== memberId);
  });
  saveTrips();
  renderExpenseTab();
}

function formatMoney(n) {
  return (Math.round(n * 100) / 100).toLocaleString("zh-TW");
}

function renderExpenseList() {
  const trip = currentTrip();
  const expenseList = document.getElementById("expenseList");
  expenseList.innerHTML = "";
  if (!trip.expenses.length) {
    expenseList.innerHTML = `<div class="empty-day">還沒有支出紀錄，點下方新增吧！</div>`;
    return;
  }
  trip.expenses.forEach(exp => {
    const payer = trip.members.find(m => m.id === exp.paidBy);
    const splitNames = exp.splitAmong.map(id => trip.members.find(m => m.id === id)?.name).filter(Boolean).join("、");
    const card = document.createElement("div");
    card.className = "expense-card";
    card.innerHTML = `
      <div class="expense-body">
        <div class="expense-title">${escapeHtml(exp.title)}</div>
        <div class="expense-meta">${escapeHtml(trip.currency)} ${formatMoney(exp.amount)}・${payer ? escapeHtml(payer.name) : "未指定"} 支付</div>
        <div class="expense-split">均分：${splitNames || "無"}</div>
      </div>
      <div class="activity-buttons">
        <button class="edit-btn" title="編輯">✏️</button>
        <button class="del-btn" title="刪除">🗑️</button>
      </div>
    `;
    card.querySelector(".edit-btn").addEventListener("click", () => openExpenseModal(exp));
    card.querySelector(".del-btn").addEventListener("click", () => deleteExpense(exp.id));
    expenseList.appendChild(card);
  });
}

document.getElementById("addExpenseBtn").addEventListener("click", () => {
  openExpenseModal();
});

function openExpenseModal(existing) {
  const trip = currentTrip();
  if (!trip.members.length) {
    alert("請先在上方新增至少一位成員，才能記錄支出喔！");
    return;
  }
  openModal(existing ? "編輯支出" : "新增支出", [
    { name: "title", label: "項目名稱", type: "text", required: true, placeholder: "例：晚餐、飯店住宿", value: existing?.title || "" },
    { name: "amount", label: `金額 (${trip.currency})`, type: "number", required: true, step: "0.01", min: "0", value: existing?.amount ?? "" },
    {
      name: "paidBy", label: "付款人", type: "select", required: true,
      options: trip.members.map(m => ({ value: m.id, label: m.name })),
      value: existing?.paidBy || trip.members[0].id,
    },
    {
      name: "splitAmong", label: "平分對象", type: "checkboxGroup",
      options: trip.members.map(m => ({ value: m.id, label: m.name })),
      values: existing?.splitAmong || trip.members.map(m => m.id),
    },
  ], (values) => {
    const amount = parseFloat(values.amount);
    if (!amount || amount <= 0) { alert("請輸入有效的金額"); return; }
    if (!values.splitAmong.length) { alert("請至少選擇一位平分對象"); return; }
    if (existing) {
      existing.title = values.title;
      existing.amount = amount;
      existing.paidBy = values.paidBy;
      existing.splitAmong = values.splitAmong;
    } else {
      trip.expenses.push({ id: uid(), title: values.title, amount, paidBy: values.paidBy, splitAmong: values.splitAmong });
    }
    saveTrips();
    renderExpenseTab();
  });
}

function deleteExpense(expId) {
  const trip = currentTrip();
  if (!confirm("確定要刪除這筆支出嗎？")) return;
  trip.expenses = trip.expenses.filter(e => e.id !== expId);
  saveTrips();
  renderExpenseTab();
}

function computeBalances(trip) {
  const paid = {};
  const share = {};
  trip.members.forEach(m => { paid[m.id] = 0; share[m.id] = 0; });
  trip.expenses.forEach(exp => {
    if (exp.paidBy && paid[exp.paidBy] !== undefined) paid[exp.paidBy] += exp.amount;
    const among = exp.splitAmong.filter(id => share[id] !== undefined);
    if (among.length) {
      const portion = exp.amount / among.length;
      among.forEach(id => { share[id] += portion; });
    }
  });
  return trip.members.map(m => ({
    id: m.id,
    name: m.name,
    paid: paid[m.id] || 0,
    share: share[m.id] || 0,
    balance: (paid[m.id] || 0) - (share[m.id] || 0),
  }));
}

function settleUp(balances) {
  const creditors = balances.filter(b => b.balance > 0.5).map(b => ({ ...b })).sort((a, b) => b.balance - a.balance);
  const debtors = balances.filter(b => b.balance < -0.5).map(b => ({ ...b })).sort((a, b) => a.balance - b.balance);
  const transactions = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const amount = Math.min(-debtor.balance, creditor.balance);
    transactions.push({ from: debtor.name, to: creditor.name, amount });
    debtor.balance += amount;
    creditor.balance -= amount;
    if (Math.abs(debtor.balance) < 0.5) i++;
    if (Math.abs(creditor.balance) < 0.5) j++;
  }
  return transactions;
}

function renderSettlement() {
  const trip = currentTrip();
  const summaryEl = document.getElementById("settlementSummary");
  summaryEl.innerHTML = "";
  if (!trip.members.length) {
    summaryEl.innerHTML = `<div class="empty-day">新增成員與支出後，這裡會自動計算每個人該收/該付多少錢。</div>`;
    return;
  }
  const balances = computeBalances(trip);
  const total = trip.expenses.reduce((s, e) => s + e.amount, 0);

  const totalRow = document.createElement("div");
  totalRow.className = "settlement-total";
  totalRow.textContent = `總花費：${trip.currency} ${formatMoney(total)}`;
  summaryEl.appendChild(totalRow);

  const table = document.createElement("div");
  table.className = "balance-table";
  balances.forEach(b => {
    const row = document.createElement("div");
    row.className = "balance-row";
    const sign = b.balance > 0.5 ? "應收" : b.balance < -0.5 ? "應付" : "已結清";
    const cls = b.balance > 0.5 ? "positive" : b.balance < -0.5 ? "negative" : "neutral";
    row.innerHTML = `
      <span class="balance-name">${escapeHtml(b.name)}</span>
      <span class="balance-detail">已付 ${trip.currency} ${formatMoney(b.paid)}・應分擔 ${trip.currency} ${formatMoney(b.share)}</span>
      <span class="balance-amount ${cls}">${sign} ${trip.currency} ${formatMoney(Math.abs(b.balance))}</span>
    `;
    table.appendChild(row);
  });
  summaryEl.appendChild(table);

  const transactions = settleUp(balances);
  const settleEl = document.createElement("div");
  settleEl.className = "settle-transactions";
  if (!transactions.length) {
    settleEl.innerHTML = `<div class="empty-day">🎉 大家的花費都打平了，不需要互相轉帳！</div>`;
  } else {
    const heading = document.createElement("div");
    heading.className = "settle-heading";
    heading.textContent = "建議轉帳";
    settleEl.appendChild(heading);
    transactions.forEach(t => {
      const row = document.createElement("div");
      row.className = "settle-row";
      row.innerHTML = `<span>${escapeHtml(t.from)}</span> → <span>${escapeHtml(t.to)}</span> <strong>${trip.currency} ${formatMoney(t.amount)}</strong>`;
      settleEl.appendChild(row);
    });
  }
  summaryEl.appendChild(settleEl);
}

// ---------- 共用 Modal ----------
const modalOverlay = document.getElementById("modalOverlay");
const modalTitle = document.getElementById("modalTitle");
const modalForm = document.getElementById("modalForm");
document.getElementById("modalCancel").addEventListener("click", closeModal);
modalOverlay.addEventListener("click", (e) => { if (e.target === modalOverlay) closeModal(); });

function openModal(title, fields, onSubmit) {
  modalTitle.textContent = title;
  modalForm.innerHTML = "";
  fields.forEach(f => {
    const wrap = document.createElement("div");
    wrap.className = "field";
    const label = document.createElement("label");
    label.textContent = f.label;
    label.setAttribute("for", `f_${f.name}`);
    wrap.appendChild(label);
    if (f.type === "checkboxGroup") {
      const group = document.createElement("div");
      group.className = "checkbox-group";
      const checkedValues = f.values || [];
      f.options.forEach(opt => {
        const optLabel = document.createElement("label");
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.dataset.group = f.name;
        cb.dataset.value = opt.value;
        cb.checked = checkedValues.includes(opt.value);
        optLabel.appendChild(cb);
        optLabel.append(opt.label);
        group.appendChild(optLabel);
      });
      wrap.appendChild(group);
      modalForm.appendChild(wrap);
      return;
    }
    let input;
    if (f.type === "textarea") {
      input = document.createElement("textarea");
    } else if (f.type === "select") {
      input = document.createElement("select");
      f.options.forEach(opt => {
        const optionEl = document.createElement("option");
        optionEl.value = opt.value;
        optionEl.textContent = opt.label;
        input.appendChild(optionEl);
      });
    } else {
      input = document.createElement("input");
      input.type = f.type || "text";
      if (f.step !== undefined) input.step = f.step;
      if (f.min !== undefined) input.min = f.min;
    }
    input.id = `f_${f.name}`;
    input.name = f.name;
    if (f.required) input.required = true;
    if (f.placeholder) input.placeholder = f.placeholder;
    if (f.value !== undefined) input.value = f.value;
    wrap.appendChild(input);
    modalForm.appendChild(wrap);
  });
  modalOverlay.classList.remove("hidden");

  modalForm.onsubmit = (e) => {
    e.preventDefault();
    const values = {};
    fields.forEach(f => {
      if (f.type === "checkboxGroup") {
        values[f.name] = Array.from(modalForm.querySelectorAll(`input[data-group="${f.name}"]:checked`)).map(cb => cb.dataset.value);
      } else {
        values[f.name] = document.getElementById(`f_${f.name}`).value.trim();
      }
    });
    closeModal();
    onSubmit(values);
  };

  setTimeout(() => {
    const firstInput = modalForm.querySelector("input,textarea");
    if (firstInput) firstInput.focus();
  }, 50);
}
function closeModal() {
  modalOverlay.classList.add("hidden");
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

// ---------- Firebase 雲端同步 ----------
const FIRESTORE_COLLECTION = "familyTravelApp";
const FIRESTORE_DOC = "sharedData";
let firebaseReady = false;
let applyingRemoteUpdate = false;

function setSyncStatus(text, cls) {
  const el = document.getElementById("syncStatus");
  if (!el) return;
  el.textContent = text;
  el.className = "sync-status" + (cls ? ` ${cls}` : "");
}

function refreshCurrentView() {
  if (!state.currentTripId) {
    renderTripList();
    return;
  }
  const trip = currentTrip();
  if (!trip) {
    showHome();
    return;
  }
  renderTrip();
  if (state.activeTab === "map") renderMapTab();
  if (state.activeTab === "packing") renderPackingTab();
  if (state.activeTab === "expense") renderExpenseTab();
}

function pushTripsToFirestore() {
  if (!firebaseReady || applyingRemoteUpdate) return;
  firebase.firestore().collection(FIRESTORE_COLLECTION).doc(FIRESTORE_DOC)
    .set({ trips: state.trips, updatedAt: Date.now() })
    .catch(err => console.error("雲端同步寫入失敗", err));
}

function initFirebaseSync() {
  if (typeof firebase === "undefined" || typeof firebaseConfig === "undefined") {
    setSyncStatus("僅本機儲存", "offline");
    return;
  }
  firebase.initializeApp(firebaseConfig);
  setSyncStatus("連線中…");

  firebase.auth().onAuthStateChanged(user => {
    if (!user) return;
    const docRef = firebase.firestore().collection(FIRESTORE_COLLECTION).doc(FIRESTORE_DOC);
    docRef.get()
      .then(snap => {
        if (!snap.exists) {
          return docRef.set({ trips: state.trips, updatedAt: Date.now() });
        }
      })
      .catch(err => console.error("雲端同步初始化失敗", err))
      .finally(() => {
        firebaseReady = true;
        docRef.onSnapshot(
          snap => {
            if (!snap.exists) return;
            const data = snap.data();
            const incoming = (data.trips || []).map(normalizeTrip);
            applyingRemoteUpdate = true;
            state.trips = incoming;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state.trips));
            refreshCurrentView();
            applyingRemoteUpdate = false;
            setSyncStatus("已同步", "synced");
          },
          err => {
            console.error("雲端同步監聽失敗", err);
            setSyncStatus("離線（僅本機）", "offline");
          }
        );
      });
  });

  firebase.auth().signInAnonymously().catch(err => {
    console.error("雲端登入失敗", err);
    setSyncStatus("離線（僅本機）", "offline");
  });
}

// ---------- 啟動 ----------
showHome();
initFirebaseSync();

// ---------- Service Worker (PWA 離線支援) ----------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
