import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import {
  archiveFailure,
  ensureDirs,
  readJson,
  resolveConfigPath,
  runNodeScript,
  timestampSlug,
  writeJson
} from "../lib/runtime-utils.mjs";
import { createXhsWebExecutor } from "../executors/xhs-web-executor.mjs";

function buildContext(configPath, config) {
  const agentRoot = path.resolve(path.dirname(configPath), "..");
  const runner = config.runner ?? {};
  const outDir = resolveConfigPath(configPath, runner.outDir, "../out");
  const archiveDir = resolveConfigPath(configPath, runner.archiveDir, "../artifacts/archive");
  const legacyLogDir = resolveConfigPath(configPath, runner.logDir, "../artifacts/logs");
  const stateDir = resolveConfigPath(configPath, config.paths?.stateDir, "../state");
  const analyticsStatePath = resolveConfigPath(
    configPath,
    config.analytics?.latestAnalyticsPath,
    "../state/xhs-note-analytics.latest.json"
  );
  const strategyStatePath = resolveConfigPath(
    configPath,
    config.analytics?.strategyStatePath,
    "../state/xhs-feedback-strategy.json"
  );
  const taskStateDir = resolveConfigPath(configPath, config.standardAgent?.taskStateDir, "../state/agent-tasks");
  const taskLogDir = resolveConfigPath(configPath, config.standardAgent?.taskLogDir, "../artifacts/agent-runs");
  const repoRoot = resolveConfigPath(configPath, runner.repoRoot, "..");

  return {
    configPath,
    config,
    agentRoot,
    repoRoot,
    outDir,
    archiveDir,
    legacyLogDir,
    stateDir,
    analyticsStatePath,
    strategyStatePath,
    taskStateDir,
    taskLogDir,
    executor: createXhsWebExecutor({ agentRoot, config })
  };
}

async function ensureContextDirs(context) {
  await ensureDirs(
    context.outDir,
    context.archiveDir,
    context.legacyLogDir,
    context.stateDir,
    context.taskStateDir,
    context.taskLogDir,
    path.dirname(context.analyticsStatePath),
    path.dirname(context.strategyStatePath)
  );
}

function buildTaskRecord(taskType, context, options) {
  return {
    version: 1,
    task_id: `${taskType}-${timestampSlug()}`,
    task_type: taskType,
    agent: context.config.agent?.name ?? "xhs-agent",
    executor: {
      id: context.executor.id,
      type: context.config.platformExecutor?.type ?? "xhs-web"
    },
    config: context.configPath,
    options,
    started_at: new Date().toISOString(),
    status: "running",
    current_step: null,
    steps: [],
    warnings: []
  };
}

async function persistTaskRecord(context, record, taskType) {
  const latestPath = path.join(context.taskStateDir, `${taskType}.latest.json`);
  await writeJson(latestPath, record);
}

function buildRuntimePaths(context, targetDate = "runtime") {
  const targetYear = /^\d{4}-\d{2}-\d{2}$/.test(targetDate) ? targetDate.slice(0, 4) : "runtime";
  return {
    runtimeDir: path.join(context.outDir, "runtime"),
    snapshotPath: path.join(context.outDir, "snapshots", targetYear, `${targetDate}.public-snapshot.json`),
    analyticsPath: path.join(context.outDir, "analytics", targetYear, `${targetDate}.note-analytics.json`),
    strategyPath: path.join(context.outDir, "analytics", targetYear, `${targetDate}.feedback-strategy.json`),
    rawPackagePath: path.join(context.outDir, "packages", targetYear, `${targetDate}.post-package.raw.json`),
    validatedPackagePath: path.join(context.outDir, "packages", targetYear, `${targetDate}.post-package.json`),
    validationReportPath: path.join(context.outDir, "validation", targetYear, `${targetDate}.validation-report.json`)
  };
}

async function prepareRuntimeDirs(paths) {
  await ensureDirs(
    paths.runtimeDir,
    path.dirname(paths.snapshotPath),
    path.dirname(paths.analyticsPath),
    path.dirname(paths.rawPackagePath),
    path.dirname(paths.validationReportPath)
  );
}

