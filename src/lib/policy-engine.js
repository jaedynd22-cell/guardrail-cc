"use strict";

const fs = require("fs");
const path = require("path");

function guardrailDir(cwd) {
  return path.join(cwd, ".claude", "guardrail");
}

function policyPath(cwd) {
  return path.join(guardrailDir(cwd), "policy.json");
}

function auditPath(cwd) {
  return path.join(guardrailDir(cwd), "audit.jsonl");
}

function statePath(cwd) {
  return path.join(guardrailDir(cwd), "state.json");
}

function readJSON(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (err) {
    return fallback;
  }
}

function writeJSON(filePath, obj) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2) + "\n", "utf8");
}

function loadPolicy(cwd) {
  const policy = readJSON(policyPath(cwd), null);
  if (!policy) {
    throw new Error(
      "No guardrail policy found. Run `npx guardrail-cc init` in this project first."
    );
  }
  return policy;
}

function appendAudit(cwd, entry) {
  fs.mkdirSync(guardrailDir(cwd), { recursive: true });
  fs.appendFileSync(auditPath(cwd), JSON.stringify(entry) + "\n", "utf8");
}

function readAuditEntries(cwd) {
  const p = auditPath(cwd);
  if (!fs.existsSync(p)) return [];
  return fs
    .readFileSync(p, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch (e) {
        return null;
      }
    })
    .filter(Boolean);
}

function targetStringFor(toolName, toolInput) {
  if (toolName === "Bash" && toolInput && typeof toolInput.command === "string") {
    return toolInput.command;
  }
  try {
    return JSON.stringify(toolInput || {});
  } catch (e) {
    return "";
  }
}

function matchRule(rule, toolName, target) {
  const toolMatches = rule.tool === "*" || rule.tool === toolName;
  if (!toolMatches) return false;
  if (!rule.match) return true;
  try {
    return new RegExp(rule.match).test(target);
  } catch (e) {
    return false;
  }
}

function checkCircuitBreaker(cwd, sessionId, cbConfig) {
  if (!cbConfig || !sessionId) return { tripped: false, count: 0 };
  const state = readJSON(statePath(cwd), {});
  const now = Date.now();
  const windowMs = (cbConfig.windowMinutes || 15) * 60 * 1000;
  const entry = state[sessionId];

  let count;
  let windowStart;
  if (!entry || now - entry.windowStart > windowMs) {
    count = 1;
    windowStart = now;
  } else {
    count = entry.count + 1;
    windowStart = entry.windowStart;
  }

  state[sessionId] = { count, windowStart };
  writeJSON(statePath(cwd), state);

  const max = cbConfig.maxAutoApprovedActions || Infinity;
  return { tripped: count > max, count };
}

/**
 * Evaluate a single tool-use event against the loaded policy.
 * Returns { decision, reason, circuitBreakerTripped, matchedCount }
 */
function evaluate(cwd, event) {
  const policy = loadPolicy(cwd);
  const target = targetStringFor(event.tool_name, event.tool_input);

  let decision = "ask";
  let reason = "No policy loaded; defaulting to ask.";

  for (const rule of policy.rules || []) {
    if (matchRule(rule, event.tool_name, target)) {
      decision = rule.decision;
      reason = rule.reason || `Matched rule for ${rule.tool}.`;
      break;
    }
  }

  let circuitBreakerTripped = false;
  let approvedCount = null;
  if (decision === "allow") {
    const cb = checkCircuitBreaker(cwd, event.session_id, policy.circuitBreaker);
    approvedCount = cb.count;
    if (cb.tripped) {
      circuitBreakerTripped = true;
      decision = (policy.circuitBreaker && policy.circuitBreaker.onTrip) || "ask";
      reason = `Circuit breaker tripped: more than ${policy.circuitBreaker.maxAutoApprovedActions} auto-approved actions in the last ${policy.circuitBreaker.windowMinutes} minutes. Falling back to "${decision}".`;
    }
  }

  return { decision, reason, circuitBreakerTripped, approvedCount, profile: policy.name };
}

module.exports = {
  guardrailDir,
  policyPath,
  auditPath,
  statePath,
  readJSON,
  writeJSON,
  loadPolicy,
  appendAudit,
  readAuditEntries,
  evaluate,
};
