const STORAGE_KEY = "premium-finance-state-v1";

const navItems = [
  { id: "overview", label: "Overview", icon: "⌂" },
  { id: "transactions", label: "Transactions", icon: "⇄" },
  { id: "budgets", label: "Budgets", icon: "◌" },
  { id: "pots", label: "Pots", icon: "◍" },
  { id: "bills", label: "Recurring Bills", icon: "◇" }
];

const themes = ["#277C78", "#82C9D7", "#F2CDAC", "#626070", "#826CB0", "#C94736", "#597C7C", "#93674F"];

let state = null;
let currentPage = "overview";
let txPage = 1;
let transactionControls = { search: "", sort: "latest", category: "all" };
let billControls = { search: "", sort: "latest" };

const pageRoot = document.querySelector("#page-root");
const modalLayer = document.querySelector("#modal-layer");
const toastRegion = document.querySelector("#toast-region");

document.addEventListener("DOMContentLoaded", init);

async function init() {
  state = await loadState();
  normalizeState();
  renderNavigation();
  bindGlobalEvents();
  navigate(location.hash.replace("#", "") || "overview");
}

async function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) return JSON.parse(saved);

  try {
    const response = await fetch("data.json");
    if (!response.ok) throw new Error("Could not load data.json");
    const data = await response.json();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return data;
  } catch (error) {
    showToast("Start a local server to load data.json, then refresh.");
    return { balance: { current: 0, income: 0, expenses: 0 }, transactions: [], budgets: [], pots: [] };
  }
}

function normalizeState() {
  state.transactions = state.transactions || [];
  state.budgets = (state.budgets || []).map((budget, index) => ({ id: budget.id || crypto.randomUUID(), ...budget }));
  state.pots = (state.pots || []).map((pot) => ({ id: pot.id || crypto.randomUUID(), history: pot.history || [], ...pot }));
  saveState();
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function bindGlobalEvents() {
  document.querySelector("#minimize-sidebar").addEventListener("click", () => {
    document.querySelector(".sidebar").classList.toggle("is-collapsed");
  });

  window.addEventListener("hashchange", () => navigate(location.hash.replace("#", "") || "overview"));

  modalLayer.addEventListener("click", (event) => {
    if (event.target === modalLayer) closeModal();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modalLayer.classList.contains("is-open")) closeModal();
  });
}

function renderNavigation() {
  const desktop = document.querySelector("#desktop-nav");
  const mobile = document.querySelector("#mobile-nav");
  const html = navItems.map(navButton).join("");
  desktop.innerHTML = html;
  mobile.innerHTML = html;

  document.querySelectorAll(".nav-item").forEach((button) => {
    button.addEventListener("click", () => {
      location.hash = button.dataset.page;
      navigate(button.dataset.page);
    });
  });
}

function navButton(item) {
  return `
    <button class="nav-item" type="button" data-page="${item.id}" aria-label="${item.label}">
      <span class="nav-icon" aria-hidden="true">${item.icon}</span>
      <span>${item.label}</span>
    </button>
  `;
}

function navigate(page) {
  currentPage = navItems.some((item) => item.id === page) ? page : "overview";
  document.querySelectorAll(".nav-item").forEach((button) => {
    const active = button.dataset.page === currentPage;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-current", active ? "page" : "false");
  });

  const renderers = {
    overview: renderOverview,
    transactions: renderTransactions,
    budgets: renderBudgets,
    pots: renderPots,
    bills: renderBills
  };
  renderers[currentPage]();
  document.querySelector("#app-main").focus({ preventScroll: true });
}

function pageHeader(title, action = "") {
  return `
    <div class="page-header">
      <h1 class="page-title">${title}</h1>
      ${action}
    </div>
  `;
}

