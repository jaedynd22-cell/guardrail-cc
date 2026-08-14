#!/usr/bin/env node
"use strict";

/**
 * Claude Code PreToolUse hook entry point.
 * Reads the event JSON on stdin, evaluates it against the project's
 * guardrail policy, logs the decision to the local audit trail, and
 * writes the hookSpecificOutput JSON Claude Code expects on stdout.
 *
 * Wired up automatically by `guardrail init`; you normally don't run
 * this file directly.
 */

const { evaluate, appendAudit } = require("../src/lib/policy-engine");

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}

async function main() {
  const raw = await readStdin();
  let event;
  try {
    event = JSON.parse(raw || "{}");
  } catch (e) {
    // Malformed input: fail open with no decision so we never hard-break a session.
    process.stdout.write(JSON.stringify({ continue: true }));
    process.exit(0);
  }

  const cwd = event.cwd || process.cwd();

  let result;
  try {
    result = evaluate(cwd, event);
  } catch (e) {
    // No policy installed yet, or a bug in the policy file: fail open, don't block the user.
    process.stdout.write(
      JSON.stringify({
        continue: true,
        systemMessage: `guardrail-cc: ${e.message}`,
      })
    );
    process.exit(0);
  }

  appendAudit(cwd, {
    ts: new Date().toISOString(),
    session_id: event.session_id,
    tool_name: event.tool_name,
    tool_input: event.tool_input,
    decision: result.decision,
    reason: result.reason,
    circuit_breaker_tripped: result.circuitBreakerTripped,
    profile: result.profile,
  });

  const output = {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: result.decision,
      permissionDecisionReason: result.reason,
    },
  };

  if (result.circuitBreakerTripped) {
    output.systemMessage = `guardrail-cc: circuit breaker tripped — ${result.reason}`;
  }

  process.stdout.write(JSON.stringify(output));
  process.exit(0);
}

main();
