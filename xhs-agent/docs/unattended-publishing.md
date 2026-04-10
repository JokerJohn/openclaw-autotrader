# Unattended Publishing

`publish` mode is only credible when all four layers below are already stable.

## Layer 1: Input Stability

- the upstream public snapshot must be generated on time every day
- asset paths must exist before the publishing job starts
- the same source file cannot be rewritten mid-run

## Layer 2: Account Stability

- use a dedicated XiaoHongShu creator account
- keep a dedicated Chrome profile for this agent only
- finish manual login, phone verification, and any creator onboarding in that profile before automation starts

## Layer 3: Automation Stability

- selector candidates in `config/example.config.json` must match the live editor
- the persistent profile must survive restarts
- image upload must complete before the publish button is clicked
- the account should already have some normal manual activity so a brand-new cold account is not the first thing the platform sees

## Layer 4: Failure Handling

`publish` mode should be treated as a state machine, not a blind click script.

- if the editor is missing: fail and save screenshot
- if login is required: fail and save screenshot
- if captcha appears: fail and save screenshot
- if assets are missing: fail before opening the browser
- if the same package was already published: skip unless forced

## Recommended Rollout

1. generate package only for 3 to 5 days
2. switch to `draft` mode for 7 to 10 consecutive successful runs
3. switch to `publish` mode only after selector drift and login expiry are understood

## Scheduling

Keep scheduling outside the agent.

- local `launchd`
- a dedicated CI runner with remote desktop access
- a long-running workstation process

The agent in this folder assumes the scheduler passes it a ready package and a ready config.