function renderOverview() {
  const totalSaved = sum(state.pots, "total");
  const spentByBudget = state.budgets.reduce((total, budget) => total + budgetSpent(budget.category), 0);
  const budgetLimit = sum(state.budgets, "maximum");
  const latest = [...state.transactions].sort(byDateDesc).slice(0, 5);
  const bills = recurringBills();

  pageRoot.innerHTML = `
    ${pageHeader("Overview")}
    <div class="summary-grid">
      ${balanceCard("Current Balance", state.balance.current, "primary")}
      ${balanceCard("Income", state.balance.income)}
      ${balanceCard("Expenses", state.balance.expenses)}
    </div>
    <div class="overview-grid">
      <div class="overview-stack">
        <section class="card">
          <div class="card-header">
            <h2 class="card-title">Pots</h2>
            <button class="link-btn" type="button" data-go="pots">See Details ›</button>
          </div>
          <div class="pots-overview">
            <div class="saved-total">
              <span class="icon-bubble" aria-hidden="true">◍</span>
              <div><span class="muted">Total Saved</span><strong class="money-lg">${currency(totalSaved)}</strong></div>
            </div>
            <div class="mini-stat-grid">
              ${state.pots.slice(0, 4).map((pot) => miniStat(pot.name, pot.total, pot.theme)).join("")}
            </div>
          </div>
        </section>
        <section class="card">
          <div class="card-header">
            <h2 class="card-title">Transactions</h2>
            <button class="link-btn" type="button" data-go="transactions">View All ›</button>
          </div>
          <div class="transaction-list">${latest.map(transactionRow).join("")}</div>
        </section>
      </div>
      <div class="overview-stack">
        <section class="card">
          <div class="card-header">
            <h2 class="card-title">Budgets</h2>
            <button class="link-btn" type="button" data-go="budgets">See Details ›</button>
          </div>
          <div class="budgets-overview">
            ${budgetRing(spentByBudget, budgetLimit)}
            <div class="budget-legend">${state.budgets.map(budgetLegend).join("")}</div>
          </div>
        </section>
        <section class="card">
          <div class="card-header">
            <h2 class="card-title">Recurring Bills</h2>
            <button class="link-btn" type="button" data-go="bills">See Details ›</button>
          </div>
          <div class="bill-summary">${billSummaryRows(bills)}</div>
        </section>
      </div>
    </div>
  `;
  pageRoot.querySelectorAll("[data-go]").forEach((button) => button.addEventListener("click", () => (location.hash = button.dataset.go)));
}

function balanceCard(label, value, extra = "") {
  return `<section class="balance-card ${extra}"><span class="eyebrow">${label}</span><strong class="money-lg">${currency(value)}</strong></section>`;
}

function miniStat(label, value, theme) {
  return `<div class="mini-stat" style="--theme:${theme}"><span>${label}</span><strong>${currency(value)}</strong></div>`;
}

function budgetRing(spent, limit) {
  const percent = limit ? clamp((spent / limit) * 100, 0, 100) : 0;
  return `
    <div class="ring" style="background:${budgetGradient()}">
      <div class="ring-inner">
        <div><strong>${currency(spent, 0)}</strong><span class="muted">of ${currency(limit, 0)} limit</span></div>
      </div>
    </div>
  `;
}

function budgetGradient() {
  const total = state.budgets.reduce((acc, budget) => acc + Math.max(budgetSpent(budget.category), 0), 0) || 1;
  let cursor = 0;
  const stops = state.budgets.map((budget) => {
    const start = cursor;
    cursor += (Math.max(budgetSpent(budget.category), 0) / total) * 360;
    return `${budget.theme} ${start}deg ${cursor}deg`;
  });
  return `conic-gradient(${stops.join(", ")})`;
}

function budgetLegend(budget) {
  return `
    <div class="legend-item" style="--theme:${budget.theme}">
      <div><span class="muted">${budget.category}</span><strong>${currency(budgetSpent(budget.category))} of ${currency(budget.maximum)}</strong></div>
    </div>
  `;
}

