import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import { ensureDirs, readJson, resolveConfigPath } from "./lib/runtime-utils.mjs";
import {
  closePersistentChromeContext,
  ensureAssets,
  writeReceipt
} from "./executors/xhs-web/shared/browser-utils.mjs";
import { executeEditFlow } from "./executors/xhs-web/flows/edit-flow.mjs";
import { resolveWebhook, sendFeishuNotification } from "./notify-feishu.mjs";

function usage() {
  console.error(
    "Usage: node ./src/edit-note-job.mjs <config.json> <post-package.json> <note-id> [--mode=dry-run|edit] [--force]"
  );
  process.exit(1);
}

function parseArgs(argv) {
  const positionals = [];
  let mode = "edit";
  let force = false;

  for (const arg of argv) {
    if (arg.startsWith("--mode=")) {
      mode = arg.slice("--mode=".length);
      continue;
    }

    if (arg === "--force") {
      force = true;
      continue;
    }

    positionals.push(arg);
  }

  if (positionals.length < 3) {
    usage();
  }

  return {
    configPath: path.resolve(process.cwd(), positionals[0]),
    packagePath: path.resolve(process.cwd(), positionals[1]),
    noteId: positionals[2],
    mode,
    force
  };
}

function nowIso() {
  return new Date().toISOString();
}

function resolveRuntimePath(configPath, value, fallback) {
  return resolveConfigPath(configPath, value, fallback);
}

function parseTimestamp(value) {
  const time = Date.parse(String(value ?? ""));
  return Number.isNaN(time) ? null : time;
}

function buildEditSafetyConfig(config) {
  return {
    enabled: true,
    cooldownHours: 24,
    maxSuccessfulEditsPerNote: 2,
    blockOnPlatformLimit: true,
    ...(config.maintenance?.editSafety ?? {})
  };
}

function isPlatformLimitMessage(value) {
  const text = String(value ?? "");
  return text.includes("修改次数已达上限") || text.includes("不可继续修改");
}

async function loadNoteEditReceipts(receiptDir, noteId) {
  const files = await fs.readdir(receiptDir).catch(() => []);
  const names = files.filter((name) => name.endsWith(`-edit-${noteId}.json`));
  const receipts = [];

  for (const name of names) {
    try {
      const receipt = JSON.parse(await fs.readFile(path.join(receiptDir, name), "utf8"));
      receipts.push(receipt);
    } catch {
      continue;
    }
  }

  return receipts.sort((left, right) => {
    const leftTime = parseTimestamp(left.finished_at ?? left.started_at) ?? 0;
    const rightTime = parseTimestamp(right.finished_at ?? right.started_at) ?? 0;
    return rightTime - leftTime;
  });
}

function summarizeEditHistory(receipts, safetyConfig) {
  const successfulReceipts = receipts.filter((receipt) => receipt.status === "success" && receipt.mode === "edit");
  const lastSuccessfulReceipt = successfulReceipts[0] ?? null;
  const cooldownMs = Math.max(0, Number(safetyConfig.cooldownHours ?? 24)) * 3600 * 1000;
  const now = Date.now();
  const recentSuccessfulEdits = successfulReceipts.filter((receipt) => {
    const finishedAt = parseTimestamp(receipt.finished_at ?? receipt.started_at);
    return finishedAt !== null && now - finishedAt < cooldownMs;
  }).length;
  const platformLimitReceipt =
    receipts.find((receipt) => isPlatformLimitMessage(receipt.submit_response?.message)) ??
    receipts.find((receipt) => isPlatformLimitMessage(receipt.error));

  return {
    total_receipts: receipts.length,
    successful_edits: successfulReceipts.length,
    recent_successful_edits: recentSuccessfulEdits,
    last_successful_edit_at: lastSuccessfulReceipt?.finished_at ?? lastSuccessfulReceipt?.started_at ?? null,
    platform_limit_hit_at: platformLimitReceipt?.finished_at ?? platformLimitReceipt?.started_at ?? null
  };
}

function evaluateEditSafety(historySummary, safetyConfig) {
  if (!safetyConfig.enabled) {
    return null;
  }

  if (safetyConfig.blockOnPlatformLimit && historySummary.platform_limit_hit_at) {
    return `XHS has already rejected this note for edit-limit exhaustion at ${historySummary.platform_limit_hit_at}. Stop editing and switch to delete/repost.`;
  }

  if (
    Number.isFinite(safetyConfig.cooldownHours) &&
    safetyConfig.cooldownHours > 0 &&
    historySummary.recent_successful_edits > 0
  ) {
    return `This note already has a successful automated edit within the last ${safetyConfig.cooldownHours} hours.`;
  }

  if (
    Number.isFinite(safetyConfig.maxSuccessfulEditsPerNote) &&
    safetyConfig.maxSuccessfulEditsPerNote > 0 &&
    historySummary.successful_edits >= safetyConfig.maxSuccessfulEditsPerNote
  ) {
    return `This note already has ${historySummary.successful_edits} successful automated edits; edit safety is blocking another rewrite.`;
  }

  return null;
}

