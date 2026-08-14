"use strict";

const fs = require("fs");
const path = require("path");
const { guardrailDir, policyPath, writeJSON, readJSON } = require("./lib/policy-engine");

const PROFILES_DIR = path.join(__dirname, "..", "profiles");
const HOOK_COMMAND = "npx -y guardrail-cc hook pre-tool-use";

function listProfiles() {
  return fs
    .readdirSync(PROFILES_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""));
}

function mergeHookIntoSettings(cwd, force) {
  const settingsPath = path.join(cwd, ".claude", "settings.json");
  const settings = readJSON(settingsPath, {});

  settings.hooks = settings.hooks || {};
  settings.hooks.PreToolUse = settings.hooks.PreToolUse || [];

  const alreadyWired = settings.hooks.PreToolUse.some((group) =>
    (group.hooks || []).some((h) => h.command === HOOK_COMMAND)
  );

  if (alreadyWired && !force) {
    return { settingsPath, changed: false };
  }

  settings.hooks.PreToolUse.push({
    matcher: ".*",
    hooks: [
      {
        type: "command",
        command: HOOK_COMMAND,
        timeout: 10,
        statusMessage: "guardrail-cc: checking action against safety policy...",
      },
    ],
  });

  writeJSON(settingsPath, settings);
  return { settingsPath, changed: true };
}

function init(cwd, profileName, force) {
  const available = listProfiles();
  const profile = profileName || "balanced";

  if (!available.includes(profile)) {
    throw new Error(
      `Unknown profile "${profile}". Available profiles: ${available.join(", ")}`
    );
  }

  const dest = policyPath(cwd);
  if (fs.existsSync(dest) && !force) {
    console.log(
      `A policy already exists at ${path.relative(cwd, dest)}. Pass --force to overwrite it.`
    );
  } else {
    fs.mkdirSync(guardrailDir(cwd), { recursive: true });
    const src = path.join(PROFILES_DIR, `${profile}.json`);
    fs.copyFileSync(src, dest);
    console.log(`Installed the "${profile}" guardrail profile at ${path.relative(cwd, dest)}`);
  }

  const { settingsPath, changed } = mergeHookIntoSettings(cwd, force);
  if (changed) {
    console.log(`Wired guardrail into ${path.relative(cwd, settingsPath)} (PreToolUse hook).`);
  } else {
    console.log(`${path.relative(cwd, settingsPath)} already has guardrail wired up.`);
  }

  console.log("");
  console.log("Guardrail is live for this project. Every autonomous action Claude Code");
  console.log('takes will be checked against the policy, logged, and circuit-broken if it');
  console.log("runs away. Run `npx guardrail-cc report` any time to see the audit trail.");
}

module.exports = { init, listProfiles };
