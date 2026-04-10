import path from "node:path";
import { spawn } from "node:child_process";

function usage() {
  console.error(
    "Usage: node ./src/run-daily-job.mjs <config.json> [--mode=draft|publish] [--date=YYYY-MM-DD] [--force]"
  );
  process.exit(1);
}

function parseArgs(argv) {
  const positionals = [];
  let mode;
  let date;
  let force = false;

  for (const arg of argv) {
    if (arg.startsWith("--mode=")) {
      mode = arg.slice("--mode=".length);
      continue;
    }

    if (arg.startsWith("--date=")) {
      date = arg.slice("--date=".length);
      continue;
    }

    if (arg === "--force") {
      force = true;
      continue;
    }

    positionals.push(arg);
  }

  if (positionals.length < 1) {
    usage();
  }

  return {
    configPath: path.resolve(process.cwd(), positionals[0]),
    mode,
    date,
    force
  };
}

function main() {
  const { configPath, mode: cliMode, date, force } = parseArgs(process.argv.slice(2));
  const agentScript = path.resolve(path.dirname(configPath), "../src/run-agent.mjs");
  const args = [agentScript, configPath, "--task=daily_publish"];

  if (cliMode) {
    args.push(`--mode=${cliMode}`);
  }

  if (date) {
    args.push(`--date=${date}`);
  }

  if (force) {
    args.push("--force");
  }

  const child = spawn(process.execPath, args, {
    cwd: path.resolve(path.dirname(configPath), ".."),
    stdio: "inherit"
  });

  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });
}

main();