function renderTransactions() {
  const categories = uniqueCategories();
  const filtered = filteredTransactions();
  const pages = Math.max(1, Math.ceil(filtered.length / 10));
  txPage = Math.min(txPage, pages);
  const visible = filtered.slice((txPage - 1) * 10, txPage * 10);

  pageRoot.innerHTML = `
    ${pageHeader("Transactions")}
    <section class="card table-card">
      <div class="controls">
        <div class="control-field">
          <label for="transaction-search">Search</label>
          <input class="input" id="transaction-search" type="search" value="${escapeAttr(transactionControls.search)}" placeholder="Search transactions" />
        </div>
        <div class="control-field">
          <label for="transaction-sort">Sort by</label>
          <select class="select" id="transaction-sort">${sortOptions(transactionControls.sort)}</select>
        </div>
        <div class="control-field">
          <label for="transaction-category">Category</label>
          <select class="select" id="transaction-category">
            <option value="all">All categories</option>
            ${categories.map((cat) => `<option value="${cat}" ${cat === transactionControls.category ? "selected" : ""}>${cat}</option>`).join("")}
          </select>
        </div>
      </div>
      <table class="data-table">
        <thead><tr><th>Recipient / Sender</th><th>Category</th><th>Transaction Date</th><th>Amount</th></tr></thead>
        <tbody>${visible.map(transactionTableRow).join("") || `<tr><td colspan="4"><div class="empty-state">No transactions found.</div></td></tr>`}</tbody>
      </table>
      <div class="pagination">
        <button class="btn secondary" id="prev-page" type="button" ${txPage === 1 ? "disabled" : ""}>‹ Prev</button>
        <div class="page-buttons" aria-label="Pagination">${paginationButtons(pages, txPage)}</div>
        <button class="btn secondary" id="next-page" type="button" ${txPage === pages ? "disabled" : ""}>Next ›</button>
      </div>
    </section>
  `;

  document.querySelector("#transaction-search").addEventListener("input", (event) => {
    transactionControls.search = event.target.value;
    txPage = 1;
    renderTransactions();
  });
  document.querySelector("#transaction-sort").addEventListener("change", (event) => {
    transactionControls.sort = event.target.value;
    renderTransactions();
  });
  document.querySelector("#transaction-category").addEventListener("change", (event) => {
    transactionControls.category = event.target.value;
    txPage = 1;
    renderTransactions();
  });
  document.querySelector("#prev-page").addEventListener("click", () => {
    txPage -= 1;
    renderTransactions();
  });
  document.querySelector("#next-page").addEventListener("click", () => {
    txPage += 1;
    renderTransactions();
  });
  document.querySelectorAll("[data-page-number]").forEach((button) => button.addEventListener("click", () => {
    txPage = Number(button.dataset.pageNumber);
    renderTransactions();
  }));
}

function sortOptions(selected) {
  return [
    ["latest", "Latest"],
    ["oldest", "Oldest"],
    ["highest", "Highest amount"],
    ["lowest", "Lowest amount"],
    ["az", "A-Z"]
  ].map(([value, label]) => `<option value="${value}" ${value === selected ? "selected" : ""}>${label}</option>`).join("");
}

function filteredTransactions() {
  return state.transactions
    .filter((tx) => tx.name.toLowerCase().includes(transactionControls.search.toLowerCase()))
    .filter((tx) => transactionControls.category === "all" || tx.category === transactionControls.category)
    .sort(sortTransactions(transactionControls.sort));
}

function sortTransactions(sort) {
  const sorters = {
    latest: byDateDesc,
    oldest: (a, b) => new Date(a.date) - new Date(b.date),
    highest: (a, b) => b.amount - a.amount,
    lowest: (a, b) => a.amount - b.amount,
    az: (a, b) => a.name.localeCompare(b.name)
  };
  return sorters[sort] || sorters.latest;
}

function transactionTableRow(tx) {
  return `
    <tr>
      <td>${identity(tx.name, tx.category)}</td>
      <td><span class="mobile-label">Category</span>${tx.category}</td>
      <td><span class="mobile-label">Date</span>${dateShort(tx.date)}</td>
      <td class="amount ${tx.amount > 0 ? "positive" : "negative"}"><span class="mobile-label">Amount</span>${signedCurrency(tx.amount)}</td>
    </tr>
  `;
}

function paginationButtons(total, active) {
  return Array.from({ length: total }, (_, index) => {
    const page = index + 1;
    return `<button class="icon-btn" type="button" data-page-number="${page}" aria-label="Page ${page}" ${page === active ? `aria-current="page"` : ""}>${page}</button>`;
  }).join("");
}

function renderBudgets() {
  pageRoot.innerHTML = `
    ${pageHeader("Budgets", `<button class="btn" type="button" id="add-budget">+ Add New Budget</button>`)}
    <div class="overview-grid">
      <section class="card">
        <div class="card-header"><h2 class="card-title">Spending Summary</h2></div>
        <div class="budgets-overview">
          ${budgetRing(state.budgets.reduce((acc, b) => acc + budgetSpent(b.category), 0), sum(state.budgets, "maximum"))}
          <div class="budget-legend">${state.budgets.map(budgetLegend).join("")}</div>
        </div>
      </section>
      <div class="resource-grid">${state.budgets.map(budgetCard).join("") || `<section class="card empty-state">No budgets yet.</section>`}</div>
    </div>
  `;
  document.querySelector("#add-budget").addEventListener("click", () => openBudgetModal());
  bindResourceActions("budget");
}