function pushStep(record, stepName, payload) {
  record.current_step = stepName;
  record.steps.push({
    step: stepName,
    ...payload
  });
}

async function queueBackgroundPersonaRefresh(context, paths, options = {}) {
  const logPath = path.join(context.agentRoot, "logs", "persona-refresh.log");
  await ensureDirs(path.dirname(logPath), path.dirname(context.strategyStatePath), path.dirname(paths.strategyPath));
  const stdoutHandle = await fs.open(logPath, "a");
  const stderrHandle = await fs.open(logPath, "a");

  try {
    const args = [
      path.join(context.agentRoot, "src", "update-xhs-feedback-strategy.mjs"),
      context.configPath,
      paths.snapshotPath,
      paths.analyticsPath,
      context.strategyStatePath,
      `--previous-strategy=${context.strategyStatePath}`,
      "--persona-mode=sync",
      `--mirror-output=${paths.strategyPath}`
    ];

    if (options.forcePersonaRefresh) {
      args.push("--force-persona-refresh");
    }

    const child = spawn(process.execPath, args, {
      cwd: context.agentRoot,
      detached: true,
      stdio: ["ignore", stdoutHandle.fd, stderrHandle.fd]
    });
    child.unref();

    return {
      pid: child.pid,
      log: logPath,
      output: context.strategyStatePath,
      mirror_output: paths.strategyPath
    };
  } finally {
    await stdoutHandle.close();
    await stderrHandle.close();
  }
}

async function queueBackgroundSyncFeedback(context, options = {}) {
  const logPath = path.join(context.agentRoot, "logs", "feedback-sync.log");
  await ensureDirs(path.dirname(logPath), context.taskStateDir, context.taskLogDir);
  const stdoutHandle = await fs.open(logPath, "a");
  const stderrHandle = await fs.open(logPath, "a");

  try {
    const args = [
      path.join(context.agentRoot, "src", "run-agent.mjs"),
      context.configPath,
      "--task=sync_feedback",
      "--wait-for-completion",
      "--wait-for-persona-refresh"
    ];

    if (options.date) {
      args.push(`--date=${options.date}`);
    }

    if (options.snapshotPath) {
      args.push(`--snapshot=${options.snapshotPath}`);
    }

    if (options.skipAnalytics || options.forcePersonaRefresh) {
      args.push("--skip-analytics");
    }

    if (options.forcePersonaRefresh) {
      args.push("--force-persona-refresh");
    }

    const child = spawn(process.execPath, args, {
      cwd: context.agentRoot,
      detached: true,
      stdio: ["ignore", stdoutHandle.fd, stderrHandle.fd]
    });
    child.unref();

    return {
      pid: child.pid,
      log: logPath,
      state: path.join(context.taskStateDir, "sync_feedback.latest.json")
    };
  } finally {
    await stdoutHandle.close();
    await stderrHandle.close();
  }
}

async function buildSnapshot(context, record, snapshotTempPath, targetDate) {
  const args = [path.join(context.agentRoot, "src", "build-public-snapshot.mjs"), context.repoRoot, snapshotTempPath];
  if (targetDate) {
    args.push(`--date=${targetDate}`);
  }

  const result = await runNodeScript(args[0], args.slice(1), context.agentRoot);
  pushStep(record, "build-snapshot", result);
  return readJson(snapshotTempPath);
}

async function generateAndValidate(context, record, snapshotPath, rawPackagePath, validatedPackagePath, validationReportPath) {
  const generateResult = await runNodeScript(
    path.join(context.agentRoot, "src", "generate-post-package.mjs"),
    [snapshotPath, rawPackagePath],
    context.agentRoot
  );
  pushStep(record, "generate-package", generateResult);

  const validateResult = await runNodeScript(
    path.join(context.agentRoot, "src", "validate-post-package.mjs"),
    [context.configPath, rawPackagePath, validatedPackagePath, validationReportPath],
    context.agentRoot
  );
  pushStep(record, "validate-package", validateResult);

  return readJson(validatedPackagePath);
}

