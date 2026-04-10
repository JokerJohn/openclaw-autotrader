import {
  normalizeEditorText,
  readEditorText,
  readSelectedCollectionName
} from "../../shared/browser-utils.mjs";

function formatTopicTag(tag) {
  const normalized = String(tag ?? "")
    .replace(/^#+/u, "")
    .replace(/\[话题\]/gu, "")
    .replace(/\s+/gu, "")
    .trim();
  return normalized ? `#${normalized}[话题]#` : "";
}

export function buildDraftHashtagLine(postPackage) {
  const tags = (postPackage.content.hashtags ?? []).map(formatTopicTag).filter(Boolean);
  if (tags.length === 0) {
    return "";
  }

  return `${tags.join(" ")} `;
}

export function buildDraftBody(postPackage) {
  const hashtagLine = buildDraftHashtagLine(postPackage);
  const body = String(postPackage.content.body ?? "").trim();
  if (!hashtagLine) {
    return body;
  }
  return body ? `${body}\n\n${hashtagLine}` : hashtagLine;
}

function normalizeDraftMatchText(value) {
  return normalizeEditorText(value)
    .replace(/\s+/g, " ")
    .trim();
}

export async function verifyDraftState({
  page,
  titleInput,
  bodyEditor,
  postPackage,
  collectionConfig,
  selectors,
  requireCollection = true
}) {
  const title = await titleInput.inputValue().catch(() => "");
  const bodyText = await readEditorText(bodyEditor).catch(() => "");
  const expectedBody = normalizeDraftMatchText(buildDraftBody(postPackage));
  const actualBody = normalizeDraftMatchText(bodyText);
  const imageCount = await page.locator(".img-preview-area .img-container").count().catch(() => 0);
  const expectedImageCount = postPackage.publish?.expected_image_count ?? postPackage.assets?.length ?? 0;
  const topicTagCount = await bodyEditor.locator("a.tiptap-topic").count().catch(() => 0);
  const expectedTopicTagCount = (postPackage.content.hashtags ?? []).length;
  const titleMatches = title === postPackage.content.title;
  const bodyMatches = Boolean(expectedBody) && actualBody.includes(expectedBody);
  const imageMatches = expectedImageCount === 0 || imageCount === expectedImageCount;
  const topicTagsMatch = expectedTopicTagCount === 0 || topicTagCount === expectedTopicTagCount;
  const selectedCollectionName = await readSelectedCollectionName(page, selectors).catch(() => null);
  const expectedCollectionName =
    requireCollection && collectionConfig?.enabled ? collectionConfig?.name ?? null : null;
  const collectionMatches = !expectedCollectionName || selectedCollectionName === expectedCollectionName;

  return {
    ok: titleMatches && bodyMatches && imageMatches && topicTagsMatch && collectionMatches,
    title,
    title_matches: titleMatches,
    body_matches: bodyMatches,
    body_length: bodyText.length,
    expected_body_length: expectedBody.length,
    image_count: imageCount,
    expected_image_count: expectedImageCount,
    topic_tag_count: topicTagCount,
    expected_topic_tag_count: expectedTopicTagCount,
    topic_tags_match: topicTagsMatch,
    selected_collection_name: selectedCollectionName,
    expected_collection_name: expectedCollectionName,
    collection_matches: collectionMatches
  };
}
