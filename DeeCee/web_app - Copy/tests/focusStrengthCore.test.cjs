const assert = require("node:assert/strict");
const { groupFocusStrength, scoreFor } = require("../server/focusStrengthCore.cjs");

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

test("focus strength blends completion at 60 and consistency at 40", () => {
  const score = scoreFor({
    totalBlocksAttempted: 20,
    totalBlocksCompleted: 16,
    daysActive: 5,
    periodDays: 7
  });
  assert.equal(score.completionRate, 80);
  assert.equal(score.consistencyRate, 71);
  assert.equal(score.focusStrengthScore, 77);
});

test("focus strength groups weekly rows into chart-ready points", () => {
  const rows = [
    { total_blocks_attempted: 4, total_blocks_completed: 4, created_at: "2026-06-01T09:00:00Z" },
    { total_blocks_attempted: 3, total_blocks_completed: 2, created_at: "2026-06-03T09:00:00Z" },
    { total_blocks_attempted: 2, total_blocks_completed: 1, created_at: "2026-06-08T09:00:00Z" }
  ];
  const grouped = groupFocusStrength(rows, "week");
  assert.equal(grouped.length, 2);
  assert.equal(grouped[0].periodStart, "2026-06-01");
  assert.equal(grouped[0].totalBlocksAttempted, 7);
  assert.equal(grouped[0].totalBlocksCompleted, 6);
  assert.equal(grouped[0].daysActive, 2);
  assert.equal(typeof grouped[0].message, "string");
});