async function materializePackageAssets(sourcePackagePath, targetPackagePath, postPackage) {
  const sourceDir = path.dirname(sourcePackagePath);
  const targetDir = path.dirname(targetPackagePath);

  for (const asset of postPackage.assets ?? []) {
    const sourceAbsolutePath = path.resolve(sourceDir, asset.path);
    const targetAbsolutePath = path.resolve(targetDir, asset.path);

    if (sourceAbsolutePath === targetAbsolutePath) {
      continue;
    }

    await ensureDirs(path.dirname(targetAbsolutePath));
    await fs.copyFile(sourceAbsolutePath, targetAbsolutePath);
  }
}

async function maybeSyncFeedback(context, record, snapshotPath, analyticsPath, strategyPath, options) {
  if (context.config.analytics?.enabled === false || options.skipAnalytics) {
    return;
  }

  try {
    const analyticsResult = await context.executor.syncAnalytics({
      configPath: context.configPath,
      outputPath: analyticsPath,
      pages: context.config.analytics?.maxPages ?? 3,
      detailLimit: context.config.analytics?.detailLimit ?? 8
    });
    pushStep(record, "sync-analytics", analyticsResult);
    await fs.copyFile(analyticsPath, context.analyticsStatePath);

    const feedbackResult = await runNodeScript(
      path.join(context.agentRoot, "src", "update-xhs-feedback-strategy.mjs"),
      [context.configPath, snapshotPath, analyticsPath, strategyPath],
      context.agentRoot
    );
    pushStep(record, "update-feedback-strategy", feedbackResult);
    await fs.copyFile(strategyPath, context.strategyStatePath);
  } catch (error) {
    record.warnings.push(`Analytics refresh skipped: ${error.message}`);
  }
}

async function writeTaskLogs(context, record, taskType, preferredName, legacyLogName = null) {
  const taskDir = path.join(context.taskLogDir, taskType);
  await ensureDirs(taskDir);
  const taskLogPath = path.join(taskDir, preferredName);
  await writeJson(taskLogPath, record);
  if (legacyLogName) {
    await writeJson(path.join(context.legacyLogDir, legacyLogName), record);
  }
  return taskLogPath;
}

