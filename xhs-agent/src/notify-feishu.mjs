import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

function usage() {
  console.error(
    "Usage: node ./src/notify-feishu.mjs <config.json> <post-package.json> [--event=publish|edit|error] [--action=文本] [--receipt=receipt.json] [--note-id=ID]"
  );
  process.exit(1);
}

function parseArgs(argv) {
  const positionals = [];
  let eventType = "publish";
  let action = "发布帖子";
  let receiptPath = null;
  let noteId = null;

  for (const arg of argv) {
    if (arg.startsWith("--event=")) {
      eventType = arg.slice("--event=".length);
      continue;
    }

    if (arg.startsWith("--action=")) {
      action = arg.slice("--action=".length);
      continue;
    }

    if (arg.startsWith("--receipt=")) {
      receiptPath = arg.slice("--receipt=".length);
      continue;
    }

    if (arg.startsWith("--note-id=")) {
      noteId = arg.slice("--note-id=".length);
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
    eventType,
    action,
    receiptPath: receiptPath ? path.resolve(process.cwd(), receiptPath) : null,
    noteId
  };
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

function compactWhitespace(value) {
  return String(value ?? "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function resolveWebhook(config, eventType, allowMissing = false) {
  const feishuConfig = config.notifications?.feishu ?? {};
  if (feishuConfig.enabled === false) {
    return null;
  }

  const notifyOn = feishuConfig.notifyOn ?? ["publish", "edit", "error"];
  if (!notifyOn.includes(eventType)) {
    return null;
  }

  const configuredWebhook = feishuConfig.webhook ?? null;
  const envName = feishuConfig.webhookEnv ?? "FEISHU_XHS_AGENT_WEBHOOK_URL";
  const webhook = process.env[envName] || configuredWebhook;
  if (!webhook && feishuConfig.strict && !allowMissing) {
    throw new Error(`Feishu webhook is required for ${eventType}. Missing config.notifications.feishu.webhook or env var ${envName}.`);
  }

  return webhook ?? null;
}

function buildSectionDigest(postPackage) {
  return (postPackage.content.sections ?? []).slice(0, 3).map((section) => {
    const firstLine = compactWhitespace(section.text).split("\n")[0] ?? "";
    return `${section.label}：${firstLine}`;
  });
}

function buildKeywordLine(config) {
  const transportKeyword =
    config.notifications?.feishu?.transportKeyword ??
    "codex-cli-monitor";
  const preferredKeyword =
    config.notifications?.feishu?.preferredKeyword ??
    config.notifications?.feishu?.keywords?.[0] ??
    "小红书";
  const keywords = config.notifications?.feishu?.keywords ?? [];
  return [transportKeyword, preferredKeyword, ...keywords].filter(Boolean).join(" ");
}

function buildCardTitle(config, prefix, action, postPackage) {
  return `${buildKeywordLine(config)}｜${prefix}｜${action}｜Day ${postPackage.series.day}`;
}

function buildCardLines({ config, action, postPackage, receipt, noteId }) {
  const lines = [
    `关键词：${buildKeywordLine(config)}`.trim(),
    `标题：${postPackage.content.title}`,
    `动作：${action}`,
    `合集：${postPackage.publish?.collection?.name ?? "未配置"}`,
    `模式：${receipt?.mode ?? postPackage.publish?.mode ?? "publish"}`,
    `帖子ID：${noteId ?? receipt?.note_id ?? "待回填"}`
  ];

  for (const digest of buildSectionDigest(postPackage)) {
    lines.push(digest);
  }

  const reviewSummary = receipt?.post_publish_review?.summary ?? null;
  const reviewStatus = receipt?.post_publish_review?.overall_status ?? null;
  const tagClickCheck =
    receipt?.post_publish_review?.checks?.find((check) => check.id === "published_tag_click_review") ?? null;
  const collectionPageCheck =
    receipt?.post_publish_review?.checks?.find((check) => check.id === "frontend_collection_page_review") ?? null;
  if (reviewSummary && reviewStatus) {
    lines.push(
      `复核：${reviewStatus}｜自动通过 ${reviewSummary.passed} 项｜待人工/待跟进 ${reviewSummary.pending} 项｜失败 ${reviewSummary.failed} 项`
    );
  }

  if (tagClickCheck) {
    const expected = tagClickCheck.evidence?.expected_tags?.length ?? 0;
    const checked = tagClickCheck.evidence?.checked_tags ?? expected;
    lines.push(`Tag复核：${tagClickCheck.status}｜已检查 ${checked}/${expected} 个 tag`);
  }

  if (collectionPageCheck) {
    lines.push(`合集回查：${collectionPageCheck.status}｜${collectionPageCheck.evidence?.collection_name ?? "未识别合集"}`);
  }

  if (receipt?.share_url) {
    lines.push(`分享链接：${receipt.share_url}`);
  }

  if (reviewStatus === "pending_manual_review") {
    lines.push("人工复核：第二账号开链接、看主页、看合集，任一失败按隐藏帖事故处理。");
  }

  return lines;
}

function toFeishuPostPayload(title, lines) {
  return {
    msg_type: "post",
    content: {
      post: {
        zh_cn: {
          title,
          content: lines.map((line) => [
            {
              tag: "text",
              text: `${line}\n`
            }
          ])
        }
      }
    }
  };
}

function toFeishuTextPayload(config, title, lines) {
  return {
    msg_type: "text",
    content: {
      text: [buildKeywordLine(config), title, ...lines].join("\n")
    }
  };
}

async function postToWebhook(webhook, payload) {
  const response = await fetch(webhook, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  const body = await response.json().catch(() => ({}));
  const statusCode = body.StatusCode ?? body.code ?? 0;
  return { response, body, statusCode };
}

export async function sendFeishuNotification({ config, eventType, action, postPackage, receipt, noteId }) {
  const webhook = resolveWebhook(config, eventType, true);
  if (!webhook) {
    // 降级：输出到日志而不是抛出错误
    const prefix = config.notifications?.feishu?.messagePrefix ?? "OpenClaw XHS";
    const title = buildCardTitle(config, prefix, action, postPackage);
    const lines = buildCardLines({ config, action, postPackage, receipt, noteId });
    console.log(`[Feishu通知跳过] 未配置webhook或禁用 | ${title}`);
    console.log(`[飞书通知内容]`, lines.join(" | "));
    return {
      sent: false,
      reason: "webhook-not-configured-or-disabled"
    };
  }

  const prefix = config.notifications?.feishu?.messagePrefix ?? "OpenClaw XHS";
  const title = buildCardTitle(config, prefix, action, postPackage);
  const lines = buildCardLines({ config, action, postPackage, receipt, noteId });
  const payload = toFeishuPostPayload(title, lines);
  
  try {
    let { response, body, statusCode } = await postToWebhook(webhook, payload);
    if ((response.ok && statusCode === 19024) || body?.msg === "Key Words Not Found") {
      ({ response, body, statusCode } = await postToWebhook(webhook, toFeishuTextPayload(config, title, lines)));
    }

    if (!response.ok || statusCode !== 0) {
      const errorMsg = `Feishu webhook returned HTTP ${response.status}: ${JSON.stringify(body)}`;
      console.error(`[Feishu通知失败] ${errorMsg}`);
      return {
        sent: false,
        reason: "api-error",
        status: response.status,
        body
      };
    }

    console.log(`[Feishu通知成功] ${title}`);
    return {
      sent: true,
      response: body
    };
  } catch (fetchError) {
    // 降级：网络错误不阻断主流程
    console.error(`[Feishu通知失败] 网络错误: ${fetchError.message}`);
    return {
      sent: false,
      reason: "network-error",
      error: fetchError.message
    };
  }

}

async function main() {
  const { configPath, packagePath, eventType, action, receiptPath, noteId } = parseArgs(process.argv.slice(2));
  const [config, postPackage, receipt] = await Promise.all([
    readJson(configPath),
    readJson(packagePath),
    receiptPath ? readJson(receiptPath) : Promise.resolve(null)
  ]);

  const result = await sendFeishuNotification({
    config,
    eventType,
    action,
    postPackage,
    receipt,
    noteId
  });
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
