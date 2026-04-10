import path from "node:path";
import { pathToFileURL } from "node:url";
import { runAgentTask } from "./agent/run-task.mjs";

function usage() {
  console.error(
    "Usage: node ./src/run-agent.mjs <config.json> --task=daily_publish|rewrite_legacy|compose_package|sync_feedback|delete_notes [--mode=draft|publish|dry-run] [--date=YYYY-MM-DD] [--force] [--force-persona-refresh] [--wait-for-persona-refresh] [--wait-for-completion] [--dry-run] [--plan=plan.json] [--snapshot=file.json] [--skip-analytics] [--note-ids=id1,id2,id3]"
  );
  process.exit(1);
}

function parseArgs(argv) {
  const positionals = [];
  const options = {
    force: false,
    dryRun: false,
    skipAnalytics: false,
    forcePersonaRefresh: false,
    waitForPersonaRefresh: false,
    waitForCompletion: false
  };
  let taskType = null;

  for (const arg of argv) {
    if (arg.startsWith("--task=")) {
      taskType = arg.slice("--task=".length);
      continue;
    }

    if (arg.startsWith("--mode=")) {
      options.mode = arg.slice("--mode=".length);
      continue;
    }

    if (arg.startsWith("--date=")) {
      options.date = arg.slice("--date=".length);
      continue;
    }

    if (arg.startsWith("--plan=")) {
      options.planPath = path.resolve(process.cwd(), arg.slice("--plan=".length));
      continue;
    }

    if (arg.startsWith("--snapshot=")) {
      options.snapshotPath = path.resolve(process.cwd(), arg.slice("--snapshot=".length));
      continue;
    }

    if (arg.startsWith("--note-ids=")) {
      options.noteIds = arg.slice("--note-ids=".length).split(",").map(id => id.trim()).filter(id => id.length > 0);
      continue;
    }

    if (arg === "--force") {
      options.force = true;
      continue;
    }

    if (arg === "--force-persona-refresh") {
      options.forcePersonaRefresh = true;
      continue;
    }

    if (arg === "--wait-for-persona-refresh") {
      options.waitForPersonaRefresh = true;
      continue;
    }

    if (arg === "--wait-for-completion") {
      options.waitForCompletion = true;
      continue;
    }

    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (arg === "--skip-analytics") {
      options.skipAnalytics = true;
      continue;
    }

    positionals.push(arg);
  }

  if (positionals.length < 1 || !taskType) {
    usage();
  }

  return {
    configPath: path.resolve(process.cwd(), positionals[0]),
    taskType,
    options
  };
}

async function main() {
  const { configPath, taskType, options } = parseArgs(process.argv.slice(2));
  const normalizedOptions = {
    ...options,
    mode:
      options.mode ??
      (taskType === "rewrite_legacy" && options.dryRun ? "dry-run" : undefined) ??
      (taskType === "daily_publish" ? "publish" : undefined)
  };
  const result = await runAgentTask({
    configPath,
    taskType,
    options: normalizedOptions
  });
  console.log(
    JSON.stringify(
      {
        task_type: taskType,
        status: result.record.status,
        task_log: result.taskLogPath
      },
      null,
      2
    )
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