function budgetCard(budget) {
  const spent = budgetSpent(budget.category);
  const latest = state.transactions.filter((tx) => tx.category === budget.category).sort(byDateDesc).slice(0, 3);
  return `
    <section class="card budget-card" style="--theme:${budget.theme}">
      <div class="card-header">
        <div class="resource-title"><span class="dot"></span><h2 class="card-title">${budget.category}</h2></div>
        <div class="card-actions">
          <button class="icon-btn" type="button" data-edit-budget="${budget.id}" aria-label="Edit ${budget.category}">✎</button>
          <button class="icon-btn" type="button" data-delete-budget="${budget.id}" aria-label="Delete ${budget.category}">×</button>
        </div>
      </div>
      <div class="budget-detail-grid">
        <div>
          <p class="muted">Maximum of ${currency(budget.maximum)}</p>
          <div class="progress-track"><div class="progress-bar" style="--progress:${clamp((spent / budget.maximum) * 100, 0, 100)}%"></div></div>
          <div class="progress-meta"><strong>${currency(spent)} Spent</strong><span class="muted">${currency(Math.max(budget.maximum - spent, 0))} Remaining</span></div>
        </div>
        <div class="latest-list">
          <h4>Latest Spending</h4>
          ${latest.map(transactionRow).join("") || `<p class="muted">No transactions in this category.</p>`}
        </div>
      </div>
    </section>
  `;
}

function bindResourceActions(type) {
  if (type === "budget") {
    document.querySelectorAll("[data-edit-budget]").forEach((button) => button.addEventListener("click", () => {
      openBudgetModal(state.budgets.find((budget) => budget.id === button.dataset.editBudget));
    }));
    document.querySelectorAll("[data-delete-budget]").forEach((button) => button.addEventListener("click", () => {
      const budget = state.budgets.find((item) => item.id === button.dataset.deleteBudget);
      openConfirm(`Delete '${budget.category}'?`, "This budget will be removed from your dashboard.", () => {
        state.budgets = state.budgets.filter((item) => item.id !== budget.id);
        saveState();
        renderBudgets();
        showToast("Budget deleted.");
      });
    }));
  }

  if (type === "pot") {
    document.querySelectorAll("[data-edit-pot]").forEach((button) => button.addEventListener("click", () => {
      openPotModal(state.pots.find((pot) => pot.id === button.dataset.editPot));
    }));
    document.querySelectorAll("[data-delete-pot]").forEach((button) => button.addEventListener("click", () => {
      const pot = state.pots.find((item) => item.id === button.dataset.deletePot);
      openConfirm(`Delete '${pot.name}'?`, "This pot and its saved amount will be removed.", () => {
        state.pots = state.pots.filter((item) => item.id !== pot.id);
        saveState();
        renderPots();
        showToast("Pot deleted.");
      });
    }));
    document.querySelectorAll("[data-add-pot]").forEach((button) => button.addEventListener("click", () => openPotMoneyModal(button.dataset.addPot, "add")));
    document.querySelectorAll("[data-withdraw-pot]").forEach((button) => button.addEventListener("click", () => openPotMoneyModal(button.dataset.withdrawPot, "withdraw")));
  }
}

function openBudgetModal(budget = null) {
  const categories = uniqueCategories();
  const title = budget ? "Edit Budget" : "Add New Budget";
  openModal(`
    <form class="modal" id="budget-form" novalidate>
      ${modalHeader(title)}
      <div class="form-grid">
        ${field("Category", "category", `<select class="select" id="category" required>${categories.map((cat) => `<option value="${cat}" ${budget?.category === cat ? "selected" : ""}>${cat}</option>`).join("")}</select>`)}
        ${field("Maximum Spend", "maximum", `<input class="input" id="maximum" type="number" min="1" step="0.01" value="${budget?.maximum || ""}" required />`)}
        ${field("Theme", "theme", `<select class="select" id="theme" required>${themes.map((theme) => `<option value="${theme}" ${budget?.theme === theme ? "selected" : ""}>${theme}</option>`).join("")}</select>`)}
      </div>
      <div class="form-actions"><button class="btn secondary" type="button" data-close-modal>Cancel</button><button class="btn" type="submit">${budget ? "Save Changes" : "Add Budget"}</button></div>
    </form>
  `);

  document.querySelector("#budget-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = formValues(["category", "maximum", "theme"]);
    if (!validateAmount("maximum", data.maximum)) return;
    const duplicate = state.budgets.some((item) => item.category === data.category && item.id !== budget?.id);
    if (duplicate) return setError("category", "A budget already exists for this category.");
    const next = { id: budget?.id || crypto.randomUUID(), category: data.category, maximum: Number(data.maximum), theme: data.theme };
    state.budgets = budget ? state.budgets.map((item) => (item.id === budget.id ? next : item)) : [...state.budgets, next];
    saveState();
    closeModal();
    renderBudgets();
    showToast(budget ? "Budget updated." : "Budget created.");
  });
}

