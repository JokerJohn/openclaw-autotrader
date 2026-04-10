# Daily Automation

`run-agent.mjs` is the standard unattended entrypoint.

`run-daily-job.mjs` remains as a compatibility wrapper that forwards to:

```bash
node ./src/run-agent.mjs <config.json> --task=daily_publish
```

It runs:

1. `build-public-snapshot`
2. `sync-xhs-analytics`
3. `update-xhs-feedback-strategy`
4. `generate-post-package`
5. `validate-post-package`
6. `run-publish-job`

For real `publish`, step 6 now also auto-generates a post-publish visibility review checklist, attempts a same-session tag-click review on the final note page, and stores the result in the receipt/artifacts.

## What It Adds

- date-based output folders under `out/`
- task receipts under `state/agent-tasks/`
- agent task logs under `artifacts/agent-runs/`
- content validation and automatic title/body cleanup
- duplicate protection through `state/publish-ledger.json`
- failure archive manifests under `artifacts/archive/failures/`
- per-run logs under `artifacts/logs/`

## Output Layout

- `out/snapshots/YYYY/YYYY-MM-DD.public-snapshot.json`
- `out/analytics/YYYY/YYYY-MM-DD.note-analytics.json`
- `out/analytics/YYYY/YYYY-MM-DD.feedback-strategy.json`
- `out/packages/YYYY/YYYY-MM-DD.post-package.raw.json`
- `out/packages/YYYY/YYYY-MM-DD.post-package.json`
- `out/validation/YYYY/YYYY-MM-DD.validation-report.json`
- `state/agent-tasks/daily_publish.latest.json`
- `artifacts/agent-runs/daily_publish/YYYY-MM-DD-publish.json`
- `artifacts/logs/YYYY-MM-DD-draft.json`
- `artifacts/<package-id>-post-publish-review.json`

## Duplicate Protection

The publish layer stores a success record keyed by:

`<series-id>:day-<day>:<mode>`

That means one successful `draft` and one successful `publish` are allowed per challenge day unless `--force` is used.

## Post-Publish Visibility Review

Every real publish must create a review checklist with three classes of checks:

- auto checks: publish success signal, note manager match, note id capture, low-risk wording guard
- auto tag review: open the published note page in the same logged-in session and click each expected tag
- auto collection review: open the published note page and click the collection entry to verify it resolves to the expected collection page
- manual checks: second account opens the share link, sees the note on the profile, and sees it in the collection
- follow-up checks: review read/engagement movement after the configured delay

The checklist is written into the publish receipt under `post_publish_review` and also saved as a standalone artifact so it can be forwarded or rechecked later.

If the tag review or the collection-page review is blocked by XHS restriction pages such as IP risk or login error, that item is marked `manual_required` and must be rerun on a reliable network. If the checklist still contains manual items, the post is only `pending_manual_review`, not “fully safe”.

## Failure Archive

When any step fails, the runner copies the available context into a timestamped folder:

- snapshot
- raw package
- validated package
- validation report
- receipt
- screenshots referenced by the receipt
- a `manifest.json` explaining which step failed

## Launchd

`install-launchd-job.mjs` writes a LaunchAgent plist to:

- `~/Library/LaunchAgents/com.openclaw.xhs-agent.daily.plist`

By default it schedules the runner using the values in `config/example.config.json`:

- hour: `09`
- minute: `30`
- mode: `draft`

Change those values in config or override them on install:

```bash
npm run install-launchd -- ./config/example.config.json --mode=publish --hour=10 --minute=15
```
