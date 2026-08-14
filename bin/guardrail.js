#!/usr/bin/env node
"use strict";

const path = require("path");
const { init, listProfiles } = require("../src/init");
const { report } = require("../src/report");

const USAGE = `guardrail-cc — a safety and spend layer for Claude Code

Usage:
  guardrail init [profile] [--force]   Install a safety profile + wire up the PreToolUse hook
                                        Profiles: ${listProfiles().join(", ")} (default: balanced)
  guardrail report                     Show a summary of everything guardrail has allowed/asked/denied
  guardrail hook <event>               (internal) invoked by Claude Code itself via settings.json
  guardrail help                       Show this message
`;

async function main() {
  const [, , command, ...rest] = process.argv;
  const cwd = process.cwd();

  switch (command) {
    case "init": {
      const positional = rest.filter((a) => !a.startsWith("--"));
      const force = rest.includes("--force");
      init(cwd, positional[0], force);
      break;
    }
    case "report": {
      report(cwd);
      break;
    }
    case "hook": {
      const event = rest[0];
      if (event === "pre-tool-use") {
        require("../hooks/pre-tool-use");
      } else {
        // Unknown hook event wired in by mistake: fail open immediately.
        process.stdout.write(JSON.stringify({ continue: true }));
        process.exit(0);
      }
      break;
    }
    case "help":
    case undefined:
    case "--help":
    case "-h":
      console.log(USAGE);
      break;
    default:
      console.log(`Unknown command "${command}".\n`);
      console.log(USAGE);
      process.exit(1);
  }
}

main();
