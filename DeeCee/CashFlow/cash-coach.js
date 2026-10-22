(function (root) {
  "use strict";

  const money = value => "NGN " + Math.round(Number(value) || 0).toLocaleString("en-NG");
  const goalMoney = (goal, value) => { const currency = goal && goal.currency === "USD" ? "USD" : "NGN"; return currency + " " + Math.round(Number(value) || 0).toLocaleString(currency === "USD" ? "en-US" : "en-NG"); };
  const total = rows => rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  const monthOf = value => String(value || "").slice(0, 7);

  function shiftDate(day, amount) {
    const date = new Date(day + "T00:00:00Z");
    date.setUTCDate(date.getUTCDate() + amount);
    return date.toISOString().slice(0, 10);
  }
  function datePeriod(question, today) {
    const now = new Date(today + "T00:00:00Z");
    const year = now.getUTCFullYear(), month = now.getUTCMonth();
    const monthStart = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
    const add = (day, amount) => { const d = new Date(day + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + amount); return d.toISOString().slice(0, 10); };
    const monday = add(today, 1 - (now.getUTCDay() || 7));
    if (/\b(last|previous) month\b/.test(question)) return { start: new Date(Date.UTC(year, month - 1, 1)).toISOString().slice(0, 10), end: add(monthStart, -1), label: "last month" };
    if (/\b(last|previous) week\b/.test(question)) return { start: add(monday, -7), end: add(monday, -1), label: "last week" };
    if (/\b(past|last) 7 days\b|\bpast week\b/.test(question)) return { start: add(today, -6), end: today, label: "the past 7 days" };
    if (/\byesterday\b/.test(question)) { const day = add(today, -1); return { start: day, end: day, label: "yesterday" }; }
    if (/\btoday\b/.test(question)) return { start: today, end: today, label: "today" };
    if (/\bthis week\b|\bweek to date\b/.test(question)) return { start: monday, end: today, label: "this week" };
    if (/\byear to date\b|\bthis year\b/.test(question)) return { start: year + "-01-01", end: today, label: "this year to date" };
    return { start: monthStart, end: today, label: "this month" };
  }
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
    const goals = Array.isArray(data.goals) ? data.goals : [];
    const accounts = Array.isArray(data.accounts) ? data.accounts : [];
    const plans = Array.isArray(data.plans) ? data.plans : [];
    const invoices = Array.isArray(data.invoices) ? data.invoices : [];
    const pending = rows.filter(row =>
      row.status === "review" || row.cat === "Needs sorting" || row.purpose === "Needs sorting"
    );
    const confirmed = rows.filter(row =>
      row.status === "confirmed" && row.cat !== "Needs sorting" && row.purpose !== "Needs sorting"
    );
    const today = String(data.today || new Date().toISOString()).slice(0, 10);
    const period = datePeriod(q, today);
    const current = confirmed.filter(row => /^\d{4}-\d{2}-\d{2}$/.test(row.date || "") && row.date >= period.start && row.date <= period.end);
    const outflow = list => total(list.filter(row => row.type === "expense"));
    const inflow = list => total(list.filter(row => row.type === "income"));
    const selectedWorkspace = data.mixed ? "shared ledger" : data.mode === "business" ? "Business" : "Personal";
    const coverage = freshness(data.imports, today);
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

    if (/^(hi|hello|hey|hiya|howdy|good morning|good afternoon|good evening)( there)?[.!? ]*$/.test(q)) {
      return "Hi! I can help you make sense of this ledger. Try asking how many goals you have, what you spent, how much is safe to spend, or what needs sorting.";
    }
    if (/^(thanks|thank you|thx|cheers)[.!? ]*$/.test(q)) return "You're welcome. Ask another question whenever you're ready.";
    if (/^(help|what can you do|what do you do|who are you|what is cash coach|how does this work|how do i use this)[?.! ]*$/.test(q)) {
      return "I'm Cash Coach. I answer questions using balances, goals, plans, invoices, imports and confirmed activity in this ledger. Try: How many goals do I have? What did I spend last month? What bills are coming up? What needs sorting? I do not connect to your bank or answer every kind of financial question.";
    }
    if (/\b(where.*data|data.*stored|privacy|cloud sync|encrypted|is my data safe)\b/.test(q)) return "Cashflow encrypts the saved ledger in this browser and asks for your password to unlock it. Your recovery key is the only offline way to unlock if you forget the password; if both are lost, the ledger cannot be recovered. There is no login, bank connection or cloud sync. CSV exports are not encrypted. This is a prototype, so use synthetic or anonymized data.";
    if (/\b(tax|taxes|vat)\b/.test(q) && /\b(calculate|how much|owe|liability|deduct|filing|estimate|set aside)\b/.test(q) && !/\b(goal|reserve)\b/.test(q)) return "Tax calculations are not implemented in this pilot, so I can't estimate tax owed or a tax reserve. Check figures with a qualified tax professional.";
    if (/\b(import.*statement|statement.*import|how.*import|import.*csv|import.*pdf|import.*xlsx|import.*excel)\b/.test(q)) return "Choose Import statement, select the account and an XLSX, CSV, or digital PDF. XLSX is the preferred spreadsheet format; CSV remains supported. Check rows in Activity. Backfills are welcome; exact duplicates are skipped and unclear rows wait for review. Scanned PDFs remain Pending OCR.";
    if (/\b(import.*(change|update).*(balance|account)|why.*import.*balance|balance.*different)\b/.test(q)) return "Imported transactions do not change account balances. Balances are entered and updated manually, and this pilot has no bank connection. Update the balance from your bank or wallet when you check it.";
    if (/\b(duplicate|duplicates)\b/.test(q)) return "Exact duplicate statement rows are skipped during import. Similar-looking rows with different dates, amounts or descriptions may still need review in Activity.";
    if (/\b(learn|remember|teach|trained|training).*(sort|merchant|correction|feedback)|\b(sort|correct).*(learn|remember|future)\b/.test(q)) return "When you correct a transaction and choose Save & learn, matching merchant rows can reuse that category, type and purpose. This teaches sorting rules, not new Coach skills.";
    if (/\b(what does|meaning of|explain).*(safe to spend|available after bills)\b/.test(q)) return "Safe to spend is the balances you entered minus known bills due in the next 30 days. Expected income is left out until it arrives.";
    if (/\b(slider|simulator|preview contribution)\b/.test(q) && /\b(goal|saved|money|contribution|save)\b/.test(q)) return "The goal slider is a preview. It redraws the main goal's projected path and checkpoint timing, but it does not move money or change the saved amount. Use Add or Subtract in Goals when actual progress changes.";
    if (/\btransfer(s)?\b/.test(q) && /\b(count|include|spend|meaning|mean|what|categor|outflow)\b/.test(q)) return "Transfers are kept separate from income and spending totals to avoid counting the same movement as new income or an expense. Rows marked Needs sorting are also excluded until reviewed.";
    if (/\b(add|create|set up)\b.*\bgoal\b/.test(q)) return "Open Goals and choose Add goal. Enter a name, select NGN or USD, then set the target and current saved amount. Add an optional deadline and 3-6 checkpoints. You can track up to 3 goals.";
    if (/\b(update|change|record)\b.*\b(saved|goal progress|progress)\b/.test(q) || /\bwhy.*goal.*(not|isn't).*(update|change)\b/.test(q)) return "Open Goals and choose Add or Subtract to adjust the saved amount. Choose Edit goal to change its name, target, deadline or checkpoints.";
    if (/\b(what does|meaning of|mean by)\b.*\bcheckpoint\b/.test(q)) return "A checkpoint is a progress marker. Choose 3-6 evenly spaced stages for a goal; the last is always 100%. The main goal's checkpoint count is editable on Goals.";
    if (/\bmore than 3 goals|maximum number of goals|goal limit\b/.test(q)) return "You can track up to 3 goals at a time, with one marked as the main goal. Remove a goal before adding another when you reach the limit.";
    if (/\bhow do i add an account\b|\badd an account\b|\bcreate an account\b/.test(q)) return "Choose + Account on Overview or Settings, enter the bank or wallet name and current balance, then save. You can name accounts Opay, Moniepoint, PalmPay, cash or another provider.";
    if (/\b(update|change|correct)\b.*\bbalance\b/.test(q) && !/\bimport\b/.test(q)) return "Choose Update balances on Overview or Edit beside an account in Settings. Enter the current balance and the date you checked it.";
    if (/\b(pending ocr|scanned pdf|ocr)\b/.test(q)) return "Pending OCR means the statement looks scanned, so this pilot could not read its text. OCR is not available yet. Use an XLSX, CSV, or a digital text PDF for now; the scanned file is not retained.";
    if (/\b(why|what does|how come)\b.*\b(behind|stale|old history|out of date)\b|\bhow.*up to date\b/.test(q)) return coverage + " Import the missed statement to catch up; exact duplicates are skipped.";
    if (/\b(learn|learning)\b.*\b(chat|conversation|questions)\b/.test(q)) return "The Coach does not learn new language skills from chat. It uses local rules and ledger arithmetic. Save & learn on a corrected transaction teaches merchant sorting matches.";
    if (/\b(how does|what is|difference|why use)\b.*\b(personal|business|mixed)\b/.test(q) && !/\b(spend|spent|expense|outflow|cost|paid|transaction)\b/.test(q)) return "Personal or Business sets the main view. Accounts stay in one ledger. If an account mixes both kinds of spending, enable mixed-use sorting in Settings and tag each transaction's purpose.";
    if (/\b(expected income|planned income)\b/.test(q) && /\b(balance|available|cash in account)\b/.test(q)) return "Expected income is a plan, not money received, so it is shown separately and is not added to account balances or safe-to-spend.";

    if (/need sorting|sort(ing)?|review|unclear|unclassified/.test(q)) {
      if (!pending.length) {
        return assumedCount
          ? assumedCount + " transaction(s) still use the default purpose. Review any personal or business exceptions in Activity." + coverage
          : "Your sorting queue is clear. New imports with uncertain details will wait for review." + coverage;
      }
      const examples = pending.slice(0, 3)
        .map(row => (row.desc || row.description || "Untitled transaction") + " (" + money(row.amount) + ")")
        .join(", ");
      return pending.length + " item(s) need sorting. Examples: " + examples +
        ". Review them in Activity before using them in totals." +
        (assumedCount ? " " + assumedCount + " more transaction(s) still use the default purpose." : "") + coverage;
    }

    if (/\bpersonal(?:ly)?\b.*\bbusiness\b|\bbusiness\b.*\bpersonal(?:ly)?\b|\bmixed\b/.test(q)) {
      const parts = ["Business", "Personal", "Owner draw"].map(label =>
        label + " " + money(outflow(current.filter(row => row.purpose === label)))
      );
      return "For " + period.label + ", confirmed outflow: " + parts.join("; ") + "." + caveat;
    }

    if (/\bowner.?s? draw\b|\bdrawings\b/.test(q) && /spend|expense|outflow|cost|paid|transaction/.test(q)) {
      return "For " + period.label + ", confirmed owner draw outflow: " +
        money(outflow(current.filter(row => row.purpose === "Owner draw"))) + "." + caveat;
    }

    if (/\b(personal(?:ly)?|business)\b/.test(q) && /spend|expense|outflow|cost|paid|transaction/.test(q)) {
      const purpose = /\bpersonal(?:ly)?\b/.test(q) ? "Personal" : "Business";
      return "For " + period.label + ", confirmed " + purpose.toLowerCase() + " outflow: " +
        money(outflow(current.filter(row => row.purpose === purpose))) + "." + caveat;
    }

    const mainGoal = goals.find(item => item.main) || goals[0];
    if (/\bhow many more\b.*\bgoals?\b|\bhow many goals can i (add|track|have)\b/.test(q)) return "You can track up to 3 goals. You have " + goals.length + " now and can add " + Math.max(0, 3 - goals.length) + " more.";
    if (/\b(how many|number of|count)\b.*\bgoals?\b|\bgoals?\b.*\b(how many|count)\b/.test(q)) return "You have " + goals.length + " of up to 3 goals." + (mainGoal ? " Main goal: " + mainGoal.name + "." : " Add one in Goals to get started.") + coverage;
    if (/\b(list|show|which|what are|name)\b.*\bgoals?\b|\ball goals\b/.test(q)) {
      return goals.length ? "Your goals: " + goals.map(item => item.name + (item.main ? " (main)" : " (supporting)") + ": " + goalMoney(item, item.saved) + " of " + goalMoney(item, item.target)).join("; ") + "." + coverage : "You have no saved goals yet. Add one in Goals; you can track up to 3." + coverage;
    }
    if (/goal|saving|target|milestone/.test(q) || goals.some(item => item.name && q.includes(String(item.name).toLowerCase()))) {
      const goal = goals.find(item => item.name && q.includes(String(item.name).toLowerCase())) || goals.find(item => item.main) || goals[0];
      if (!goal) {
        return "There is no saved goal in this workspace yet. Add one in Goals and I can track its progress." + coverage;
      }
      const target = Number(goal.target) || 0;
      const saved = Number(goal.saved) || 0;
      const percent = Math.round(target ? saved / target * 100 : 0);
      if (/left|remaining|shortfall/.test(q)) return goal.name + " has " + goalMoney(goal, Math.max(0,target-saved)) + " left to reach its target." + caveat;
      if (/checkpoint|milestone/.test(q)) { const count=Math.max(3,Math.min(6,Math.round(Number(goal.checkpoints)||4))),marks=Array.from({length:count},(_,i)=>Math.round((i+1)*100/count)),next=marks.map(v=>Math.ceil(target*v/100)).find(v=>v>saved); return next===undefined?goal.name+" has reached its target."+caveat:"The next checkpoint for "+goal.name+" is "+goalMoney(goal,next)+"; "+goalMoney(goal,next-saved)+" to go."+caveat; }
      return goal.name + " is at " + goalMoney(goal,saved) + " of " + goalMoney(goal,target) + " (" + percent + "%)." + caveat;
    }

    const amount = q.match(/(?:ngn|₦|n)\s*([\d,]+)|([\d,]+)/i);
    if ((/\b(can|could|would|should)\s+i\s+(safely\s+)?spend\b|\bcan i afford\b|\bafford\b|\bsafe to spend\b/.test(q)) && amount) {
      const requested = Number((amount[1] || amount[2]).replace(/,/g, "")) || 0;
      const available = Number(data.safeToSpend) || 0;
      const result = requested <= available ? " is within " : " is above ";
      return money(requested) + result + "the current " + money(available) +
        " available after known bills. Expected income is not included." + caveat;
    }

    if (/safe to spend|safely spend|available after|available now|available to spend|how much can i spend/.test(q)) {
      return "Current balances less known bills due in the next 30 days: " +
        money(data.safeToSpend) + ". Expected income is excluded." + caveat;
    }

    if (/\b(last|latest|when|how recent|up to date)\b/.test(q) && /\b(import|statement|history|data)\b/.test(q)) {
      const imported = (data.imports || []).filter(item => item && item.status === "imported").sort((a, b) => String(b.end).localeCompare(String(a.end)));
      return imported.length ? "Latest imported statement: " + (imported[0].file || "statement") + ", through " + imported[0].end + "." + coverage : "No statement has been imported into this ledger yet. You can plan from entered balances now and import history later.";
    }
    if (/\b(how many|number|count|list|show|which)\b.*\b(accounts?|wallets?)\b/.test(q)) {
      const count = accounts.length || Number(data.accountCount) || 0;
      return accounts.length ? "You have " + count + " account(s): " + accounts.map(item => item.name + " (" + money(item.balance) + ")").join("; ") + "." : "You have " + count + " account(s) in this ledger.";
    }
    const accountMatch = accounts.find(item => item.name && q.includes(String(item.name).toLowerCase()));
    if (accountMatch && /\b(spend|spent|income|transactions?|activity)\b/.test(q)) {
      const accountRows = current.filter(row => row.account === accountMatch.id || row.account === accountMatch.name);
      return accountMatch.name + " has " + money(inflow(accountRows)) + " in and " + money(outflow(accountRows)) + " out for " + period.label + " across " + accountRows.length + " confirmed transaction(s)." + caveat;
    }
    if (accountMatch && /\b(balance|how much)\b/.test(q)) return accountMatch.name + " has an entered balance of " + money(accountMatch.balance) + (accountMatch.asof ? ", last checked " + accountMatch.asof : "") + ". This balance is manually maintained.";
    if (/\b(connect.*bank|bank connection|link.*bank|sync.*bank)\b/.test(q)) return "This pilot does not connect to bank or wallet accounts. Add balances manually and import an XLSX, CSV, or digital PDF statement when you want transaction history.";
    if (/\b(currency|usd|dollars|united states)\b/.test(q)) return "Account balances and transaction totals use NGN. Goals can be set in NGN or USD; the app does not convert between currencies.";
    if (/\b(mark|set|change)\b.*\b(invoice|invoices)\b.*\bpaid\b|\bhow.*paid.*invoice\b/.test(q)) return "Open Invoices and choose Mark paid on the settled invoice. This updates its status but does not change an account balance; update that balance separately.";    if (/\b(invoice|invoices|receivable|receivables|client owes|owed by client)\b/.test(q)) {
      const open = invoices.filter(item => item.status !== "paid"), overdue = open.filter(item => item.due && item.due < today);
      if (/\b(overdue|late)\b/.test(q)) return overdue.length ? overdue.length + " invoice(s) are overdue, totaling " + money(total(overdue.map(item => ({ amount: item.amount })))) + ". Receivables are not cash in your accounts." : "There are no overdue unpaid invoices in this ledger.";
      return open.length ? open.length + " unpaid invoice(s) total " + money(total(open.map(item => ({ amount: item.amount })))) + ". Receivables are not cash in your accounts." : "There are no unpaid invoices in this ledger.";
    }
    if (/\b(expected|planned|upcoming|coming up|plan|plans|due|forecast)\b/.test(q) && /\b(income|inflow|bill|bills|expense|expenses|cost|payment|payments|cash|money)\b/.test(q)) {
      const end = /\bthis month\b/.test(q) ? new Date(Date.UTC(new Date(today + "T00:00:00Z").getUTCFullYear(), new Date(today + "T00:00:00Z").getUTCMonth() + 1, 0)).toISOString().slice(0, 10) : shiftDate(today, /\b(next 7 days|next week|this week)\b/.test(q) ? 7 : 30);
      let selected = plans.filter(item => item.date >= today && item.date <= end);
      if (/\b(income|inflow)\b/.test(q) && !/\b(bill|expense|cost)\b/.test(q)) selected = selected.filter(item => item.type === "income");
      if (/\b(bill|bills|expense|expenses|cost)\b/.test(q) && !/\b(income|inflow)\b/.test(q)) selected = selected.filter(item => item.type === "expense");
      selected.sort((a, b) => a.date.localeCompare(b.date));
      return selected.length ? selected.length + " planned cash event(s) total " + money(total(selected.map(item => ({ amount: item.amount })))) + ": " + selected.slice(0, 5).map(item => (item.name || "Cash event") + " " + money(item.amount) + " due " + item.date).join("; ") + ". Planned income is not included in current balances." : "There are no matching planned cash events due in the period asked about.";
    }
    if (/\bhow many\b.*\btransactions?\b|\btransactions?\b.*\bhow many\b/.test(q)) {
      const needsReview = rows.filter(row => row.date >= period.start && row.date <= period.end && (row.status === "review" || row.cat === "Needs sorting" || row.purpose === "Needs sorting")).length;
      return current.length + " confirmed transaction(s) for " + period.label + (needsReview ? "; " + needsReview + " more item(s) need sorting and are excluded from totals." : ".") + coverage;
    }
    if ((/\b(most|highest|largest|biggest)\b/.test(q) || /\bwhere.*money.*go\b/.test(q)) && /\b(spend|spent|expense|outflow|category|transaction|money)\b/.test(q)) {
      if (/\b(category|most|highest|where.*money.*go)\b/.test(q) && !/\b(largest|biggest) (expense|transaction)\b/.test(q)) {
        const sums = new Map();
        current.filter(row => row.type === "expense" && row.cat !== "Needs sorting").forEach(row => sums.set(row.cat || "Other", (sums.get(row.cat || "Other") || 0) + (Number(row.amount) || 0)));
        const top = Array.from(sums.entries()).sort((a, b) => b[1] - a[1])[0];
        if (top) return "Your largest spending category for " + period.label + " is " + top[0] + " at " + money(top[1]) + "." + caveat;
      }
      const largest = current.filter(row => row.type === "expense").sort((a, b) => Number(b.amount) - Number(a.amount))[0];
      return largest ? "Your largest confirmed expense for " + period.label + " is " + (largest.desc || largest.description || "Untitled transaction") + " at " + money(largest.amount) + "." + caveat : "There is no confirmed spending to rank for " + period.label + "." + coverage;
    }
    if (/\b(recent|latest transaction|last transaction|show transactions|list transactions|recent activity)\b/.test(q)) {
      const recent = confirmed.slice().sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""))).slice(0, 5);
      return recent.length ? "Most recent confirmed activity: " + recent.map(row => (row.desc || row.description || "Transaction") + " " + money(row.amount) + (row.date ? " on " + row.date : "")).join("; ") + "." + coverage : "There are no confirmed transactions yet. Log activity or import a statement to begin.";
    }
    const merchantMatch = q.match(/\b(?:at|on)\s+(.+?)(?:\s+(?:this|last|past|in|during|over)\b|[?.!,]|$)/);
    if (merchantMatch && !/\b(food|groceries|grocer|transport|fuel|petrol|rent|bills|health|medical|education|school|fees|shopping|savings)\b/.test(merchantMatch[1])) {
      const merchant = merchantMatch[1].replace(/^(the|my)\s+/, "").trim();
      const matches = current.filter(row => String(row.desc || row.description || "").toLowerCase().includes(merchant));
      if (matches.length) return "For " + period.label + ", confirmed activity matching " + merchant + " totals " + money(total(matches.map(row => ({ amount: row.amount })))) + " across " + matches.length + " transaction(s)." + caveat;
    }
    const categories = [
      ["Food", /food|grocer|supermarket|market/],
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
      return "For " + period.label + ", confirmed " + category[0].toLowerCase() + " outflow: " +
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
      return "For " + period.label + ", confirmed income is " + money(inflow(current)) + "." + caveat;
    }

    if (/spend|outflow|cashflow|this month|month summary/.test(q)) {
      return "For " + period.label + ", confirmed activity is " + money(inflow(current)) + " in and " + money(outflow(current)) +
        " out. Entered balances total " + money(data.balance) + "." + caveat;
    }

    if (/balance|account|how much.*have/.test(q)) {
      return "Entered balances total " + money(data.balance) + " across " +
        (data.accountCount || 0) + " account(s)." + caveat;
    }

    return "I do not have a reliable answer for that yet. Try asking about goal count or progress, balances, spending by date or category, recent activity, planned cash, invoices, runway or items that need sorting. Ask \"What can you do?\" for examples." + coverage;
  }

  const api = Object.freeze({ answer });
  root.CashCoach = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);