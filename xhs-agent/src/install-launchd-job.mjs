import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function usage() {
  console.error(
    "Usage: node ./src/install-launchd-job.mjs <config.json> [--mode=draft|publish] [--hour=9] [--minute=30]"
  );
  process.exit(1);
}

function parseArgs(argv) {
  const positionals = [];
  let mode;
  let hour;
  let minute;

  for (const arg of argv) {
    if (arg.startsWith("--mode=")) {
      mode = arg.slice("--mode=".length);
      continue;
    }

    if (arg.startsWith("--hour=")) {
      hour = Number(arg.slice("--hour=".length));
      continue;
    }

    if (arg.startsWith("--minute=")) {
      minute = Number(arg.slice("--minute=".length));
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
    hour,
    minute
  };
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

function resolveConfigPath(configPath, value, fallback) {
  return path.resolve(path.dirname(configPath), value ?? fallback);
}

function plistEscape(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function runLaunchctl(args) {
  try {
    await execFileAsync("/bin/launchctl", args, { maxBuffer: 1024 * 1024 * 5 });
  } catch (error) {
    if (args[0] === "unload") {
      return;
    }

    throw error;
  }
}

async function main() {
  const { configPath, mode: cliMode, hour: cliHour, minute: cliMinute } = parseArgs(process.argv.slice(2));
  const config = await readJson(configPath);
  const runner = config.runner ?? {};
  const schedule = runner.schedule ?? {};
  const mode = cliMode ?? runner.defaultMode ?? config.publishMode ?? "draft";
  const hour = Number.isInteger(cliHour) ? cliHour : schedule.hour ?? 9;
  const minute = Number.isInteger(cliMinute) ? cliMinute : schedule.minute ?? 30;
  const label = schedule.label ?? "com.openclaw.xhs-agent.daily";
  const agentRoot = path.resolve(path.dirname(configPath), "..");
  const logDir = resolveConfigPath(configPath, runner.logDir, "../artifacts/logs");
  await fs.mkdir(logDir, { recursive: true });

  const plistPath = path.join(os.homedir(), "Library", "LaunchAgents", `${label}.plist`);
  const stdoutPath = path.join(logDir, `${label}.stdout.log`);
  const stderrPath = path.join(logDir, `${label}.stderr.log`);
  const programArguments = [
    process.execPath,
    path.join(agentRoot, "src", "run-agent.mjs"),
    configPath,
    "--task=daily_publish",
    `--mode=${mode}`
  ];
  const webhookEnvName = config.notifications?.feishu?.webhookEnv ?? "FEISHU_XHS_AGENT_WEBHOOK_URL";
  const webhookEnvValue = process.env[webhookEnvName] ?? "";
  const envEntries = [
    ["PATH", process.env.PATH ?? "/usr/bin:/bin:/usr/sbin:/sbin"],
    [webhookEnvName, webhookEnvValue]
  ];

  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${plistEscape(label)}</string>
  <key>ProgramArguments</key>
  <array>
    ${programArguments.map((value) => `<string>${plistEscape(value)}</string>`).join("\n    ")}
  </array>
  <key>WorkingDirectory</key>
  <string>${plistEscape(agentRoot)}</string>
  <key>EnvironmentVariables</key>
  <dict>
    ${envEntries
      .map(
        ([key, value]) => `<key>${plistEscape(key)}</key>
    <string>${plistEscape(value)}</string>`
      )
      .join("\n    ")}
  </dict>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>${hour}</integer>
    <key>Minute</key>
    <integer>${minute}</integer>
  </dict>
  <key>RunAtLoad</key>
  <false/>
  <key>StandardOutPath</key>
  <string>${plistEscape(stdoutPath)}</string>
  <key>StandardErrorPath</key>
  <string>${plistEscape(stderrPath)}</string>
</dict>
</plist>
`;

  await fs.mkdir(path.dirname(plistPath), { recursive: true });
  await fs.writeFile(plistPath, plist, "utf8");
  await runLaunchctl(["unload", plistPath]);
  await runLaunchctl(["load", plistPath]);

  console.log(`Installed ${plistPath}`);
  console.log(`Schedule: daily at ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
  console.log(`Mode: ${mode}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