function buildContentHash(postPackage) {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        title: postPackage.content.title,
        body: postPackage.content.body,
        hashtags: postPackage.content.hashtags,
        assets: postPackage.assets
      })
    )
    .digest("hex")
    .slice(0, 16);
}

export async function runEditNoteJob({ configPath, packagePath, noteId, mode = "edit", force = false }) {
  const [config, postPackage] = await Promise.all([readJson(configPath), readJson(packagePath)]);
  const collectionConfig = {
    ...(config.collection ?? {}),
    ...((postPackage.publish?.collection ?? null) ? postPackage.publish.collection : {})
  };

  if (mode === "edit") {
    resolveWebhook(config, "edit", true);
  }

  const receiptDir = resolveRuntimePath(configPath, config.paths?.receiptDir, "./receipts");
  const artifactDir = resolveRuntimePath(configPath, config.paths?.artifactDir, "./artifacts");
  await ensureDirs(receiptDir, artifactDir);

  const receiptPath = path.join(receiptDir, `${postPackage.package_id}-edit-${noteId}.json`);
  const editSafetyConfig = buildEditSafetyConfig(config);
  const editReceipts = await loadNoteEditReceipts(receiptDir, noteId);
  const editHistory = summarizeEditHistory(editReceipts, editSafetyConfig);
  const editSafetyError = force ? null : evaluateEditSafety(editHistory, editSafetyConfig);
  const assets = await ensureAssets({
    postPackage,
    packagePath,
    limits: config.limits ?? {},
    purpose: "editing"
  });
  const contentHash = buildContentHash(postPackage);
  const receipt = {
    package_id: postPackage.package_id,
    note_id: noteId,
    content_hash: contentHash,
    mode,
    started_at: nowIso(),
    status: "running",
    edit_history: {
      ...editHistory,
      force_bypassed: force
    }
  };

  if (editSafetyError) {
    receipt.status = "blocked";
    receipt.error = editSafetyError;
    receipt.finished_at = nowIso();
    await writeReceipt(receiptPath, receipt);
    throw Object.assign(new Error(editSafetyError), {
      receiptPath,
      receipt
    });
  }

  let context;
  let page;

  try {
    const flowSession = await executeEditFlow({
      configPath,
      config,
      postPackage,
      collectionConfig,
      noteId,
      mode,
      assets,
      artifactDir,
      receipt,
      receiptPath
    });
    context = flowSession.context;
    page = flowSession.page;

    receipt.status = "success";
    if (mode === "dry-run") {
      receipt.message = "Dry run completed without submitting edit.";
    } else {
      receipt.success_text = flowSession.submitResult.successText;
      receipt.verification = flowSession.submitResult.verification;
    }
    receipt.finished_at = nowIso();
    await writeReceipt(receiptPath, receipt);

    if (mode === "dry-run") {
      return {
        status: "success",
        receiptPath,
        receipt
      };
    }

    receipt.notification = await sendFeishuNotification({
      config,
      eventType: "edit",
      action: "编辑更新帖子",
      postPackage,
      receipt,
      noteId
    });
    await writeReceipt(receiptPath, receipt);
    return {
      status: "success",
      receiptPath,
      receipt
    };
  } catch (error) {
    page = error.page ?? page;
    context = error.context ?? context;
    receipt.status = "error";
    receipt.error = error.message;
    receipt.finished_at = nowIso();

    await writeReceipt(receiptPath, receipt);

    try {
      const webhook = resolveWebhook(config, "error", true);
      if (webhook) {
        receipt.notification = await sendFeishuNotification({
          config,
          eventType: "error",
          action: "编辑失败",
          postPackage,
          receipt,
          noteId
        });
        await writeReceipt(receiptPath, receipt);
      }
    } catch (notifyError) {
      receipt.notification_error = notifyError.message;
      await writeReceipt(receiptPath, receipt);
    }

    throw Object.assign(error, {
      receiptPath,
      receipt
    });
  } finally {
    if (context) {
      await closePersistentChromeContext({ context, configPath, config }).catch(() => {});
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await runEditNoteJob(args);
  console.log(
    JSON.stringify(
      {
        status: result.status,
        receipt_path: result.receiptPath ?? null,
        note_id: result.receipt?.note_id ?? args.noteId
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
