import path from "node:path";
import { spawn } from "node:child_process";

function usage() {
  console.error(
    "Usage: node ./src/run-series-maintenance.mjs <config.json> [plan.json] [--dry-run]"
  );
  process.exit(1);
}

function parseArgs(argv) {
  const positionals = [];
  let dryRun = false;

  for (const arg of argv) {
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }

    positionals.push(arg);
  }

  if (positionals.length < 1) {
    usage();
  }

  return {
    configPath: path.resolve(process.cwd(), positionals[0]),
    planPath: positionals[1] ? path.resolve(process.cwd(), positionals[1]) : null,
    dryRun
  };
}

function main() {
  const { configPath, planPath: cliPlanPath, dryRun } = parseArgs(process.argv.slice(2));
  const agentScript = path.resolve(path.dirname(configPath), "../src/run-agent.mjs");
  const args = [agentScript, configPath, "--task=rewrite_legacy"];

  if (cliPlanPath) {
    args.push(`--plan=${cliPlanPath}`);
  }

  if (dryRun) {
    args.push("--dry-run");
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