async function runDailyPublishTask(context, options) {
  await ensureContextDirs(context);
  const record = buildTaskRecord("daily_publish", context, options);
  await persistTaskRecord(context, record, "daily_publish");

  const snapshotTempPath = path.join(context.outDir, "runtime", "latest.public-snapshot.json");
  const analyticsTempPath = path.join(context.outDir, "runtime", "latest.note-analytics.json");
  const strategyTempPath = path.join(context.outDir, "runtime", "latest.feedback-strategy.json");
  const rawPackageTempPath = path.join(context.outDir, "runtime", "latest.post-package.raw.json");
  const validatedPackageTempPath = path.join(context.outDir, "runtime", "latest.post-package.json");
  const validationReportTempPath = path.join(context.outDir, "runtime", "latest.validation-report.json");

  let targetDate = options.date ?? "runtime";
  let paths = buildRuntimePaths(context, targetDate);
  let receiptPath = null;

  try {
    await prepareRuntimeDirs(paths);
    const snapshot = await buildSnapshot(context, record, snapshotTempPath, options.date);
    targetDate = snapshot.snapshot_at.slice(0, 10);
    paths = buildRuntimePaths(context, targetDate);
    await prepareRuntimeDirs(paths);

    await fs.copyFile(snapshotTempPath, paths.snapshotPath);
    await maybeSyncFeedback(context, record, paths.snapshotPath, analyticsTempPath, strategyTempPath, options);

    if (path.resolve(analyticsTempPath) !== path.resolve(paths.analyticsPath)) {
      try {
        await fs.copyFile(analyticsTempPath, paths.analyticsPath);
      } catch {}
    }

    if (path.resolve(strategyTempPath) !== path.resolve(paths.strategyPath)) {
      try {
        await fs.copyFile(strategyTempPath, paths.strategyPath);
      } catch {}
    }

    const validatedPackage = await generateAndValidate(
      context,
      record,
      paths.snapshotPath,
      rawPackageTempPath,
      validatedPackageTempPath,
      validationReportTempPath
    );
    await fs.copyFile(rawPackageTempPath, paths.rawPackagePath);
    await fs.copyFile(validatedPackageTempPath, paths.validatedPackagePath);
    await fs.copyFile(validationReportTempPath, paths.validationReportPath);
    await materializePackageAssets(validatedPackageTempPath, paths.validatedPackagePath, validatedPackage);

    receiptPath = path.join(
      resolveConfigPath(context.configPath, context.config.paths?.receiptDir, "../receipts"),
      `${validatedPackage.package_id}-${options.mode}.json`
    );

    const publishResult = await context.executor.publishPackage({
      configPath: context.configPath,
      packagePath: paths.validatedPackagePath,
      mode: options.mode,
      force: Boolean(options.force)
    });
    pushStep(record, "execute-publish", publishResult);

    record.outputs = {
      snapshot: paths.snapshotPath,
      analytics: paths.analyticsPath,
      feedback_strategy: paths.strategyPath,
      raw_package: paths.rawPackagePath,
      validated_package: paths.validatedPackagePath,
      validation_report: paths.validationReportPath,
      receipt: receiptPath
    };
    record.finished_at = new Date().toISOString();
    record.status = "success";
    await persistTaskRecord(context, record, "daily_publish");

    const taskLogPath = await writeTaskLogs(
      context,
      record,
      "daily_publish",
      `${targetDate}-${options.mode}.json`,
      `${targetDate}-${options.mode}.json`
    );

    return {
      record,
      taskLogPath
    };
  } catch (error) {
    record.finished_at = new Date().toISOString();
    record.status = "error";
    record.error = error.message;
    await persistTaskRecord(context, record, "daily_publish");

    const manifestPath = await archiveFailure({
      archiveRoot: context.archiveDir,
      runRecord: record,
      error,
      snapshotPath: paths.snapshotPath,
      analyticsPath: paths.analyticsPath,
      strategyPath: paths.strategyPath,
      rawPackagePath: paths.rawPackagePath,
      validatedPackagePath: paths.validatedPackagePath,
      validationReportPath: paths.validationReportPath,
      receiptPath
    });

    record.archive_manifest = manifestPath;
    const failedLogName = `failed-${timestampSlug()}.json`;
    const taskLogPath = await writeTaskLogs(context, record, "daily_publish", failedLogName, failedLogName);
    throw Object.assign(error, { taskLogPath, manifestPath });
  }
}

