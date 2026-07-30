(function () {
  const RULE_KEY = "roadcost-ng-rule-snapshot";
  const RULE_TTL_HOURS = 48;
  const REVIEW_TARGET_HOURS = 24;

  const defaultRuleSnapshot = {
    verifiedAt: "2026-07-10T09:00:00+01:00",
    notes: [
      "Green surcharge prototype: 0% below 2000cc, 2% from 2000cc to 3999cc, 4% from 4000cc and above.",
      "Import duty, NAC levy, VAT, freight, fuel, insurance, maintenance, and registration are editable estimates.",
      "Production must refresh verified sources every 24-48 hours before publishing totals."
    ]
  };

  const fields = [
    "vehicleName",
    "purchasePrice",
    "priceCurrency",
    "fxRate",
    "engineSize",
    "vehicleCondition",
    "freightInsurance",
    "monthlyFuelLitres",
    "fuelPrice",
    "insuranceAnnual",
    "maintenanceAnnual",
    "registrationAnnual",
    "importDutyRate",
    "nacLevyRate",
    "vatRate",
    "adminBuffer"
  ];

  const elements = Object.fromEntries(
    fields.map((id) => [id, document.getElementById(id)])
  );

  const ui = {
    trustStrip: document.getElementById("trustStrip"),
    trustStatus: document.getElementById("trustStatus"),
    trustMeta: document.getElementById("trustMeta"),
    verifiedAt: document.getElementById("verifiedAt"),
    nextCheck: document.getElementById("nextCheck"),
    calcPolicy: document.getElementById("calcPolicy"),
    resultTitle: document.getElementById("resultTitle"),
    estimateBadge: document.getElementById("estimateBadge"),
    blockedMessage: document.getElementById("blockedMessage"),
    summaryGrid: document.getElementById("summaryGrid"),
    landedCost: document.getElementById("landedCost"),
    monthlyFuelCost: document.getElementById("monthlyFuelCost"),
    annualCost: document.getElementById("annualCost"),
    breakdown: document.getElementById("breakdown"),
    confirmRulesButton: document.getElementById("confirmRulesButton")
  };

  const money = new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0
  });

  const dateFormatter = new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short"
  });

  function getRuleSnapshot() {
    const saved = localStorage.getItem(RULE_KEY);
    if (!saved) return defaultRuleSnapshot;

    try {
      return { ...defaultRuleSnapshot, ...JSON.parse(saved) };
    } catch (error) {
      return defaultRuleSnapshot;
    }
  }

  function saveFreshSnapshot() {
    localStorage.setItem(
      RULE_KEY,
      JSON.stringify({
        ...defaultRuleSnapshot,
        verifiedAt: new Date().toISOString()
      })
    );
    calculate();
  }

  function hoursSince(dateValue) {
    return (Date.now() - new Date(dateValue).getTime()) / 36e5;
  }

  function addHours(dateValue, hours) {
    return new Date(new Date(dateValue).getTime() + hours * 36e5);
  }

  function numberValue(id) {
    const value = Number(elements[id].value);
    return Number.isFinite(value) && value >= 0 ? value : NaN;
  }

  function percent(id) {
    return numberValue(id) / 100;
  }

  function greenTaxRate(engineSize) {
    if (engineSize >= 4000) return 0.04;
    if (engineSize >= 2000) return 0.02;
    return 0;
  }

  function updateRuleFreshness(snapshot) {
    const elapsed = hoursSince(snapshot.verifiedAt);
    const stale = elapsed > RULE_TTL_HOURS;
    const reviewAt = addHours(snapshot.verifiedAt, REVIEW_TARGET_HOURS);
    const expiresAt = addHours(snapshot.verifiedAt, RULE_TTL_HOURS);

    ui.trustStrip.classList.toggle("stale", stale);
    ui.trustStatus.textContent = stale ? "Rules need reconfirmation" : "Rules inside trust window";
    ui.trustMeta.textContent = stale
      ? "Totals are blocked until tax and duty assumptions are checked again."
      : `Review due ${dateFormatter.format(reviewAt)}; hard expiry ${dateFormatter.format(expiresAt)}.`;
    ui.verifiedAt.textContent = dateFormatter.format(new Date(snapshot.verifiedAt));
    ui.nextCheck.textContent = dateFormatter.format(reviewAt);
    ui.calcPolicy.textContent = stale ? "Blocked until confirmed" : "Allowed with estimate labels";
    ui.estimateBadge.textContent = stale ? "Stale" : "Estimate";

    return stale;
  }

  function validateInputs() {
    const invalid = fields.some((id) => {
      if (elements[id].type === "number") {
        return Number.isNaN(numberValue(id));
      }
      return false;
    });

    if (invalid) {
      ui.blockedMessage.hidden = false;
      ui.blockedMessage.querySelector("strong").textContent = "Calculation blocked.";
      ui.blockedMessage.querySelector("span").textContent =
        "Fix missing or negative input values before totals can be shown.";
      return false;
    }

    return true;
  }

  function setBlocked(isBlocked) {
    ui.blockedMessage.hidden = !isBlocked;
    ui.summaryGrid.style.opacity = isBlocked ? "0.35" : "1";
    ui.breakdown.style.opacity = isBlocked ? "0.35" : "1";
  }

  function makeRow(label, value, helper) {
    const row = document.createElement("div");
    row.className = "breakdown-row";
    row.innerHTML = `
      <div>
        <strong>${label}</strong>
        <small>${helper}</small>
      </div>
      <b>${money.format(value)}</b>
    `;
    return row;
  }

  function calculate() {
    const snapshot = getRuleSnapshot();
    const stale = updateRuleFreshness(snapshot);
    ui.blockedMessage.querySelector("strong").textContent = "Calculation blocked.";
    ui.blockedMessage.querySelector("span").textContent =
      "Tax and duty assumptions are older than 48 hours. Confirm the snapshot before showing buyer-facing totals.";
    const inputsValid = validateInputs();
    const blocked = stale || !inputsValid;

    const vehicleName = elements.vehicleName.value.trim() || "Selected vehicle";
    const purchaseRaw = numberValue("purchasePrice");
    const fxRate = numberValue("fxRate");
    const purchasePrice =
      elements.priceCurrency.value === "USD" ? purchaseRaw * fxRate : purchaseRaw;
    const condition = elements.vehicleCondition.value;
    const freightInsurance = condition === "local" ? 0 : numberValue("freightInsurance");
    const cif = purchasePrice + freightInsurance;
    const engineSize = numberValue("engineSize");
    const greenRate = condition === "local" ? 0 : greenTaxRate(engineSize);
    const importDuty = condition === "local" ? 0 : cif * percent("importDutyRate");
    const nacLevy = condition === "local" ? 0 : cif * percent("nacLevyRate");
    const greenTax = condition === "local" ? 0 : cif * greenRate;
    const vatBase = cif + importDuty + nacLevy + greenTax;
    const vat = condition === "local" ? 0 : vatBase * percent("vatRate");
    const adminBuffer = condition === "local" ? 0 : numberValue("adminBuffer");
    const estimatedDuty = importDuty + nacLevy + greenTax + vat + adminBuffer;
    const landedCost = purchasePrice + freightInsurance + estimatedDuty;
    const monthlyFuelCost = numberValue("monthlyFuelLitres") * numberValue("fuelPrice");
    const annualRunningCost =
      monthlyFuelCost * 12 +
      numberValue("insuranceAnnual") +
      numberValue("maintenanceAnnual") +
      numberValue("registrationAnnual");
    const firstYearCost = landedCost + annualRunningCost;

    ui.resultTitle.textContent = vehicleName;
    setBlocked(blocked);

    if (blocked) {
      ui.landedCost.textContent = "--";
      ui.monthlyFuelCost.textContent = "--";
      ui.annualCost.textContent = "--";
    } else {
      ui.landedCost.textContent = money.format(landedCost);
      ui.monthlyFuelCost.textContent = money.format(monthlyFuelCost);
      ui.annualCost.textContent = money.format(firstYearCost);
    }

    ui.breakdown.replaceChildren(
      makeRow("Purchase price", purchasePrice, "Buyer-entered estimate converted to NGN where needed."),
      makeRow("Freight + insurance", freightInsurance, "Editable CIF-building estimate; zeroed for already-cleared local vehicles."),
      makeRow("Import duty", importDuty, `${elements.importDutyRate.value}% statutory-rate assumption on estimated CIF.`),
      makeRow("NAC levy", nacLevy, `${elements.nacLevyRate.value}% levy assumption; confirm current rule before publishing.`),
      makeRow("Engine-size green surcharge", greenTax, `${Math.round(greenRate * 100)}% prototype rate based on ${engineSize}cc engine size.`),
      makeRow("VAT estimate", vat, `${elements.vatRate.value}% VAT assumption on value plus import charge lines.`),
      makeRow("Admin / terminal buffer", adminBuffer, "Non-statutory editable allowance for processing and terminal costs."),
      makeRow("Annual fuel", monthlyFuelCost * 12, "Monthly litres multiplied by editable fuel price, then annualised."),
      makeRow("Insurance, maintenance, papers", annualRunningCost - monthlyFuelCost * 12, "Buyer-entered annual ownership assumptions.")
    );
  }

  fields.forEach((id) => {
    elements[id].addEventListener("input", calculate);
    elements[id].addEventListener("change", calculate);
  });

  elements.vehicleCondition.addEventListener("change", () => {
    if (elements.vehicleCondition.value === "new") {
      elements.nacLevyRate.value = "10";
    }
    if (elements.vehicleCondition.value === "used") {
      elements.nacLevyRate.value = "5";
    }
    calculate();
  });

  ui.confirmRulesButton.addEventListener("click", saveFreshSnapshot);

  calculate();
})();