function renderPots() {
  pageRoot.innerHTML = `
    ${pageHeader("Pots", `<button class="btn" type="button" id="add-pot">+ Add New Pot</button>`)}
    <div class="resource-grid">${state.pots.map(potCard).join("") || `<section class="card empty-state">No pots yet.</section>`}</div>
  `;
  document.querySelector("#add-pot").addEventListener("click", () => openPotModal());
  bindResourceActions("pot");
}

function potCard(pot) {
  const progress = pot.target ? clamp((pot.total / pot.target) * 100, 0, 100) : 0;
  return `
    <section class="card pot-card" style="--theme:${pot.theme}">
      <div class="card-header">
        <div class="resource-title"><span class="dot"></span><h2 class="card-title">${pot.name}</h2></div>
        <div class="card-actions">
          <button class="icon-btn" type="button" data-edit-pot="${pot.id}" aria-label="Edit ${pot.name}">✎</button>
          <button class="icon-btn" type="button" data-delete-pot="${pot.id}" aria-label="Delete ${pot.name}">×</button>
        </div>
      </div>
      <div class="progress-meta"><span class="muted">Total Saved</span><strong class="money-lg">${currency(pot.total)}</strong></div>
      <div class="progress-track"><div class="progress-bar" style="--progress:${progress}%"></div></div>
      <div class="progress-meta"><strong>${progress.toFixed(1)}%</strong><span class="muted">Target of ${currency(pot.target)}</span></div>
      <div class="pot-actions">
        <button class="btn secondary" type="button" data-add-pot="${pot.id}">+ Add Money</button>
        <button class="btn secondary" type="button" data-withdraw-pot="${pot.id}">Withdraw</button>
      </div>
    </section>
  `;
}

function openPotModal(pot = null) {
  openModal(`
    <form class="modal" id="pot-form" novalidate>
      ${modalHeader(pot ? "Edit Pot" : "Add New Pot")}
      <div class="form-grid">
        ${field("Pot Name", "name", `<input class="input" id="name" maxlength="30" value="${escapeAttr(pot?.name || "")}" required />`)}
        ${field("Target", "target", `<input class="input" id="target" type="number" min="1" step="0.01" value="${pot?.target || ""}" required />`)}
        ${field("Theme", "theme", `<select class="select" id="theme" required>${themes.map((theme) => `<option value="${theme}" ${pot?.theme === theme ? "selected" : ""}>${theme}</option>`).join("")}</select>`)}
      </div>
      <div class="form-actions"><button class="btn secondary" type="button" data-close-modal>Cancel</button><button class="btn" type="submit">${pot ? "Save Changes" : "Add Pot"}</button></div>
    </form>
  `);

  document.querySelector("#pot-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = formValues(["name", "target", "theme"]);
    if (!data.name.trim()) return setError("name", "Enter a pot name.");
    if (!validateAmount("target", data.target)) return;
    const duplicate = state.pots.some((item) => item.name.toLowerCase() === data.name.toLowerCase() && item.id !== pot?.id);
    if (duplicate) return setError("name", "A pot with this name already exists.");
    const next = { id: pot?.id || crypto.randomUUID(), name: data.name.trim(), target: Number(data.target), total: pot?.total || 0, theme: data.theme, history: pot?.history || [] };
    state.pots = pot ? state.pots.map((item) => (item.id === pot.id ? next : item)) : [...state.pots, next];
    saveState();
    closeModal();
    renderPots();
    showToast(pot ? "Pot updated." : "Pot created.");
  });
}

