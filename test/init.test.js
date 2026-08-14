"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { init, listProfiles } = require("../src/init");
const { policyPath } = require("../src/lib/policy-engine");

function tmpProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "guardrail-init-test-"));
}

test("listProfiles finds the three shipped presets", () => {
  const profiles = listProfiles();
  for (const name of ["cautious", "balanced", "aggressive"]) {
    assert.ok(profiles.includes(name), `expected profiles to include "${name}"`);
  }
});

test("init: rejects an unknown profile name", () => {
  const cwd = tmpProject();
  assert.throws(() => init(cwd, "not-a-real-profile"), /Unknown profile/);
});

test("init: installs the requested profile and wires up the PreToolUse hook", () => {
  const cwd = tmpProject();
  init(cwd, "cautious");

  const policy = JSON.parse(fs.readFileSync(policyPath(cwd), "utf8"));
  assert.equal(policy.name, "cautious");

  const settings = JSON.parse(
    fs.readFileSync(path.join(cwd, ".claude", "settings.json"), "utf8")
  );
  const commands = settings.hooks.PreToolUse.flatMap((g) => g.hooks.map((h) => h.command));
  assert.ok(commands.includes("npx -y guardrail-cc hook pre-tool-use"));
});

test("init: defaults to the balanced profile when none is given", () => {
  const cwd = tmpProject();
  init(cwd, undefined);
  const policy = JSON.parse(fs.readFileSync(policyPath(cwd), "utf8"));
  assert.equal(policy.name, "balanced");
});

test("init: does not overwrite an existing policy unless forced", () => {
  const cwd = tmpProject();
  init(cwd, "cautious");
  init(cwd, "aggressive"); // no --force: should be a no-op on the policy file

  const policy = JSON.parse(fs.readFileSync(policyPath(cwd), "utf8"));
  assert.equal(policy.name, "cautious");

  init(cwd, "aggressive", true); // now force it
  const updated = JSON.parse(fs.readFileSync(policyPath(cwd), "utf8"));
  assert.equal(updated.name, "aggressive");
});

test("init: running twice does not duplicate the PreToolUse hook entry", () => {
  const cwd = tmpProject();
  init(cwd, "balanced");
  init(cwd, "balanced");

  const settings = JSON.parse(
    fs.readFileSync(path.join(cwd, ".claude", "settings.json"), "utf8")
  );
  const matching = settings.hooks.PreToolUse.filter((g) =>
    (g.hooks || []).some((h) => h.command === "npx -y guardrail-cc hook pre-tool-use")
  );
  assert.equal(matching.length, 1);
});
