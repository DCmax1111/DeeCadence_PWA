const VALID_GROUPS = new Set(["week", "month"]);

function clampBlock(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(4, Math.round(n)));
}

function scoreFor({ totalBlocksAttempted, totalBlocksCompleted, daysActive, periodDays }) {
  const attempted = Math.max(0, Number(totalBlocksAttempted || 0));
  const completed = Math.max(0, Number(totalBlocksCompleted || 0));
  const active = Math.max(0, Number(daysActive || 0));
  const days = Math.max(1, Number(periodDays || 7));
  const completionRate = attempted > 0 ? Math.min(1, completed / attempted) : 0;
  const consistencyRate = Math.min(1, active / days);
  const score = Math.round((completionRate * 60) + (consistencyRate * 40));
  return {
    completionRate: Math.round(completionRate * 100),
    consistencyRate: Math.round(consistencyRate * 100),
    focusStrengthScore: Math.max(0, Math.min(100, score))
  };
}

function periodKey(date, group = "week") {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  if (group === "month") {
    return `${utc.getUTCFullYear()}-${String(utc.getUTCMonth() + 1).padStart(2, "0")}-01`;
  }
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() - day + 1);
  return utc.toISOString().slice(0, 10);
}

function periodDaysFor(key, group = "week") {
  if (group === "week") return 7;
  const date = new Date(`${key}T00:00:00.000Z`);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
}

function periodEndFor(key, group = "week") {
  const date = new Date(`${key}T00:00:00.000Z`);
  if (group === "month") {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
  }
  date.setUTCDate(date.getUTCDate() + 6);
  return date.toISOString().slice(0, 10);
}

function focusStrengthMessage(score) {
  if (score >= 85) return "Your Focus Strength is elite because you keep showing up.";
  if (score >= 65) return "Your focus is becoming sturdy. Keep stacking clean blocks.";
  if (score >= 40) return "Your focus span is still forming, but the system is waking up.";
  if (score > 0) return "Your focus span is short this week, but every block is a vote for the person you are building.";
  return "Start with one block. DeeCee will track the strength from there.";
}

function groupFocusStrength(rows = [], group = "week") {
  const safeGroup = VALID_GROUPS.has(group) ? group : "week";
  const buckets = new Map();

  for (const row of rows) {
    const key = periodKey(row.created_at || row.createdAt, safeGroup);
    if (!key) continue;
    if (!buckets.has(key)) {
      buckets.set(key, {
        periodStart: key,
        periodEnd: periodEndFor(key, safeGroup),
        totalBlocksAttempted: 0,
        totalBlocksCompleted: 0,
        activeDays: new Set(),
        sessions: 0
      });
    }
    const bucket = buckets.get(key);
    bucket.totalBlocksAttempted += clampBlock(row.total_blocks_attempted ?? row.totalBlocksAttempted);
    bucket.totalBlocksCompleted += clampBlock(row.total_blocks_completed ?? row.totalBlocksCompleted);
    bucket.sessions += 1;
    const activeDay = new Date(row.created_at || row.createdAt).toISOString().slice(0, 10);
    bucket.activeDays.add(activeDay);
  }

  return Array.from(buckets.values())
    .sort((a, b) => a.periodStart.localeCompare(b.periodStart))
    .map((bucket) => {
      const periodDays = periodDaysFor(bucket.periodStart, safeGroup);
      const scored = scoreFor({
        totalBlocksAttempted: bucket.totalBlocksAttempted,
        totalBlocksCompleted: bucket.totalBlocksCompleted,
        daysActive: bucket.activeDays.size,
        periodDays
      });
      return {
        periodStart: bucket.periodStart,
        periodEnd: bucket.periodEnd,
        group: safeGroup,
        score: scored.focusStrengthScore,
        focusStrengthScore: scored.focusStrengthScore,
        completionRate: scored.completionRate,
        consistencyRate: scored.consistencyRate,
        daysActive: bucket.activeDays.size,
        periodDays,
        totalBlocksAttempted: bucket.totalBlocksAttempted,
        totalBlocksCompleted: bucket.totalBlocksCompleted,
        sessions: bucket.sessions,
        message: focusStrengthMessage(scored.focusStrengthScore)
      };
    });
}

module.exports = {
  clampBlock,
  focusStrengthMessage,
  groupFocusStrength,
  periodKey,
  scoreFor
};
