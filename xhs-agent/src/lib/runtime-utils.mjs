import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

export async function readJsonIfExists(filePath, fallback = null) {
  if (!(await fileExists(filePath))) {
    return fallback;
  }

  return readJson(filePath);
}

export async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

export async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

export async function ensureDirs(...dirs) {
  await Promise.all(dirs.map((dir) => ensureDir(dir)));
}

export function resolveConfigPath(configPath, value, fallback) {
  return path.resolve(path.dirname(configPath), value ?? fallback);
}

export function timestampSlug() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

export async function runNodeScript(scriptPath, args, cwd) {
  const { stdout, stderr } = await execFileAsync(process.execPath, [scriptPath, ...args], {
    cwd,
    maxBuffer: 1024 * 1024 * 10
  });

  return {
    script: scriptPath,
    args,
    stdout: stdout.trim(),
    stderr: stderr.trim()
  };
}

export async function copyIfExists(source, targetDir) {
  if (!source || !(await fileExists(source))) {
    return null;
  }

  await ensureDir(targetDir);
  const destination = path.join(targetDir, path.basename(source));
  await fs.copyFile(source, destination);
  return destination;
}

export async function archiveFailure({
  archiveRoot,
  runRecord,
  error,
  snapshotPath,
  analyticsPath,
  strategyPath,
  rawPackagePath,
  validatedPackagePath,
  validationReportPath,
  receiptPath
}) {
  const failureDir = path.join(archiveRoot, "failures", timestampSlug());
  await ensureDir(failureDir);

  const manifest = {
    failed_at: new Date().toISOString(),
    error: error.message,
    step: runRecord.current_step ?? runRecord.currentStep ?? null,
    runRecord
  };

  manifest.snapshot = await copyIfExists(snapshotPath, failureDir);
  manifest.analytics = await copyIfExists(analyticsPath, failureDir);
  manifest.feedback_strategy = await copyIfExists(strategyPath, failureDir);
  manifest.raw_package = await copyIfExists(rawPackagePath, failureDir);
  manifest.validated_package = await copyIfExists(validatedPackagePath, failureDir);
  manifest.validation_report = await copyIfExists(validationReportPath, failureDir);
  manifest.receipt = await copyIfExists(receiptPath, failureDir);

  if (receiptPath && (await fileExists(receiptPath))) {
    const receipt = await readJson(receiptPath);
    manifest.prefill_screenshot = await copyIfExists(receipt.prefill_screenshot, failureDir);
    manifest.final_screenshot = await copyIfExists(receipt.final_screenshot, failureDir);
    manifest.error_screenshot = await copyIfExists(receipt.error_screenshot, failureDir);
  }

  const manifestPath = path.join(failureDir, "manifest.json");
  await writeJson(manifestPath, manifest);
  return manifestPath;
}
