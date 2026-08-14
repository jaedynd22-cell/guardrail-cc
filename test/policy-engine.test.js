"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  readJSON,
  writeJSON,
  matchRule,
  targetStringFor,
  evaluate,
  policyPath,
} = require("../src/lib/policy-engine");

function tmpProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "guardrail-test-"));
}

test("readJSON returns the fallback when the file does not exist", () => {
  const missing = path.join(tmpProject(), "nope.json");
  assert.deepEqual(readJSON(missing, { ok: true }), { ok: true });
});

test("writeJSON then readJSON round-trips the same data", () => {
  const cwd = tmpProject();
  const file = path.join(cwd, "nested", "dir", "data.json");
  writeJSON(file, { a: 1, b: [1, 2, 3] });
  assert.deepEqual(readJSON(file, null), { a: 1, b: [1, 2, 3] });
});

test("matchRule: wildcard tool matches anything", () => {
  assert.equal(matchRule({ tool: "*" }, "Bash", "ls"), true);
});

test("matchRule: tool name must match when not wildcard", () => {
  assert.equal(matchRule({ tool: "Edit" }, "Bash", "ls"), false);
});

test("matchRule: applies the regex in `match` against the target", () => {
  const rule = { tool: "Bash", match: "^git push.*--force" };
  assert.equal(matchRule(rule, "Bash", "git push --force origin main"), true);
  assert.equal(matchRule(rule, "Bash", "git push origin main"), false);
});

test("matchRule: a malformed regex fails closed (no match) rather than throwing", () => {
  const rule = { tool: "Bash", match: "(unterminated" };
  assert.doesNotThrow(() => matchRule(rule, "Bash", "anything"));
  assert.equal(matchRule(rule, "Bash", "anything"), false);
});

test("targetStringFor: uses the raw command string for Bash", () => {
  assert.equal(
    targetStringFor("Bash", { command: "rm -rf /" }),
    "rm -rf /"
  );
});

test("targetStringFor: falls back to JSON for non-Bash tools", () => {
  assert.equal(
    targetStringFor("Edit", { file_path: "/x.js" }),
    JSON.stringify({ file_path: "/x.js" })
  );
});

test("evaluate: throws a clear error when no policy has been installed", () => {
  const cwd = tmpProject();
  assert.throws(
    () => evaluate(cwd, { tool_name: "Bash", tool_input: { command: "ls" } }),
    /npx guardrail-cc init/
  );
});

test("evaluate: first matching rule wins, in order", () => {
  const cwd = tmpProject();
  writeJSON(policyPath(cwd), {
    name: "test-policy",
    rules: [
      { tool: "Bash", match: "^rm -rf /", decision: "deny", reason: "nope" },
      { tool: "Bash", decision: "allow", reason: "bash is fine" },
      { tool: "*", decision: "ask", reason: "default" },
    ],
  });

  const denied = evaluate(cwd, { tool_name: "Bash", tool_input: { command: "rm -rf /" } });
  assert.equal(denied.decision, "deny");

  const allowed = evaluate(cwd, { tool_name: "Bash", tool_input: { command: "ls -la" } });
  assert.equal(allowed.decision, "allow");

  const asked = evaluate(cwd, { tool_name: "Read", tool_input: { file_path: "/x" } });
  assert.equal(asked.decision, "ask");
});

test("evaluate: defaults to ask when nothing in the policy matches", () => {
  const cwd = tmpProject();
  writeJSON(policyPath(cwd), { name: "empty", rules: [] });
  const result = evaluate(cwd, { tool_name: "Bash", tool_input: { command: "ls" } });
  assert.equal(result.decision, "ask");
});

test("evaluate: circuit breaker trips after the configured number of auto-approvals", () => {
  const cwd = tmpProject();
  writeJSON(policyPath(cwd), {
    name: "cb-test",
    rules: [{ tool: "*", decision: "allow", reason: "always allow" }],
    circuitBreaker: { maxAutoApprovedActions: 3, windowMinutes: 15, onTrip: "ask" },
  });

  const sessionId = "session-abc";
  let last;
  for (let i = 0; i < 5; i++) {
    last = evaluate(cwd, {
      session_id: sessionId,
      tool_name: "Bash",
      tool_input: { command: `echo ${i}` },
    });
  }

  assert.equal(last.decision, "ask");
  assert.equal(last.circuitBreakerTripped, true);
});

test("evaluate: circuit breaker counts are isolated per session", () => {
  const cwd = tmpProject();
  writeJSON(policyPath(cwd), {
    name: "cb-per-session",
    rules: [{ tool: "*", decision: "allow", reason: "always allow" }],
    circuitBreaker: { maxAutoApprovedActions: 2, windowMinutes: 15, onTrip: "deny" },
  });

  for (let i = 0; i < 2; i++) {
    evaluate(cwd, { session_id: "session-1", tool_name: "Bash", tool_input: { command: "x" } });
  }
  // session-2 starts fresh and should not be affected by session-1's count.
  const result = evaluate(cwd, {
    session_id: "session-2",
    tool_name: "Bash",
    tool_input: { command: "x" },
  });
  assert.equal(result.decision, "allow");
  assert.equal(result.circuitBreakerTripped, false);
});
