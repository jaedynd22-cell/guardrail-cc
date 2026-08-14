# SPEC.md — why this, and what's next

This file is the decision record behind guardrail-cc: what research led here,
why this specific wedge over the alternatives, the known risks, and the
concrete build plan. Keep it updated as assumptions get tested against real
users — most of what's below is a hypothesis, not a fact yet.

## How we got here

Three questions were run before picking a business direction: is there real,
still-rising demand (not a fad already peaking)? What's the realistic failure
risk? And what's actually buildable by an AI-agent-heavy team with minimal
human sales/outbound labor? That process ranked a narrow-vertical AI-service
business as the safest long-term bet, but a micro-SaaS product as the fastest
path to a first paying customer with the least human involvement — self-serve
subscription vs. a service contract someone has to be talked into.

From there, two independent research passes — one mining real user
complaints (GitHub issues, Reddit, HN, forum threads), one mapping the
existing competitive landscape — converged on the same gap from two different
directions:

- **Pain-point research** found "permission fatigue" and the all-or-nothing
  nature of `--dangerously-skip-permissions` ("YOLO mode") as a recurring,
  independently-raised complaint, tied directly to a second recurring
  complaint: no built-in limits on runaway agent loops burning through a
  session or a budget.
- **Competitive-landscape research**, working from the opposite direction,
  flagged individual-developer sandboxing/permission tooling as one of the
  only categories *not* already commoditized (free OSS scripts), absorbed by
  Anthropic natively (context visualization, checkpointing), or owned by a
  funded incumbent aimed at enterprise scale (E2B, Daytona-class sandbox
  infra). Existing individual-facing solutions were explicitly described as
  "scrappy gists and wrappers" — real pain, no polished product.

Two independent research passes landing on the same specific gap is the
reason this got built instead of one of the other four pain points that
turned up (session handoff/team memory, cost dashboards, context-exhaustion
warnings, agent observability) — those are documented in the research but
are secondary/roadmap candidates, not abandoned. Cost dashboards specifically
were ruled out for v1: the individual-usage-dashboard niche is already
commoditized by `ccusage` and its clones.

## Why not the others (for now)

- **Team session handoff / shared memory** — the single most-validated pain
  point by volume of independent GitHub feature requests, but it requires a
  team as the buyer, which reintroduces the higher-touch sales cycle this
  whole direction was chosen to avoid. Good phase-2 expansion once there's
  revenue and credibility from this product.
- **Cost/usage dashboards** — commoditized at the individual level; the
  unmet part (team spend governance) already has paid incumbents (Torii-class
  tools).
- **Context-exhaustion warnings** — real, Anthropic-declined pain, but weak
  monetization (a $5 utility, not a subscription).
- **Skill/prompt testing & versioning** — genuine gap, but Anthropic shipped
  its own skill-evaluation guidance the same month this research ran —
  meaning fast vendor encroachment risk.

## Known risks

- **Vendor encroachment.** Anthropic could ship native fine-grained
  permission profiles at any time — this happened already to context
  visualization and checkpointing. Mitigation: don't compete on the raw
  hook mechanism (that's the part Anthropic could absorb); the durable value
  is the audit trail, the circuit breaker, and — on the roadmap — cross-tool
  support and team sync, none of which a single-vendor CLI has an incentive
  to build.
- **Unvalidated demand at the individual level.** The research evidence for
  this exact wedge (as opposed to the adjacent, better-evidenced enterprise
  sandboxing space) is directional — scattered forum complaints and the
  absence of a polished competitor — not a confirmed number of people who'd
  pay. Treat the current build as the tool to go find that answer with, not
  as proof the answer is yes.
- **Regex-based policy matching is a blunt instrument.** Good enough for a
  v1 that ships fast; a determined user can construct a command that evades
  a naive pattern. This is a safety *aid*, not a sandbox — the README and
  any marketing copy should never claim it's a hard security boundary.

## What's built (v0)

A working local CLI: three default policies (cautious/balanced/aggressive),
a `PreToolUse` hook that evaluates every tool call against the active policy,
a session-scoped circuit breaker, a local JSONL audit log, and a `report`
command. Verified end-to-end against simulated Claude Code hook events,
including a real circuit-breaker trip after exceeding the configured
threshold.

## Next steps

**Before writing more code:** get this in front of 10-20 real Claude Code
users (Reddit r/ClaudeAI / r/ClaudeCode, the Claude Developers Discord, HN
Show HN) and ask one question — would you install this, and what's missing
before you'd trust it. Cheapest possible validation is publishing the open
CLI for free and watching whether anyone installs and stars it before
building the paid tier at all.

**Days 1-30 (if validated):** publish to npm, Show HN + relevant subreddit
post under a real name (not a bot account — anonymous posts get suppressed
in these communities), collect install/star numbers and direct feedback,
iterate the default policies based on real false-positive/false-negative
reports.

**Days 31-60:** if there's real pull, build the smallest possible paid layer
— cloud sync of the audit log across a team plus a Slack alert on circuit
breaker trips — since that was the one thing structurally impossible to
give away for free (it requires a server). Price around $9-15/seat/month
individual, team tiers later.

**Day 90 checkpoint:** decide whether to double down here or fold this into
the broader vertical AI-automation-service direction as a credibility asset
("we built and shipped a real agent-safety tool") rather than as the
standalone business.