async function runRewriteLegacyTask(context, options) {
  await ensureContextDirs(context);
  const record = buildTaskRecord("rewrite_legacy", context, options);
  await persistTaskRecord(context, record, "rewrite_legacy");

  const planPath = options.planPath ?? resolveConfigPath(context.configPath, context.config.maintenance?.planPath);
  const plan = await readJson(planPath);
  record.plan = planPath;

  try {
    const logSlug = timestampSlug();
    for (const step of plan.steps ?? []) {
      const stepRuntimeDir = path.join(context.outDir, "runtime", "maintenance", step.id);
      await ensureDirs(stepRuntimeDir);

      const snapshotPath = path.join(stepRuntimeDir, `${step.id}.public-snapshot.json`);
      const rawPackagePath = path.join(stepRuntimeDir, `${step.id}.post-package.raw.json`);
      const validatedPackagePath = path.join(stepRuntimeDir, `${step.id}.post-package.json`);
      const validationReportPath = path.join(stepRuntimeDir, `${step.id}.validation-report.json`);

      const stepRecord = {
        id: step.id,
        action: step.action,
        note_id: step.note_id ?? null,
        snapshot: step.snapshot ?? step.date ?? null,
        commands: []
      };

      if (step.snapshot) {
        const sourceSnapshotPath = path.resolve(path.dirname(planPath), step.snapshot);
        await fs.copyFile(sourceSnapshotPath, snapshotPath);
        stepRecord.commands.push({
          step: "copy-snapshot",
          stdout: snapshotPath,
          stderr: ""
        });
      } else {
        const snapshot = await buildSnapshot(context, record, snapshotPath, step.date);
        stepRecord.commands.push(record.steps.at(-1));
        if (!snapshot.snapshot_at.startsWith(step.date)) {
          record.warnings.push(`Step ${step.id} built snapshot ${snapshot.snapshot_at} for requested ${step.date}.`);
        }
      }

      const validatedPackage = await generateAndValidate(
        context,
        record,
        snapshotPath,
        rawPackagePath,
        validatedPackagePath,
        validationReportPath
      );
      stepRecord.commands.push(record.steps.at(-2), record.steps.at(-1));

      if (step.action === "edit") {
        const editMode = options.dryRun ? "dry-run" : "edit";
        const editResult = await context.executor.editNote({
          configPath: context.configPath,
          packagePath: validatedPackagePath,
          noteId: step.note_id,
          mode: editMode,
          force: Boolean(options.force)
        });
        stepRecord.commands.push(editResult);
      } else if (step.action === "publish") {
        const publishMode = options.dryRun ? "dry-run" : "publish";
        const publishResult = await context.executor.publishPackage({
          configPath: context.configPath,
          packagePath: validatedPackagePath,
          mode: publishMode,
          force: Boolean(options.force)
        });
        stepRecord.commands.push(publishResult);
      } else {
        throw new Error(`Unsupported maintenance action: ${step.action}`);
      }

      stepRecord.package_id = validatedPackage.package_id;
      record.steps.push({
        step: "maintenance-step",
        detail: stepRecord
      });
    }

    record.finished_at = new Date().toISOString();
    record.status = "success";
    await persistTaskRecord(context, record, "rewrite_legacy");
    const taskLogPath = await writeTaskLogs(
      context,
      record,
      "rewrite_legacy",
      `maintenance-${logSlug}.json`,
      `maintenance-${logSlug}.json`
    );
    return {
      record,
      taskLogPath
    };
  } catch (error) {
    record.finished_at = new Date().toISOString();
    record.status = "error";
    record.error = error.message;
    await persistTaskRecord(context, record, "rewrite_legacy");
    const taskLogPath = await writeTaskLogs(context, record, "rewrite_legacy", `failed-${timestampSlug()}.json`);
    throw Object.assign(error, { taskLogPath });
  }
}

async function runComposePackageTask(context, options) {
  await ensureContextDirs(context);
  const record = buildTaskRecord("compose_package", context, options);
  await persistTaskRecord(context, record, "compose_package");

  const snapshotTempPath = path.join(context.outDir, "runtime", "compose.public-snapshot.json");
  const rawPackageTempPath = path.join(context.outDir, "runtime", "compose.post-package.raw.json");
  const validatedPackageTempPath = path.join(context.outDir, "runtime", "compose.post-package.json");
  const validationReportTempPath = path.join(context.outDir, "runtime", "compose.validation-report.json");

  try {
    let snapshot;
    if (options.snapshotPath) {
      snapshot = await readJson(options.snapshotPath);
      await ensureDirs(path.dirname(snapshotTempPath));
      await fs.copyFile(options.snapshotPath, snapshotTempPath);
      pushStep(record, "copy-snapshot", { stdout: snapshotTempPath, stderr: "" });
    } else {
      snapshot = await buildSnapshot(context, record, snapshotTempPath, options.date);
    }

    const targetDate = snapshot.snapshot_at.slice(0, 10);
    const paths = buildRuntimePaths(context, targetDate);
    await prepareRuntimeDirs(paths);
    await fs.copyFile(snapshotTempPath, paths.snapshotPath);

    await generateAndValidate(
      context,
      record,
      paths.snapshotPath,
      rawPackageTempPath,
      validatedPackageTempPath,
      validationReportTempPath
    );
    await fs.copyFile(rawPackageTempPath, paths.rawPackagePath);
    await fs.copyFile(validatedPackageTempPath, paths.validatedPackagePath);
    await fs.copyFile(validationReportTempPath, paths.validationReportPath);

    record.outputs = {
      snapshot: paths.snapshotPath,
      raw_package: paths.rawPackagePath,
      validated_package: paths.validatedPackagePath,
      validation_report: paths.validationReportPath
    };
    record.finished_at = new Date().toISOString();
    record.status = "success";
    await persistTaskRecord(context, record, "compose_package");
    const taskLogPath = await writeTaskLogs(context, record, "compose_package", `${targetDate}.json`);
    return {
      record,
      taskLogPath
    };
  } catch (error) {
    record.finished_at = new Date().toISOString();
    record.status = "error";
    record.error = error.message;
    await persistTaskRecord(context, record, "compose_package");
    const taskLogPath = await writeTaskLogs(context, record, "compose_package", `failed-${timestampSlug()}.json`);
    throw Object.assign(error, { taskLogPath });
  }
}

