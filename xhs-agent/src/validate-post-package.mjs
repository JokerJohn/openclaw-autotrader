import fs from "node:fs/promises";
import path from "node:path";

const segmenter =
  typeof Intl !== "undefined" && Intl.Segmenter
    ? new Intl.Segmenter("zh-Hans", { granularity: "grapheme" })
    : null;

function usage() {
  console.error(
    "Usage: node ./src/validate-post-package.mjs <config.json> <input-package.json> <output-package.json> <report.json>"
  );
  process.exit(1);
}

function countGraphemes(value) {
  const text = String(value ?? "");
  if (!segmenter) {
    return Array.from(text).length;
  }

  return [...segmenter.segment(text)].length;
}

function sliceGraphemes(value, max) {
  const text = String(value ?? "");
  if (!segmenter) {
    return Array.from(text).slice(0, max).join("");
  }

  return [...segmenter.segment(text)]
    .slice(0, max)
    .map((part) => part.segment)
    .join("");
}

function compactWhitespace(value) {
  return String(value ?? "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function sanitizeHashtag(value) {
  return compactWhitespace(value)
    .replace(/^#+/u, "")
    .replace(/\[话题\]/gu, "")
    .replace(/\s+/gu, "");
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function collectFieldPhraseHits(fields, phrases) {
  const hits = [];

  for (const [field, value] of fields) {
    const text = Array.isArray(value) ? value.join(" ") : String(value ?? "");
    for (const phrase of phrases ?? []) {
      if (text.includes(phrase)) {
        hits.push({ field, phrase });
      }
    }
  }

  return hits;
}

function rebuildBody(postPackage, disclaimer) {
  const sections = (postPackage.content.sections ?? [])
    .filter((section) => compactWhitespace(section.label) && compactWhitespace(section.text))
    .map((section) => `${compactWhitespace(section.label)}\n${compactWhitespace(section.text)}`);

  return [...sections, disclaimer].filter(Boolean).join("\n\n").trim();
}

function normalizeSectionLabel(value) {
  return compactWhitespace(value)
    .replace(/^[\p{N}\p{Extended_Pictographic}\uFE0F\u20E3\s.、()（）]+/gu, "")
    .trim();
}

function compactTitle(postPackage, maxChars) {
  const day = postPackage.series?.day ?? "X";
  const dayLabel = Number(day) < 10 ? `第${day}天` : `${day}天`;
  const candidates = [
    `养龙虾${dayLabel}｜OpenClaw小盈`,
    `养龙虾${dayLabel}｜OpenClaw今天小亏`,
    `养龙虾${dayLabel}｜OpenClaw大亏`,
    `养龙虾${dayLabel}，OpenClaw持平`
  ];

  const candidate = candidates.find((item) => countGraphemes(item) <= maxChars);
  if (candidate) {
    return candidate;
  }

  return sliceGraphemes(compactWhitespace(postPackage.content.title), maxChars);
}

function findDisallowedPhrase(text, phrases) {
  for (const phrase of phrases ?? []) {
    if (String(text ?? "").includes(phrase)) {
      return phrase;
    }
  }

  return null;
}

function collectVisibilityRiskHits(fields, phrases) {
  const hits = [];

  for (const [field, value] of fields) {
    const text = Array.isArray(value) ? value.join(" ") : String(value ?? "");
    for (const phrase of phrases ?? []) {
      if (text.includes(phrase)) {
        hits.push({ field, phrase });
      }
    }
  }

  return hits;
}

function requiresDefaultCollection(postPackage) {
  const totalDays = Number(postPackage.series?.total_days ?? 0);
  const day = Number(postPackage.series?.day ?? 0);
  return Number.isFinite(day) && day > 0 && Number.isFinite(totalDays) && totalDays >= 30;
}

function applySensitiveReplacements(text, replacements, mutations, field) {
  let updated = String(text ?? "");

  for (const replacement of replacements ?? []) {
    const pattern = replacement.pattern;
    const next = updated.replace(new RegExp(escapeRegex(pattern), "g"), replacement.replacement);
    if (next !== updated) {
      mutations.push({
        kind: "sensitive-replacement",
        field,
        pattern,
        replacement: replacement.replacement
      });
      updated = next;
    }
  }

  return updated;
}

function shortenBody(postPackage, maxChars, disclaimer, mutations) {
  const priorities = [
    "今天结果",
    "今天怎么做",
    "今日记录"
  ];
  const budgets = new Map([
    ["今天结果", 130],
    ["今天怎么做", 130],
    ["今日记录", 170]
  ]);

  const sections = postPackage.content.sections ?? [];
  let rebuilt = rebuildBody(postPackage, disclaimer);
  if (countGraphemes(rebuilt) <= maxChars) {
    return rebuilt;
  }

  for (const label of priorities) {
    const section = sections.find((item) => normalizeSectionLabel(item.label) === label);
    if (!section) {
      continue;
    }

    const budget = budgets.get(label) ?? 80;
    const currentLength = countGraphemes(section.text);
    if (currentLength <= budget) {
      continue;
    }

    section.text = `${sliceGraphemes(compactWhitespace(section.text), budget)}`.trim();
    mutations.push({
      kind: "body-trim",
      field: label,
      from: currentLength,
      to: countGraphemes(section.text)
    });

    rebuilt = rebuildBody(postPackage, disclaimer);
    if (countGraphemes(rebuilt) <= maxChars) {
      return rebuilt;
    }
  }

  return rebuilt;
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function main() {
  const [configArg, inputArg, outputArg, reportArg] = process.argv.slice(2);
  if (!configArg || !inputArg || !outputArg || !reportArg) {
    usage();
  }

  const configPath = path.resolve(process.cwd(), configArg);
  const inputPath = path.resolve(process.cwd(), inputArg);
  const outputPath = path.resolve(process.cwd(), outputArg);
  const reportPath = path.resolve(process.cwd(), reportArg);

  const [config, postPackage] = await Promise.all([readJson(configPath), readJson(inputPath)]);
  const policy = config.contentPolicy ?? {};
  const mutations = [];
  const errors = [];
  const warnings = [];
  const validated = structuredClone(postPackage);

  const disclaimer = compactWhitespace(policy.requiredDisclaimer ?? validated.content.disclaimer ?? "");
  validated.content.disclaimer = disclaimer;

  validated.content.title = compactWhitespace(
    applySensitiveReplacements(validated.content.title, policy.sensitiveReplacements, mutations, "content.title")
  );

  for (const section of validated.content.sections ?? []) {
    section.label = compactWhitespace(section.label);
    section.text = compactWhitespace(
      applySensitiveReplacements(
        section.text,
        policy.sensitiveReplacements,
        mutations,
        `content.sections.${section.label}`
      )
    );
  }

  validated.content.hooks = (validated.content.hooks ?? [])
    .map((hook, index) =>
      compactWhitespace(
        applySensitiveReplacements(hook, policy.sensitiveReplacements, mutations, `content.hooks.${index}`)
      )
    )
    .filter(Boolean)
    .slice(0, 3);

  validated.content.hashtags = [...new Set((validated.content.hashtags ?? []).map((tag) => `#${sanitizeHashtag(tag)}`))]
    .filter((tag) => tag.length > 1)
    .slice(0, policy.hashtagsMaxCount ?? 15);

  const visibilityRiskPhrases = policy.visibilityRiskPhrases ?? [];
  validated.content.hashtags = validated.content.hashtags.filter(
    (tag) => !visibilityRiskPhrases.some((phrase) => tag.includes(phrase))
  );

  const requiredHashtags = (policy.requiredHashtags ?? []).map((tag) => `#${sanitizeHashtag(tag)}`);
  validated.content.hashtags = [...new Set([...requiredHashtags, ...validated.content.hashtags])]
    .filter((tag) => tag.length > 1)
    .slice(0, policy.hashtagsMaxCount ?? 15);

  if (config.collection?.enabled && config.collection.name) {
    validated.publish = {
      ...(validated.publish ?? {}),
      collection: {
        name: config.collection.name,
        description: config.collection.description ?? "",
        auto_create: config.collection.autoCreate !== false
      }
    };
  }

  if (requiresDefaultCollection(validated)) {
    if (!config.collection?.enabled || !config.collection?.name) {
      errors.push("90-day series posts must default into the configured collection, but config.collection is missing or disabled.");
    } else if (validated.publish?.collection?.name !== config.collection.name) {
      errors.push(`90-day series posts must join the default collection '${config.collection.name}'.`);
    }
  }

  const titleMax = policy.titleMaxGraphemes ?? 20;
  if (countGraphemes(validated.content.title) > titleMax) {
    const original = validated.content.title;
    validated.content.title = compactTitle(validated, titleMax);
    mutations.push({
      kind: "title-shortened",
      from: original,
      to: validated.content.title
    });
  }

  const requiredTitleKeywords = policy.requiredTitleKeywords ?? [];
  if (requiredTitleKeywords.some((keyword) => !validated.content.title.includes(keyword))) {
    const original = validated.content.title;
    validated.content.title = compactTitle(validated, titleMax);
    if (validated.content.title !== original) {
      mutations.push({
        kind: "title-normalized",
        from: original,
        to: validated.content.title
      });
    }
  }

  const titleDisallowed = findDisallowedPhrase(validated.content.title, policy.disallowedPhrases);
  if (titleDisallowed) {
    const original = validated.content.title;
    validated.content.title = compactTitle(validated, titleMax);
    mutations.push({
      kind: "title-disallowed-phrase-removed",
      phrase: titleDisallowed,
      from: original,
      to: validated.content.title
    });
  }

  const requiredLabels = policy.requiredSectionLabels ?? [];
  for (const label of requiredLabels) {
    const section = (validated.content.sections ?? []).find((item) => normalizeSectionLabel(item.label) === label);
    if (!section || !section.text) {
      errors.push(`Missing required section: ${label}`);
    }
  }

  validated.content.body = shortenBody(
    validated,
    policy.bodyMaxGraphemes ?? 1000,
    disclaimer,
    mutations
  );

  const bodyDisallowed = findDisallowedPhrase(validated.content.body, policy.disallowedPhrases);
  if (bodyDisallowed) {
    errors.push(`Body contains a disallowed phrase: ${bodyDisallowed}`);
  }

  if (countGraphemes(validated.content.body) > (policy.bodyMaxGraphemes ?? 1000)) {
    errors.push("Body still exceeds the configured maximum length after compaction.");
  }

  const automationWordHits = collectFieldPhraseHits(
    [
      ["content.cover_text", validated.content.cover_text],
      ["publish.collection.name", validated.publish?.collection?.name],
      ["publish.collection.description", validated.publish?.collection?.description]
    ],
    ["自动化测试", "自动化"]
  );
  if (automationWordHits.length > 0) {
    for (const hit of automationWordHits) {
      errors.push(`Automation wording must not appear in ${hit.field}: ${hit.phrase}`);
    }
  }

  const visibilityRiskHits = collectVisibilityRiskHits(
    [
      ["content.title", validated.content.title],
      ["content.body", validated.content.body],
      ["content.cover_text", validated.content.cover_text],
      ["content.hashtags", validated.content.hashtags],
      ["publish.collection.name", validated.publish?.collection?.name],
      ["publish.collection.description", validated.publish?.collection?.description]
    ],
    visibilityRiskPhrases
  );
  if (visibilityRiskHits.length > 0) {
    for (const hit of visibilityRiskHits) {
      errors.push(`Visibility risk phrase remains in ${hit.field}: ${hit.phrase}`);
    }
  }

  if (!(validated.assets ?? []).length) {
    errors.push("No assets attached to the post package.");
  }

  const coverAsset = (validated.assets ?? []).find((asset) => asset.kind === "cover") ?? validated.assets?.[0];
  if (!coverAsset) {
    errors.push("No cover asset attached to the post package.");
  } else if ((policy.requiredCoverStyle ?? "") === "vertical-github-poster") {
    const looksGeneratedCover = /\.xhs-cover\.(png|jpg|jpeg|webp)$/i.test(coverAsset.path ?? "");
    if (!looksGeneratedCover) {
      warnings.push("Cover does not look like the required vertical GitHub poster asset.");
    }
  }

  if ((validated.content.hashtags ?? []).length === 0) {
    warnings.push("No hashtags remain after normalization.");
  }

  validated.audit = {
    ...validated.audit,
    validated_at: new Date().toISOString(),
    validator: "xhs-agent/validate-post-package.mjs"
  };

  const report = {
    package_id: validated.package_id,
    checked_at: new Date().toISOString(),
    errors,
    warnings,
    mutations,
    metrics: {
      titleGraphemes: countGraphemes(validated.content.title),
      bodyGraphemes: countGraphemes(validated.content.body),
      hashtagsCount: (validated.content.hashtags ?? []).length
    }
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(validated, null, 2) + "\n", "utf8");
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");

  if (errors.length > 0) {
    console.error(JSON.stringify(report, null, 2));
    process.exit(1);
  }

  console.log(`Validated ${outputPath}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
