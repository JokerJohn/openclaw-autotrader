---
name: xhs-note-visibility-guard
description: Use when XiaoHongShu notes appear published in note manager but cannot be opened by direct link or seen by other accounts, or when xhs-agent content must be rewritten to avoid finance/trading visibility risk.
---

# XHS Note Visibility Guard

Use this skill when an OpenClaw series note is visible in creator backend but externally inaccessible, or when drafting/revising XiaoHongShu content after a visibility restriction incident. It also applies when the user wants the copy pushed closer to the account's old direct writing style.

## Trigger

- Note manager shows a note as published, but:
  - direct share link returns 404 or "页面不见了"
  - another logged-in account cannot see it on the profile
  - reads stall at a very low number and stop moving
- The draft contains finance or trading framing such as:
  - `美股`
  - `量化交易`
  - `自动交易`
  - `交易复盘`
  - `盈亏`
  - `持仓`
  - `成交`
  - `收益`
  - stock tickers, buy/sell/hold actions, prices, quantities

## Required framing

- Keep `养龙虾` + `Day` + `OpenClaw`.
- Prefer direct `stock / current / PnL / fill / skip` wording over vague phrases like `公开实验 / 实验记录 / 系统日志`.
- Titles should reflect that day's result directly, using words such as `小盈`、`小亏`、`大亏`、`持平` instead of flat labels such as `起步` or `继续等`.
- Keep the GitHub-poster visual language and preserve `本金 5000 HKD`、`current`、`PnL` on the cover.
- Avoid direct Chinese high-risk phrases such as `美股全自动`、`自动量化交易`、`交易复盘`、`日盈亏`、`当前持仓`.

## Required structure

- `1️⃣ 今天结果`
- `2️⃣ 今天怎么做`
- `3️⃣ stock log`
- `4️⃣ Agent 学到什么`

## Tag rules

- `#slam`
- `#机器人`
- `#养龙虾`
- `#小龙虾`
- `#OpenClaw`
- `#AIAgent`
- `#openclaw`
- `#养虾的正确打开方式`
- Render tags as `#tag[话题]#` and append one ASCII space after every tag.
- Keep the trailing ASCII space after the last tag too; the last tag must not touch the line ending.
- Do not put emoji or other special symbols inside fixed tags; specifically, do not use `🦞`.
- The target output is that every tag can be clicked as an active topic after publish.
- After every real publish, reuse the logged-in browser session to open the final note page and click each expected tag one by one.
- After every real publish, reuse the logged-in browser session to open the final note page and click the collection entry too, verifying it resolves to the target collection page.
- If the environment hits an XHS restriction page such as IP risk, login error, or note unavailable, record the tag review as `manual_required` and require a rerun on a reliable network instead of marking it as passed.
- Apply the same fallback to the collection-page review; front-end collection verification cannot be inferred only from the edit page state.

## Operational flow

1. Confirm the note is externally inaccessible.
2. Treat it as a visibility-restricted note, not as a normal low-traffic note.
3. Do not keep editing the old note if platform visibility is already broken or edit limits are near exhaustion.
4. Regenerate the package with the user's direct voice, not abstract safe filler.
5. Run validation and dry-run.
6. Delete the old note.
7. Republish the new low-risk note.
8. Verify the new link and profile visibility from an external view.
9. If an edit receipt says success but the live editor preview still shows old title/body/tags/collection, treat it as `update-not-effective` and rerun until the preview matches the target package.
10. For the 90-day OpenClaw series, treat the collection as mandatory default metadata. If the target collection is not selected, the run is not complete.

## Writing style

- Match the account's old voice: title is direct, body starts with the result, information density is high, and there is little meta explanation.
- First screen should show `PnL`、`current`、today's action count.
- Do not write like a product spec or an AI status report.
- Use short declarative lines such as “今天没硬动，机会不过线就直接 skip。” instead of generic lines such as “今天重点是保持系统稳定。”
- Do not append disclaimer-style endings such as “仅做公开记录，不构成任何建议。”
- Do not keep filler sections such as `明天盯什么` just to fill structure.

## Post-publish checklist

After every real publish, the agent must generate a structured visibility review checklist.

- Auto-pass checks:
  - creator publish signal exists
  - note manager card can be matched
  - note id and share link are captured
  - title/body/tags/collection remain free of finance-trading risk phrases
  - the editor preview or selected controls actually show the target title, tag line, and collection after edit/publish
- Auto or manual-fallback checks:
  - open the published note page in the same logged-in session
  - click every expected tag and confirm it resolves to a topic/search page
  - click the collection entry and confirm it resolves to the expected collection page
  - if XHS blocks the page because of network/IP/login restrictions, mark this item `manual_required`
- Manual-required checks:
  - a second logged-in account opens the share link
  - a second logged-in account sees the post on the profile
  - a second logged-in account sees the post in the collection
- Follow-up checks:
  - revisit read/engagement movement after the configured delay

Do not treat a post as fully safe immediately after publish success. Until the second-account checks pass, the status is only `pending_manual_review`.

## References

- Follow the hard rules in `/Users/xhubd/Documents/New project/openclaw-autotrader/xhs-agent/docs/xhs-agent-rules.md`.
- Keep memory aligned with `/Users/xhubd/Documents/New project/openclaw-autotrader/xhs-agent/state/xhs-feedback-strategy.json`.