async function runSyncFeedbackTask(context, options) {
  await ensureContextDirs(context);
  const record = buildTaskRecord("sync_feedback", context, options);
  await persistTaskRecord(context, record, "sync_feedback");

  if (!options.waitForCompletion) {
    const queued = await queueBackgroundSyncFeedback(context, options);
    pushStep(record, "queue-background-sync-feedback", queued);
    record.outputs = {
      background_log: queued.log,
      latest_state: queued.state,
      interactive_mode: "queued-background-refresh"
    };
    record.finished_at = new Date().toISOString();
    record.status = "queued";
    await persistTaskRecord(context, record, "sync_feedback");
    const taskLogPath = await writeTaskLogs(context, record, "sync_feedback", `queued-${timestampSlug()}.json`);
    return {
      record,
      taskLogPath
    };
  }

  const snapshotTempPath = path.join(context.outDir, "runtime", "feedback.public-snapshot.json");
  const analyticsTempPath = path.join(context.outDir, "runtime", "feedback.note-analytics.json");
  const strategyTempPath = path.join(context.outDir, "runtime", "feedback.feedback-strategy.json");

  try {
    const snapshot = options.snapshotPath ? await readJson(options.snapshotPath) : await buildSnapshot(context, record, snapshotTempPath, options.date);
    if (options.snapshotPath) {
      await ensureDirs(path.dirname(snapshotTempPath));
      await fs.copyFile(options.snapshotPath, snapshotTempPath);
      pushStep(record, "copy-snapshot", { stdout: snapshotTempPath, stderr: "" });
    }

    const targetDate = snapshot.snapshot_at.slice(0, 10);
    const paths = buildRuntimePaths(context, targetDate);
    await prepareRuntimeDirs(paths);
    await fs.copyFile(snapshotTempPath, paths.snapshotPath);

    if (options.skipAnalytics) {
      try {
        await fs.access(context.analyticsStatePath);
      } catch {
        throw new Error(`Analytics cache missing: ${context.analyticsStatePath}`);
      }
      await fs.copyFile(context.analyticsStatePath, analyticsTempPath);
      pushStep(record, "reuse-analytics-cache", {
        stdout: context.analyticsStatePath,
        stderr: ""
      });
      await fs.copyFile(analyticsTempPath, paths.analyticsPath);
    } else {
      const analyticsResult = await context.executor.syncAnalytics({
        configPath: context.configPath,
        outputPath: analyticsTempPath,
        pages: context.config.analytics?.maxPages ?? 3,
        detailLimit: context.config.analytics?.detailLimit ?? 8
      });
      pushStep(record, "sync-analytics", analyticsResult);
      await fs.copyFile(analyticsTempPath, paths.analyticsPath);
      await fs.copyFile(analyticsTempPath, context.analyticsStatePath);
    }

    const immediatePersonaMode = options.waitForPersonaRefresh ? "sync" : "skip";
    const feedbackArgs = [
      context.configPath,
      paths.snapshotPath,
      paths.analyticsPath,
      strategyTempPath,
      `--previous-strategy=${context.strategyStatePath}`,
      `--persona-mode=${immediatePersonaMode}`
    ];
    if (options.forcePersonaRefresh) {
      feedbackArgs.push("--force-persona-refresh");
    }

    const feedbackResult = await runNodeScript(
      path.join(context.agentRoot, "src", "update-xhs-feedback-strategy.mjs"),
      feedbackArgs,
      context.agentRoot
    );
    pushStep(record, "update-feedback-strategy", feedbackResult);
    await fs.copyFile(strategyTempPath, paths.strategyPath);
    await fs.copyFile(strategyTempPath, context.strategyStatePath);

    const immediateStrategy = await readJson(strategyTempPath);
    const personaStatus = immediateStrategy?.persona_analysis?.status ?? null;
    const shouldQueuePersonaRefresh =
      !options.waitForPersonaRefresh &&
      !["success", "cache_hit", "disabled"].includes(personaStatus);

    if (shouldQueuePersonaRefresh) {
      const queuedPersonaRefresh = await queueBackgroundPersonaRefresh(context, paths, options);
      pushStep(record, "queue-persona-refresh", queuedPersonaRefresh);
    }

    record.outputs = {
      snapshot: paths.snapshotPath,
      analytics: paths.analyticsPath,
      feedback_strategy: paths.strategyPath,
      interactive_persona_mode: immediatePersonaMode
    };
    record.finished_at = new Date().toISOString();
    record.status = "success";
    await persistTaskRecord(context, record, "sync_feedback");
    const taskLogPath = await writeTaskLogs(context, record, "sync_feedback", `${targetDate}.json`);
    return {
      record,
      taskLogPath
    };
  } catch (error) {
    record.finished_at = new Date().toISOString();
    record.status = "error";
    record.error = error.message;
    await persistTaskRecord(context, record, "sync_feedback");
    const taskLogPath = await writeTaskLogs(context, record, "sync_feedback", `failed-${timestampSlug()}.json`);
    throw Object.assign(error, { taskLogPath });
  }
}

