import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import { ensureDirs, fileExists, readJson, readJsonIfExists, resolveConfigPath } from "./lib/runtime-utils.mjs";
import {
  closePersistentChromeContext,
  ensureAssets,
  writeReceipt
} from "./executors/xhs-web/shared/browser-utils.mjs";
import { executePublishFlow } from "./executors/xhs-web/flows/publish-flow.mjs";
import { resolveWebhook, sendFeishuNotification } from "./notify-feishu.mjs";
import { writePostPublishReview } from "./post-publish-review.mjs";

function usage() {
  console.error(
    "Usage: node ./src/run-publish-job.mjs <config.json> <post-package.json> [--mode=dry-run|draft|publish] [--force]"
  );
  process.exit(1);
}

function parseArgs(argv) {
  const positionals = [];
  let mode;
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

  if (positionals.length < 2) {
    usage();
  }

  return {
    configPath: path.resolve(process.cwd(), positionals[0]),
    packagePath: path.resolve(process.cwd(), positionals[1]),
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

function buildRunKey(postPackage, mode) {
  return `${postPackage.series.id}:day-${postPackage.series.day}:${mode}`;
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

export async function runPublishJob({ configPath, packagePath, mode: cliMode, force = false }) {
  const [config, postPackage] = await Promise.all([readJson(configPath), readJson(packagePath)]);
  const mode = cliMode ?? config.publishMode ?? postPackage.publish.mode ?? "draft";
  const collectionConfig = {
    ...(config.collection ?? {}),
    ...((postPackage.publish?.collection ?? null) ? postPackage.publish.collection : {})
  };

  if (mode === "publish") {
    resolveWebhook(config, "publish", true);
  }

  const receiptDir = resolveRuntimePath(configPath, config.paths?.receiptDir, "./receipts");
  const artifactDir = resolveRuntimePath(configPath, config.paths?.artifactDir, "./artifacts");
  const stateDir = resolveRuntimePath(configPath, config.paths?.stateDir, "./state");
  await ensureDirs(receiptDir, artifactDir, stateDir);

  const receiptPath = path.join(receiptDir, `${postPackage.package_id}-${mode}.json`);
  const legacyReceiptPath = path.join(receiptDir, `${postPackage.package_id}.json`);
  const latestStatePath = path.join(stateDir, "latest-success.json");
  const publishLedgerPath = path.join(stateDir, "publish-ledger.json");
  const receiptPathExists = await fileExists(receiptPath);
  const legacyReceiptPathExists = await fileExists(legacyReceiptPath);
  const existingReceiptPath = receiptPathExists ? receiptPath : legacyReceiptPathExists ? legacyReceiptPath : null;
  const existingReceipt = existingReceiptPath ? await readJson(existingReceiptPath) : null;
  const ledger = await readJsonIfExists(publishLedgerPath, {});
  const runKey = buildRunKey(postPackage, mode);
  const contentHash = buildContentHash(postPackage);
  const dedupeEnabled = mode !== "dry-run";
  const existingReceiptMatchesMode =
    existingReceiptPath === receiptPath
      ? true
      : Boolean(existingReceipt?.mode) && existingReceipt.mode === mode;

  if (dedupeEnabled && !force && existingReceipt?.status === "success" && existingReceiptMatchesMode) {
    ledger[runKey] = {
      status: "success",
      package_id: existingReceipt.package_id ?? postPackage.package_id,
      receipt_path: receiptPath,
      content_hash: existingReceipt.content_hash ?? contentHash,
      finished_at: existingReceipt.finished_at ?? nowIso()
    };
    await fs.writeFile(publishLedgerPath, JSON.stringify(ledger, null, 2) + "\n", "utf8");
    console.log(`Skipping ${postPackage.package_id}; successful receipt already exists.`);
    return {
      status: "skipped",
      reason: "existing-successful-receipt",
      receiptPath,
      receipt: existingReceipt
    };
  }

  if (dedupeEnabled && !force && ledger[runKey]?.status === "success") {
    console.log(
      `Skipping ${postPackage.package_id}; ${runKey} already succeeded via ${ledger[runKey].package_id}.`
    );
    return {
      status: "skipped",
      reason: "publish-ledger-success",
      receiptPath: ledger[runKey].receipt_path ?? null,
      receipt: null
    };
  }

  const assets = await ensureAssets({
    postPackage,
    packagePath,
    limits: config.limits ?? {},
    purpose: "publishing"
  });

  let context;
  let page;

  const receipt = {
    package_id: postPackage.package_id,
    run_key: runKey,
    content_hash: contentHash,
    mode,
    started_at: nowIso(),
    status: "running"
  };

  try {
    const flowSession = await executePublishFlow({
      configPath,
      config,
      postPackage,
      collectionConfig,
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
      receipt.message = "Dry run completed without submitting.";
    } else {
      receipt.success_text = flowSession.submitResult.successText;
      receipt.draft_completion = flowSession.submitResult.draftCompletion;
      receipt.publish_verification = flowSession.submitResult.publishVerification;
      receipt.note_id = flowSession.submitResult.publishVerification?.note_id ?? receipt.note_id ?? null;
      receipt.share_url = flowSession.submitResult.publishVerification?.share_url ?? receipt.share_url ?? null;
    }
    receipt.page_url = page.url();
    receipt.finished_at = nowIso();

    if (mode === "publish" && config.postPublishReview?.enabled !== false) {
      const { reviewPath } = await writePostPublishReview({
        config,
        postPackage,
        receipt,
        artifactDir,
        receiptPath,
        context
      });
      receipt.post_publish_review_path = reviewPath;
    }

    await writeReceipt(receiptPath, receipt);
    if (mode === "dry-run") {
      return {
        status: "success",
        receiptPath,
        receipt
      };
    }

    await fs.writeFile(
      latestStatePath,
      JSON.stringify(
        {
          package_id: postPackage.package_id,
          mode,
          finished_at: receipt.finished_at
        },
        null,
        2
      ) + "\n",
      "utf8"
    );
    if (dedupeEnabled) {
      ledger[runKey] = {
        status: "success",
        package_id: postPackage.package_id,
        receipt_path: receiptPath,
        content_hash: contentHash,
        finished_at: receipt.finished_at
      };
      await fs.writeFile(publishLedgerPath, JSON.stringify(ledger, null, 2) + "\n", "utf8");
    }

    if (mode === "publish") {
      receipt.notification = await sendFeishuNotification({
        config,
        eventType: "publish",
        action: "发布帖子",
        postPackage,
        receipt,
        noteId: receipt.note_id ?? null
      });
      await writeReceipt(receiptPath, receipt);
    }
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
    if (dedupeEnabled) {
      ledger[runKey] = {
        status: "error",
        package_id: postPackage.package_id,
        receipt_path: receiptPath,
        content_hash: contentHash,
        finished_at: receipt.finished_at
      };
      await fs.writeFile(publishLedgerPath, JSON.stringify(ledger, null, 2) + "\n", "utf8");
    }

    try {
      const webhook = resolveWebhook(config, "error", true);
      if (webhook) {
        receipt.notification = await sendFeishuNotification({
          config,
          eventType: "error",
          action: "发布失败",
          postPackage,
          receipt,
          noteId: null
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
  const result = await runPublishJob(args);
  console.log(
    JSON.stringify(
      {
        status: result.status,
        reason: result.reason ?? null,
        receipt_path: result.receiptPath ?? null
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