function openPotMoneyModal(id, mode) {
  const pot = state.pots.find((item) => item.id === id);
  const isAdd = mode === "add";
  openModal(`
    <form class="modal" id="pot-money-form" novalidate>
      ${modalHeader(`${isAdd ? "Add to" : "Withdraw from"} '${pot.name}'`)}
      <p class="muted">Current total: ${currency(pot.total)}. Target: ${currency(pot.target)}.</p>
      <div class="form-grid">
        ${field("Amount", "amount", `<input class="input" id="amount" type="number" min="0.01" step="0.01" required />`)}
      </div>
      <div class="form-actions"><button class="btn secondary" type="button" data-close-modal>Cancel</button><button class="btn" type="submit">${isAdd ? "Add Money" : "Withdraw"}</button></div>
    </form>
  `);
  document.querySelector("#pot-money-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const amount = Number(document.querySelector("#amount").value);
    if (!validateAmount("amount", amount)) return;
    if (!isAdd && amount > pot.total) return setError("amount", "You cannot withdraw more than the pot total.");
    pot.total = Number((pot.total + (isAdd ? amount : -amount)).toFixed(2));
    pot.history.push({ type: mode, amount, date: new Date().toISOString() });
    saveState();
    closeModal();
    renderPots();
    showToast(isAdd ? "Money added." : "Money withdrawn.");
  });
}

function renderBills() {
  const bills = recurringBills()
    .filter((bill) => bill.name.toLowerCase().includes(billControls.search.toLowerCase()))
    .sort(sortBills(billControls.sort));

  pageRoot.innerHTML = `
    ${pageHeader("Recurring Bills")}
    <div class="overview-grid">
      <section class="card">
        <div class="card-header"><h2 class="card-title">Total Bills</h2></div>
        <strong class="money-lg">${currency(sum(bills, "absolute"))}</strong>
        <div class="bill-summary" style="margin-top:22px">${billSummaryRows(recurringBills())}</div>
      </section>
      <section class="card table-card">
        <div class="controls" style="grid-template-columns:minmax(220px,1fr) 180px">
          <div class="control-field">
            <label for="bill-search">Search bills</label>
            <input class="input" id="bill-search" type="search" value="${escapeAttr(billControls.search)}" placeholder="Search bills" />
          </div>
          <div class="control-field">
            <label for="bill-sort">Sort by</label>
            <select class="select" id="bill-sort">${sortOptions(billControls.sort)}</select>
          </div>
        </div>
        <div class="bill-list">${bills.map(billRow).join("") || `<div class="empty-state">No recurring bills found.</div>`}</div>
      </section>
    </div>
  `;
  document.querySelector("#bill-search").addEventListener("input", (event) => {
    billControls.search = event.target.value;
    renderBills();
  });
  document.querySelector("#bill-sort").addEventListener("change", (event) => {
    billControls.sort = event.target.value;
    renderBills();
  });
}

function recurringBills() {
  return state.transactions
    .filter((tx) => tx.recurring)
    .map((tx) => {
      const day = new Date(tx.date).getUTCDate();
      const today = new Date();
      const status = day < today.getDate() ? "paid" : day - today.getDate() <= 5 ? "due" : "upcoming";
      return { ...tx, day, status, absolute: Math.abs(tx.amount) };
    });
}

function billRow(bill) {
  const labels = { paid: "Paid", due: "Due Soon", upcoming: "Upcoming" };
  return `
    <div class="bill-row">
      ${identity(bill.name, bill.category)}
      <div>
        <div class="amount">${currency(Math.abs(bill.amount))}</div>
        <div class="bill-date">Monthly - ${ordinal(bill.day)}</div>
        <span class="status-pill ${bill.status}">${labels[bill.status]}</span>
      </div>
    </div>
  `;
}

function billSummaryRows(bills) {
  const paid = bills.filter((bill) => bill.status === "paid");
  const upcoming = bills.filter((bill) => bill.status === "upcoming");
  const due = bills.filter((bill) => bill.status === "due");
  return [
    ["Paid Bills", paid.length, sum(paid, "absolute"), "paid"],
    ["Total Upcoming", upcoming.length, sum(upcoming, "absolute"), "upcoming"],
    ["Due Soon", due.length, sum(due, "absolute"), "due"]
  ].map(([label, count, total, status]) => `
    <div class="bill-summary-row">
      <span class="status-pill ${status}">${label}</span>
      <strong>${count} (${currency(total)})</strong>
    </div>
  `).join("");
}

