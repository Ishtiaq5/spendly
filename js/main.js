/* Spendly — expense tracker logic (vanilla JS, localStorage) */
(function () {
  "use strict";

  var STORE_KEY = "spendly.expenses.v1";
  var BUDGET_KEY = "spendly.budget.v1";
  var RING_CIRCUMFERENCE = 2 * Math.PI * 82;

  var COLORS = {
    Food: "#f472b6",
    Transport: "#22d3ee",
    Bills: "#fbbf24",
    Shopping: "#7c5cff",
    Fun: "#34d399",
    Other: "#94a3b8"
  };

  var els = {
    form: document.getElementById("expenseForm"),
    amount: document.getElementById("amount"),
    category: document.getElementById("category"),
    note: document.getElementById("note"),
    budget: document.getElementById("budgetInput"),
    hint: document.getElementById("budgetHint"),
    ringProgress: document.getElementById("ringProgress"),
    ringPercent: document.getElementById("ringPercent"),
    statSpent: document.getElementById("statSpent"),
    statLeft: document.getElementById("statLeft"),
    statAvg: document.getElementById("statAvg"),
    statCount: document.getElementById("statCount"),
    breakdown: document.getElementById("breakdown"),
    emptyState: document.getElementById("emptyState"),
    list: document.getElementById("expenseList"),
    reset: document.getElementById("resetMonth")
  };

  var state = {
    expenses: load(STORE_KEY, []),
    budget: load(BUDGET_KEY, 120000)
  };

  function load(key, fallback) {
    try {
      var raw = window.localStorage.getItem(key);
      if (!raw) return fallback;
      var parsed = JSON.parse(raw);
      return parsed === null || parsed === undefined ? fallback : parsed;
    } catch (err) {
      return fallback;
    }
  }

  function save() {
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(state.expenses));
      window.localStorage.setItem(BUDGET_KEY, JSON.stringify(state.budget));
    } catch (err) {
      /* storage unavailable — keep working in memory */
    }
  }

  function money(value) {
    var rounded = Math.round(Number(value) || 0);
    return "Rs " + rounded.toLocaleString("en-US");
  }

  function total() {
    return state.expenses.reduce(function (sum, item) {
      return sum + (Number(item.amount) || 0);
    }, 0);
  }

  function dayOfMonth() {
    return new Date().getDate();
  }

  function monthLabel(ts) {
    var d = new Date(ts);
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  }

  function budgetState(spent) {
    if (!state.budget || state.budget <= 0) return { pct: 0, cls: "" };
    var pct = (spent / state.budget) * 100;
    var cls = "good";
    if (pct >= 100) cls = "over";
    else if (pct >= 75) cls = "warn";
    return { pct: pct, cls: cls };
  }

  function renderRing(spent) {
    var info = budgetState(spent);
    var clamped = Math.max(0, Math.min(info.pct, 100));
    var offset = RING_CIRCUMFERENCE - (clamped / 100) * RING_CIRCUMFERENCE;
    if (els.ringProgress) {
      els.ringProgress.style.strokeDasharray = RING_CIRCUMFERENCE;
      els.ringProgress.style.strokeDashoffset = offset;
      els.ringProgress.style.stroke = info.pct >= 100 ? "#f472b6" : "url(#ringGrad)";
    }
    if (els.ringPercent) {
      els.ringPercent.textContent = Math.round(info.pct) + "%";
    }
  }

  function renderHint(spent) {
    if (!els.hint) return;
    var left = state.budget - spent;
    var h = els.hint;
    h.className = "hint";
    if (!state.budget || state.budget <= 0) {
      h.textContent = "Set a monthly budget to start tracking.";
      return;
    }
    if (left < 0) {
      h.className = "hint over";
      h.textContent = "Over budget by " + money(Math.abs(left)) + ". Time to slow down.";
    } else if (left / state.budget <= 0.25) {
      h.className = "hint warn";
      h.textContent = money(left) + " left — under 25% of your budget.";
    } else {
      h.className = "hint good";
      h.textContent = money(left) + " left this month. Nice pace.";
    }
  }

  function renderStats(spent) {
    var left = state.budget - spent;
    var avg = spent / Math.max(dayOfMonth(), 1);
    els.statSpent.textContent = money(spent);
    els.statLeft.textContent = money(left);
    els.statAvg.textContent = money(avg);
    els.statCount.textContent = String(state.expenses.length);
    els.statLeft.style.color = left < 0 ? "#f472b6" : "";
  }

  function renderBreakdown() {
    if (!els.breakdown) return;
    var totals = {};
    var spent = total();
    state.expenses.forEach(function (item) {
      var key = COLORS[item.category] ? item.category : "Other";
      totals[key] = (totals[key] || 0) + (Number(item.amount) || 0);
    });
    var rows = Object.keys(totals)
      .map(function (key) { return { name: key, value: totals[key] }; })
      .sort(function (a, b) { return b.value - a.value; });

    els.breakdown.innerHTML = "";
    if (els.emptyState) els.emptyState.hidden = rows.length > 0 || state.expenses.length > 0;

    rows.forEach(function (row, index) {
      var pct = spent > 0 ? (row.value / spent) * 100 : 0;
      var li = document.createElement("li");
      li.className = "breakdown-item";
      li.innerHTML =
        '<div class="breakdown-head">' +
          '<span class="breakdown-name"><span class="swatch" style="color:' + COLORS[row.name] + '"></span>' +
            row.name + " · " + Math.round(pct) + "%</span>" +
          '<span class="breakdown-amount">' + money(row.value) + "</span>" +
        "</div>" +
        '<div class="track"><div class="bar" style="color:' + COLORS[row.name] + '"></div></div>';
      els.breakdown.appendChild(li);
      var bar = li.querySelector(".bar");
      window.setTimeout(function () { bar.style.width = Math.max(pct, 3) + "%"; }, 60 + index * 70);
    });
  }

  function renderList() {
    if (!els.list) return;
    els.list.innerHTML = "";
    var items = state.expenses.slice().sort(function (a, b) { return b.ts - a.ts; }).slice(0, 40);
    items.forEach(function (item) {
      var color = COLORS[item.category] || COLORS.Other;
      var li = document.createElement("li");
      li.className = "expense-row";
      li.innerHTML =
        '<span class="expense-dot" style="color:' + color + '"></span>' +
        '<span class="expense-main">' +
          '<p class="expense-note"></p>' +
          '<p class="expense-meta">' + item.category + " · " + monthLabel(item.ts) + "</p>" +
        "</span>" +
        '<span class="expense-amount">' + money(item.amount) + "</span>" +
        '<button class="remove" type="button" aria-label="Delete expense">✕</button>';
      li.querySelector(".expense-note").textContent = item.note || item.category + " expense";
      li.querySelector(".remove").addEventListener("click", function () {
        state.expenses = state.expenses.filter(function (x) { return x.id !== item.id; });
        save();
        render();
      });
      els.list.appendChild(li);
    });
  }

  function render() {
    var spent = total();
    renderRing(spent);
    renderHint(spent);
    renderStats(spent);
    renderBreakdown();
    renderList();
  }

  if (els.form) {
    els.form.addEventListener("submit", function (event) {
      event.preventDefault();
      var amount = Number(els.amount.value);
      if (!amount || amount <= 0) {
        els.amount.focus();
        return;
      }
      state.expenses.push({
        id: String(Date.now()) + Math.random().toString(16).slice(2, 7),
        amount: amount,
        category: els.category.value,
        note: (els.note.value || "").trim(),
        ts: Date.now()
      });
      save();
      els.form.reset();
      els.amount.focus();
      render();
    });
  }

  if (els.budget) {
    els.budget.value = state.budget;
    els.budget.addEventListener("input", function () {
      var value = Number(els.budget.value);
      state.budget = value > 0 ? value : 0;
      save();
      render();
    });
  }

  if (els.reset) {
    els.reset.addEventListener("click", function () {
      if (!state.expenses.length) return;
      state.expenses = [];
      save();
      render();
      if (els.hint) {
        els.hint.className = "hint";
        els.hint.textContent = "Month cleared. Fresh start.";
      }
    });
  }

  render();
})();