async function runDeleteNotesTask(context, options) {
  await ensureContextDirs(context);
  const record = buildTaskRecord("delete_notes", context, options);
  await persistTaskRecord(context, record, "delete_notes");

  try {
    const deleteResult = await context.executor.deleteNotes({
      configPath: context.configPath,
      noteIds: options.noteIds
    });
    pushStep(record, "execute-delete", deleteResult);

    record.outputs = {
      results: deleteResult.results
    };
    record.finished_at = new Date().toISOString();
    record.status = "success";
    await persistTaskRecord(context, record, "delete_notes");
    const taskLogPath = await writeTaskLogs(context, record, "delete_notes", `${timestampSlug()}.json`);
    return {
      record,
      taskLogPath
    };
  } catch (error) {
    record.finished_at = new Date().toISOString();
    record.status = "error";
    record.error = error.message;
    await persistTaskRecord(context, record, "delete_notes");
    const taskLogPath = await writeTaskLogs(context, record, "delete_notes", `failed-${timestampSlug()}.json`);
    throw Object.assign(error, { taskLogPath });
  }
}

export async function runAgentTask({ configPath, taskType, options }) {
  const config = await readJson(configPath);
  const context = buildContext(configPath, config);

  switch (taskType) {
    case "daily_publish":
      return runDailyPublishTask(context, options);
    case "rewrite_legacy":
      return runRewriteLegacyTask(context, options);
    case "compose_package":
      return runComposePackageTask(context, options);
    case "sync_feedback":
      return runSyncFeedbackTask(context, options);
    case "delete_notes":
      return runDeleteNotesTask(context, options);
    default:
      throw new Error(`Unsupported xhs-agent task: ${taskType}`);
  }
}
