import test from "node:test";
import assert from "node:assert/strict";
import { summarizeSupportTickets } from "./supportTicketStats";

test("summarizeSupportTickets handles empty ticket list cleanly", () => {
  const summary = summarizeSupportTickets([]);
  assert.equal(summary.total, 0);
  assert.equal(summary.openCount, 0);
  assert.equal(summary.inProgressCount, 0);
  assert.equal(summary.resolvedCount, 0);
  assert.equal(summary.resolutionRatePct, 0);
  assert.equal(summary.segments.length, 3);
  assert.deepEqual(
    summary.segments.map((s) => s.label),
    ["Open", "In Progress", "Resolved"]
  );
});

test("summarizeSupportTickets counts Open, In Progress, Resolved, and urgent active tickets", () => {
  const summary = summarizeSupportTickets([
    { status: "open", priority: "urgent" },
    { status: "open", priority: "normal" },
    { status: "in_review", priority: "urgent" },
    { status: "resolved", priority: "urgent" },
  ]);

  assert.equal(summary.total, 4);
  assert.equal(summary.openCount, 2);
  assert.equal(summary.inProgressCount, 1);
  assert.equal(summary.resolvedCount, 1);
  assert.equal(summary.urgentActiveCount, 2);
  assert.equal(summary.resolutionRatePct, 25);
  assert.equal(summary.segments[0].percentage, 50);
  assert.equal(summary.segments[1].percentage, 25);
  assert.equal(summary.segments[2].percentage, 25);
});
