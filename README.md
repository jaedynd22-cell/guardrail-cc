# guardrail-cc

[![CI](https://github.com/jaedynd22-cell/guardrail-cc/actions/workflows/ci.yml/badge.svg)](https://github.com/jaedynd22-cell/guardrail-cc/actions/workflows/ci.yml)

A safety and spend layer for Claude Code — and, on the roadmap, other agentic
coding tools. Right now, autonomous coding agents give you two options: approve
every single action by hand, or flip on full autonomy (`--dangerously-skip-permissions`
/ "YOLO mode") and hope nothing goes wrong. guardrail-cc gives you a third option.

## What it does

- **Safety profiles.** Instead of an all-or-nothing switch, define what's
  auto-approved, what's blocked outright, and what still needs your sign-off —
  per command pattern, per tool. Ships with three presets (`cautious`,
  `balanced`, `aggressive`) you can use as-is or fork into your own policy.
- **A circuit breaker.** Even a fully-trusted session can spiral — a bad loop
  that keeps re-running the same failing command, or drifts into doing far
  more than you intended. guardrail-cc counts auto-approved actions per
  session and forces a human check-in once a threshold is crossed, so a
  runaway agent gets caught automatically instead of burning your session (or
  your API spend) unattended.
- **A local audit trail.** Every decision — allowed, asked, or denied — is
  logged with a timestamp and the reason it matched. Run `guardrail report`
  any time to see exactly what your agent did while you weren't watching, and
  whether the circuit breaker ever had to step in.

It's a plain Node CLI that wires itself into Claude Code's own `PreToolUse`
hook — no daemon, no cloud account required to use the core tool.

## Install & use

```bash
cd your-project
npx guardrail-cc init            # installs the "balanced" profile (default)
npx guardrail-cc init cautious   # or: cautious | balanced | aggressive
```

That's it — it drops a policy file at `.claude/guardrail/policy.json` and adds
a `PreToolUse` hook entry to `.claude/settings.json`. Use Claude Code exactly
as before. Whenever you want to see what happened:

```bash
npx guardrail-cc report
```

### Try it before the npm release

The `npx` command above will work once this is published to the npm registry.
Until then, you can run it straight from a clone:

```bash
git clone https://github.com/jaedynd22-cell/guardrail-cc.git
cd your-project
node /path/to/guardrail-cc/bin/guardrail.js init
node /path/to/guardrail-cc/bin/guardrail.js report
```

To wire it into a project's hook exactly the way the published package will,
edit `.claude/settings.json`'s `PreToolUse` command to point at your local
clone's `bin/guardrail.js` instead of `npx -y guardrail-cc hook pre-tool-use`
until the package is live.

## Writing your own policy

`.claude/guardrail/policy.json` is a plain, readable rules list evaluated top
to bottom — first match wins:

```json
{
  "name": "my-team-policy",
  "rules": [
    { "tool": "Bash", "match": "^git push.*--force", "decision": "ask", "reason": "Force push needs a human." },
    { "tool": "Edit", "decision": "allow", "reason": "Edits are fine." },
    { "tool": "*", "decision": "ask", "reason": "Default to asking." }
  ],
  "circuitBreaker": { "maxAutoApprovedActions": 60, "windowMinutes": 15, "onTrip": "ask" }
}
```

Check it into git so a team shares one policy instead of everyone hand-tuning
their own permission prompts.

## Why this exists

Every existing option here is either a rough, single-purpose gist someone
wrote for themselves (a hard yes/no wrapper around `--dangerously-skip-permissions`,
with no middle ground and no record of what happened), or heavyweight,
enterprise-priced sandbox infrastructure aimed at running agents at scale, not
at making one developer's daily solo session safer. Nothing sits in between:
a small, polished tool an individual developer installs in thirty seconds.
That gap is what this is.

## Roadmap (not built yet)

- Cross-tool support (Cursor, Aider, Copilot agent mode) so one policy covers
  every agent you run, not just Claude Code.
- A hosted tier: sync the audit log across a team, share one versioned policy,
  get a Slack alert the moment the circuit breaker trips on anyone's machine,
  and set per-project spend budgets that halt a session before it burns
  through the month's API budget.
- Command-cost estimation, so the circuit breaker can trip on estimated token
  spend, not just action count.

See `SPEC.md` for the full reasoning behind this build and the monetization
plan.

## Development

```bash
git clone https://github.com/jaedynd22-cell/guardrail-cc.git
cd guardrail-cc
npm test
```

The test suite covers the policy-matching engine (rule ordering, regex
matching, the circuit breaker's per-session counting) and `init` (profile
installation, hook wiring, idempotency). CI runs it on every push against
Node 18, 20, and 22.

## License

MIT for the CLI and default profiles. The hosted team tier described in the
roadmap will be a separate paid product built on top of this open core.