function sortBills(sort) {
  const sorters = {
    latest: (a, b) => a.day - b.day,
    oldest: (a, b) => b.day - a.day,
    highest: (a, b) => Math.abs(b.amount) - Math.abs(a.amount),
    lowest: (a, b) => Math.abs(a.amount) - Math.abs(b.amount),
    az: (a, b) => a.name.localeCompare(b.name)
  };
  return sorters[sort] || sorters.latest;
}

function openConfirm(title, message, onConfirm) {
  openModal(`
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      ${modalHeader(title, "confirm-title")}
      <p class="muted">${message}</p>
      <div class="form-actions">
        <button class="btn secondary" type="button" data-close-modal>Cancel</button>
        <button class="btn danger" type="button" id="confirm-delete">Yes, Delete</button>
      </div>
    </div>
  `);
  document.querySelector("#confirm-delete").addEventListener("click", () => {
    onConfirm();
    closeModal();
  });
}

function openModal(html) {
  modalLayer.innerHTML = html;
  modalLayer.classList.add("is-open");
  modalLayer.setAttribute("aria-hidden", "false");
  modalLayer.querySelectorAll("[data-close-modal]").forEach((button) => button.addEventListener("click", closeModal));
  const firstInput = modalLayer.querySelector("input, select, button");
  firstInput?.focus();
}

function closeModal() {
  modalLayer.classList.remove("is-open");
  modalLayer.setAttribute("aria-hidden", "true");
  modalLayer.innerHTML = "";
}

function modalHeader(title, id = "modal-title") {
  return `
    <div class="modal-header">
      <h2 id="${id}">${title}</h2>
      <button class="icon-btn" type="button" data-close-modal aria-label="Close modal">×</button>
    </div>
  `;
}

function field(label, id, control) {
  return `<div class="field"><label for="${id}">${label}</label>${control}<div class="error-text" id="${id}-error"></div></div>`;
}

function formValues(ids) {
  return ids.reduce((values, id) => ({ ...values, [id]: document.querySelector(`#${id}`).value }), {});
}

function validateAmount(id, value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    setError(id, "Enter an amount greater than 0.");
    return false;
  }
  setError(id, "");
  return true;
}

function setError(id, message) {
  const node = document.querySelector(`#${id}-error`);
  if (node) node.textContent = message;
  document.querySelector(`#${id}`)?.focus();
}

function transactionRow(tx) {
  return `
    <div class="transaction-row">
      ${identity(tx.name, tx.category)}
      <div><div class="amount ${tx.amount > 0 ? "positive" : "negative"}">${signedCurrency(tx.amount)}</div><div class="transaction-meta">${dateShort(tx.date)}</div></div>
    </div>
  `;
}

function identity(name, meta) {
  return `
    <div class="identity">
      <span class="avatar" style="background:${stringColor(name)}">${initials(name)}</span>
      <div class="identity-text"><strong>${escapeHtml(name)}</strong><span class="transaction-meta">${escapeHtml(meta)}</span></div>
    </div>
  `;
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  toastRegion.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}

function budgetSpent(category) {
  return state.transactions.filter((tx) => tx.category === category && tx.amount < 0).reduce((total, tx) => total + Math.abs(tx.amount), 0);
}

function uniqueCategories() {
  return [...new Set(state.transactions.map((tx) => tx.category))].sort((a, b) => a.localeCompare(b));
}

function byDateDesc(a, b) {
  return new Date(b.date) - new Date(a.date);
}

function sum(items, key) {
  return items.reduce((total, item) => total + Number(item[key] || 0), 0);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value || 0, min), max);
}

function currency(value, digits = 2) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: digits }).format(value || 0);
}

function signedCurrency(value) {
  return `${value > 0 ? "+" : "-"}${currency(Math.abs(value))}`;
}

function dateShort(value) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function ordinal(day) {
  const suffix = day % 10 === 1 && day !== 11 ? "st" : day % 10 === 2 && day !== 12 ? "nd" : day % 10 === 3 && day !== 13 ? "rd" : "th";
  return `${day}${suffix}`;
}

function initials(name) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function stringColor(input) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) hash = input.charCodeAt(i) + ((hash << 5) - hash);
  return themes[Math.abs(hash) % themes.length];
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}
