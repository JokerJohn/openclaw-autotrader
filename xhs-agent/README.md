# XHS Agent

`xhs-agent` sits after the existing public GitHub pipeline.

It is now organized as a two-layer system:

1. a standard agent layer that plans tasks, manages memory/state, and writes task receipts
2. a platform executor layer that actually talks to XiaoHongShu through browser automation

The standard agent does four things:

1. reads only sanitized public snapshots
2. converts them into XiaoHongShu-friendly daily post packages
3. attaches a rolling narrative template so the 90-day series feels continuous
4. hands the final package to the platform executor when a stable logged-in creator session exists

Strict operating rules live in `docs/xhs-agent-rules.md`.

- default model profile: Volcano Engine `kimi2.5`
- strict title/body/cover constraints
- Feishu notification required for real publish and real edit
- legacy posts must be edited when they drift from the latest rule set

## Reality Check

As of 2026-03-12, the public XiaoHongShu open-platform docs I checked are still centered on merchant APIs rather than ordinary note publishing APIs. That means this agent should be designed around browser automation, not an official posting API.

- official platform home: [https://school.xiaohongshu.com/open/home](https://school.xiaohongshu.com/open/home)
- official API docs: [https://apidoc.xiaohongshu.com/doc-410847](https://apidoc.xiaohongshu.com/doc-410847)

Because of that, `publish` mode is operationally possible but not guaranteed:

- login expiry can break the run
- captcha or secondary verification can stop the flow
- selector drift can break the editor automation
- platform risk controls can change without notice

The honest production path is:

1. `generate-package`
2. `publish-job --mode=draft`
3. move to `publish` only after the selectors and profile are stable

## Module Design

| Module | Responsibility | Input | Output |
| --- | --- | --- | --- |
| `source-gate` | read only public, already-desensitized data | GitHub/public snapshot JSON | normalized snapshot |
| `privacy-guard` | enforce allowlist fields, rounding, disclaimers, banned-item scan | normalized snapshot | compliant snapshot |
| `narrative-planner` | pick the day theme and story angle for the 90-day series | compliant snapshot + day template | post plan |
| `copy-builder` | create title, body, hooks, hashtags, CTA | post plan | post package |
| `asset-orchestrator` | attach image manifest for cover/card assets | post package + asset hints | enriched post package |
| `publish-orchestrator` | open creator page, upload assets, fill content, publish or draft | config + post package | publish receipt |
| `visibility-review` | generate post-publish external visibility checklist | publish receipt + package | review artifact + receipt checklist |
| `run-ledger` | prevent duplicate posting and store evidence | publish receipt | state files + screenshots |

## Standard Agent Layer

The standard agent entrypoint is `src/run-agent.mjs`.

Supported tasks:

- `daily_publish`: build snapshot, sync feedback, compose package, validate, then execute publish/draft
- `rewrite_legacy`: edit old notes or publish missing notes from a maintenance plan
- `compose_package`: build and validate a publish-ready package without touching XiaoHongShu
- `sync_feedback`: refresh note analytics and update short-term / long-term memory

Legacy scripts such as `run-daily-job.mjs` and `run-series-maintenance.mjs` are now compatibility wrappers around `run-agent.mjs`.

## Platform Executor Layer

The default executor is `xhs-web`, configured in `config/example.config.json`.

- executor type: browser automation on the XiaoHongShu creator site
- executor capabilities: publish note, edit note, sync analytics
- executor modules: `src/executors/xhs-web/publish-note.mjs`, `src/executors/xhs-web/edit-note.mjs`, `src/executors/xhs-web/sync-analytics.mjs`
- CLI wrappers remain available: `run-publish-job.mjs`, `edit-note-job.mjs`, `sync-xhs-analytics.mjs`

## Core Files

- `schemas/public-snapshot.schema.json`: upstream input contract
- `schemas/xhs-post-package.schema.json`: output contract consumed by the publisher
- `templates/30-day-series.json`: rolling daily narrative templates for the 90-day series
- `examples/public-snapshot.example.json`: example upstream payload
- `config/example.config.json`: browser/publisher config template
- `config/series-maintenance.plan.json`: legacy edit/create plan, including day 1 edit and day 2 publish
- `src/validate-post-package.mjs`: content guardrail and auto-fix step
- `src/run-agent.mjs`: standard agent entrypoint
- `src/agent/run-task.mjs`: task planner/orchestrator for the standard agent layer
- `src/executors/xhs-web-executor.mjs`: XiaoHongShu platform executor adapter
- `src/executors/xhs-web/shared/browser-utils.mjs`: shared browser interaction helpers for publish/edit flows
- `src/executors/xhs-web/flows/shared/session.mjs`: shared Playwright session bootstrap for publish/edit flows
- `src/executors/xhs-web/flows/shared/flow-state.mjs`: shared flow-state receipt writer
- `src/executors/xhs-web/flows/publish-flow.mjs`: publish state machine flow
- `src/executors/xhs-web/flows/edit-flow.mjs`: edit state machine flow
- `src/executors/xhs-web/flows/publish/*.mjs`: smaller publish flow phases for editor open, content fill, and submit verification
- `src/executors/xhs-web/flows/edit/*.mjs`: smaller edit flow phases for editor open, asset prep, content fill, and submit verification
- `src/executors/xhs-web/publish-note.mjs`: importable publish executor module
- `src/executors/xhs-web/edit-note.mjs`: importable edit executor module
- `src/executors/xhs-web/sync-analytics.mjs`: importable analytics executor module
- `src/run-daily-job.mjs`: unattended daily pipeline runner
- `src/generate-post-package.mjs`: builds a post package from a public snapshot
- `src/run-publish-job.mjs`: Playwright publishing runner
- `src/edit-note-job.mjs`: Playwright editor runner for existing notes
- `src/notify-feishu.mjs`: Feishu group notification sender
- `src/post-publish-review.mjs`: build a structured post-publish visibility review checklist
- `src/run-series-maintenance.mjs`: batch runner for backfills, edits, and missing posts
- `src/install-launchd-job.mjs`: installs a local macOS daily scheduler
- `docs/unattended-publishing.md`: what is required before `publish` mode is realistic
- `docs/daily-automation.md`: unattended runner, logs, archive, and launchd setup

## Input/Output Contracts

### Upstream Input

`public-snapshot` is the only allowed feed into this agent. It is expected to come from the already sanitized GitHub/public layer, not directly from Tiger Pocket or private research traces.

Required sections:

- challenge metadata
- performance snapshot
- holdings summary
- session summary
- lessons learned
- source references
- asset hints

### Downstream Output

`xhs-post-package` is the single artifact handed to the publisher. It contains:

- the selected day template
- final title/body/hashtags
- asset manifest
- publish target window
- audit metadata

## Commands

Build a `public-snapshot` directly from the current GitHub/public repo outputs:

```bash
npm run build-snapshot -- .. ./examples/live.public-snapshot.json
```

Generate a post package:

```bash
npm run generate-package -- ./examples/public-snapshot.example.json ./examples/day-02.post-package.example.json
```

Validate and auto-fix a post package before publishing:

```bash
npm run validate-package -- ./config/example.config.json ./examples/live.post-package.json ./examples/live.post-package.validated.json ./examples/live.validation-report.json
```

Publish or draft a package:

```bash
npm run publish-job -- ./config/example.config.json ./examples/day-02.post-package.example.json --mode=draft
```

Rebuild a post-publish visibility checklist from an existing receipt:

```bash
npm run post-publish-review -- ./config/example.config.json ./examples/day-02.post-package.example.json ./receipts/day-02-publish.json
```

Open a dedicated XiaoHongShu creator session for manual login:

```bash
npm run open-login -- ./config/example.config.json
```

By default the agent now tries to attach to an already-running Chrome via `http://127.0.0.1:9222` first. If that CDP endpoint is unavailable, it falls back to launching its dedicated profile from `xhs.userDataDir`.

After login succeeds, calibrate selectors and write them back into the config:

```bash
npm run calibrate-config -- ./config/example.config.json
```

Run the whole unattended chain once:

```bash
npm run run-daily -- ./config/example.config.json --mode=draft
```

Run the standard agent directly:

```bash
npm run run-agent -- ./config/example.config.json --task=daily_publish --mode=draft
```

Run the legacy maintenance plan once:

```bash
npm run run-maintenance -- ./config/example.config.json --dry-run
```

Install a local macOS `launchd` scheduler:

```bash
npm run install-launchd -- ./config/example.config.json --mode=draft
```

## Recommended Operating Model

Use a dedicated creator profile and a dedicated browser profile for this agent.

- first 7 days: `draft`
- after selectors and login state are stable: `publish`
- if a run sees login, captcha, or editor mismatch: stop and keep the receipt as failed evidence
- use `run-daily` for unattended execution so validation, duplicate protection, and failure archiving all stay in the loop
- after every real publish: complete the generated post-publish visibility review checklist before treating the note as safely online

## What This Does Not Solve

This folder gives you a workable agent skeleton, not a guaranteed growth engine.

- it can automate the content pipeline
- it can keep the 90-day series consistent
- it cannot guarantee high heat or trending traffic
- it cannot guarantee uninterrupted unattended posting on a platform without a public ordinary-note publish API
