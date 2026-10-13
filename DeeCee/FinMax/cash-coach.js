(function (root) {
  "use strict";

  const money = value => "NGN " + Math.round(Number(value) || 0).toLocaleString("en-NG");
  const total = rows => rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  const monthOf = value => String(value || "").slice(0, 7);

  function freshness(imports, today) {
    const usable = (Array.isArray(imports) ? imports : [])
      .filter(item => item && item.status === "imported" && /^\d{4}-\d{2}-\d{2}$/.test(item.end || ""))
      .sort((a, b) => b.end.localeCompare(a.end));
    if (!usable.length) {
      return " No statement history has been imported in this ledger; totals only reflect activity entered here.";
    }

    const latest = usable[0].end;
    const ageDays = Math.max(0, Math.floor((Date.parse(today + "T00:00:00Z") - Date.parse(latest + "T00:00:00Z")) / 86400000));
    if (ageDays > 45) {
      return " Latest imported statement ends " + latest + " (" + ageDays + " days ago); records may be behind.";
    }
    return " Latest imported statement ends " + latest + "; imported dates do not prove continuous coverage.";
  }

  function answer(question, context) {
    const q = String(question || "").trim().toLowerCase();
    const data = context || {};
    const rows = Array.isArray(data.transactions) ? data.transactions : [];
    const pending = rows.filter(row =>
      row.status === "review" || row.cat === "Needs sorting" || row.purpose === "Needs sorting"
    );
    const confirmed = rows.filter(row =>
      row.status === "confirmed" && row.cat !== "Needs sorting" && row.purpose !== "Needs sorting"
    );
    const month = monthOf(data.today || new Date().toISOString());
    const current = confirmed.filter(row => monthOf(row.date) === month);
    const outflow = list => total(list.filter(row => row.type === "expense"));
    const inflow = list => total(list.filter(row => row.type === "income"));
    const selectedWorkspace = data.mixed ? "shared ledger" : data.mode === "business" ? "Business" : "Personal";
    const coverage = freshness(data.imports, String(data.today || new Date().toISOString()).slice(0, 10));
    const pendingNote = pending.length ? " " + pending.length + " item(s) still need sorting and are excluded." : "";
    const assumedCount = data.mixed ? confirmed.filter(row => row.purposeSource === "workspace-default").length : 0;
    const assumedNote = assumedCount
      ? " " + assumedCount + " transaction(s) still use the default purpose; review any exceptions in Activity."
      : "";
    const balanceNote = data.mixed ? " Balances combine all entered accounts and are not split by transaction purpose." : "";
    const caveat = " Based on confirmed activity in the " + selectedWorkspace + "." + balanceNote +
      pendingNote + assumedNote + coverage;

    if (!q) {
      return "Ask about balances, goals, spending, personal or business use, or items that need sorting.";
    }

    if (/need sorting|sort(ing)?|review|unclear|unclassified/.test(q)) {
      if (!pending.length) {
        return assumedCount
          ? assumedCount + " transaction(s) still use the default purpose. Review any personal or business exceptions in Activity." + coverage
          : "Your sorting queue is clear. New imports with uncertain details will wait for review." + coverage;
      }
      const examples = pending.slice(0, 3)
        .map(row => row.desc || row.description || "Untitled transaction")
        .join(", ");
      return pending.length + " item(s) need sorting. Examples: " + examples +
        ". Review them in Activity before using them in totals." +
        (assumedCount ? " " + assumedCount + " more transaction(s) still use the default purpose." : "") + coverage;
    }

    if (/\bpersonal(?:ly)?\b.*\bbusiness\b|\bbusiness\b.*\bpersonal(?:ly)?\b|\bmixed\b/.test(q)) {
      const parts = ["Business", "Personal", "Owner draw"].map(label =>
        label + " " + money(outflow(current.filter(row => row.purpose === label)))
      );
      return "This month's confirmed outflow: " + parts.join("; ") + "." + caveat;
    }

    if (/\bowner.?s? draw\b|\bdrawings\b/.test(q) && /spend|expense|outflow|cost|paid|transaction/.test(q)) {
      return "This month's confirmed owner draw outflow: " +
        money(outflow(current.filter(row => row.purpose === "Owner draw"))) + "." + caveat;
    }

    if (/\b(personal(?:ly)?|business)\b/.test(q) && /spend|expense|outflow|cost|paid|transaction/.test(q)) {
      const purpose = /\bpersonal(?:ly)?\b/.test(q) ? "Personal" : "Business";
      return "This month's confirmed " + purpose.toLowerCase() + " outflow: " +
        money(outflow(current.filter(row => row.purpose === purpose))) + "." + caveat;
    }

    if (/goal|saving|target|milestone/.test(q)) {
      const goal = (data.goals || [])[0];
      if (!goal) {
        return "There is no saved goal in this workspace yet. Add one in Goals and I can track its progress." + coverage;
      }
      const target = Number(goal.target) || 0;
      const saved = Number(goal.saved) || 0;
      const percent = Math.round(target ? saved / target * 100 : 0);
      return goal.name + " is at " + money(saved) + " of " + money(target) + " (" + percent + "%)." + caveat;
    }

    const amount = q.match(/(?:ngn|₦|n)\s*([\d,]+)|([\d,]+)/i);
    if (/safe|afford|spend|available/.test(q) && amount) {
      const requested = Number((amount[1] || amount[2]).replace(/,/g, "")) || 0;
      const available = Number(data.safeToSpend) || 0;
      const result = requested <= available ? " is within " : " is above ";
      return money(requested) + result + "the current " + money(available) +
        " available after known bills. Expected income is not included." + caveat;
    }

    if (/safe to spend|available after|available now/.test(q)) {
      return "Current balances less known bills due in the next 30 days: " +
        money(data.safeToSpend) + ". Expected income is excluded." + caveat;
    }

    const categories = [
      ["Food", /food|grocer|supermarket|shoprite|market/],
      ["Transport", /transport|fuel|petrol|bolt|uber|taxi/],
      ["Airtime & data", /airtime|data bundle/],
      ["Bills", /bill|rent|electric|power|water|internet/],
      ["Shopping", /shopping|clothes|fashion/],
      ["Health", /health|medical|hospital|pharmacy/],
      ["Education", /education|school|tuition/],
      ["Fees", /bank fee|fees|charges|commission/],
      ["Savings", /saving|investment/]
    ];
    const category = categories.find(item => item[1].test(q));
    if (category) {
      return "Confirmed " + category[0].toLowerCase() + " outflow this month: " +
        money(outflow(current.filter(row => row.cat === category[0]))) + "." + caveat;
    }

    if (/runway|how long.*last|burn rate/.test(q)) {
      const days = Number(data.runwayDays);
      return Number.isFinite(days)
        ? "At the recent confirmed outflow pace, entered liquid balances cover about " +
          Math.max(0, Math.round(days)) + " days. This is a projection, not a guarantee." + caveat
        : "There is not enough confirmed spending history to estimate runway yet. Import or log activity, then review unclear rows." + coverage;
    }

    if (/income|earned|received|revenue|came in/.test(q)) {
      return "Confirmed income this month: " + money(inflow(current)) + "." + caveat;
    }

    if (/spend|outflow|cashflow|this month|month summary/.test(q)) {
      return "This month: " + money(inflow(current)) + " in and " + money(outflow(current)) +
        " out. Entered balances total " + money(data.balance) + "." + caveat;
    }

    if (/balance|account|how much.*have/.test(q)) {
      return "Entered balances total " + money(data.balance) + " across " +
        (data.accountCount || 0) + " account(s)." + caveat;
    }

    return "I can answer from confirmed activity in this workspace. Try income or spending, a category, runway, a goal, personal versus business use, or what needs sorting." + coverage;
  }

  const api = Object.freeze({ answer });
  root.CashCoach = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);