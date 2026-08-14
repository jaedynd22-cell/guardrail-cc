"use strict";

const { readAuditEntries } = require("./lib/policy-engine");

function pad(str, len) {
  str = String(str);
  return str.length >= len ? str.slice(0, len - 1) + "…" : str + " ".repeat(len - str.length);
}

function report(cwd) {
  const entries = readAuditEntries(cwd);

  if (entries.length === 0) {
    console.log("No guardrail activity recorded yet for this project.");
    console.log("Run `npx guardrail-cc init` if you haven't wired it up, then use Claude Code normally.");
    return;
  }

  const counts = { allow: 0, deny: 0, ask: 0 };
  const trips = [];
  const sessions = new Set();

  for (const e of entries) {
    counts[e.decision] = (counts[e.decision] || 0) + 1;
    sessions.add(e.session_id);
    if (e.circuit_breaker_tripped) trips.push(e);
  }

  console.log(`guardrail-cc report — ${entries.length} actions across ${sessions.size} session(s)\n`);
  console.log(pad("Decision", 10) + pad("Count", 8));
  console.log("-".repeat(18));
  for (const key of ["allow", "ask", "deny"]) {
    console.log(pad(key, 10) + pad(counts[key] || 0, 8));
  }

  const denied = entries.filter((e) => e.decision === "deny");
  if (denied.length) {
    console.log(`\nBlocked actions (${denied.length}):`);
    for (const e of denied.slice(-10)) {
      const cmd = e.tool_input && e.tool_input.command ? e.tool_input.command : JSON.stringify(e.tool_input);
      console.log(`  [${e.ts}] ${e.tool_name}: ${cmd}`);
      console.log(`      reason: ${e.reason}`);
    }
  }

  if (trips.length) {
    console.log(`\nCircuit breaker tripped ${trips.length} time(s):`);
    for (const e of trips.slice(-5)) {
      console.log(`  [${e.ts}] session ${e.session_id}: ${e.reason}`);
    }
  } else {
    console.log("\nCircuit breaker never tripped — no runaway loops detected.");
  }
}

module.exports = { report };
