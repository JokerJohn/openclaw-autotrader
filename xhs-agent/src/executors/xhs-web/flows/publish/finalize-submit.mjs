import {
  clickFirstButton,
  waitForAnyText
} from "../../shared/browser-utils.mjs";
import { appendFlowState } from "../shared/flow-state.mjs";

async function waitForDraftCompletion(page, creatorUrl, timeout = 20000) {
  const deadline = Date.now() + timeout;
  const normalizedCreatorUrl = creatorUrl.replace(/\/+$/, "");

  while (Date.now() < deadline) {
    const currentUrl = page.url().replace(/\/+$/, "");
    if (currentUrl !== normalizedCreatorUrl) {
      return {
        kind: "url-change",
        value: currentUrl
      };
    }

    await page.waitForTimeout(500);
  }

  return null;
}

function buildPublishEvidenceCandidates(postPackage) {
  const candidates = [];
  const title = String(postPackage.content.title ?? "").trim();
  const firstSection = String(postPackage.content.sections?.[0]?.text ?? "").trim();
  const body = String(postPackage.content.body ?? "").trim();

  if (title) {
    candidates.push(title);
  }

  if (firstSection) {
    candidates.push(firstSection.slice(0, 24));
  }

  if (body) {
    candidates.push(body.slice(0, 24));
  }

  return [...new Set(candidates.filter(Boolean))];
}

async function verifyPublishedInManager(page, postPackage, timeout = 20000) {
  const targetUrl = "https://creator.xiaohongshu.com/new/note-manager";
  const candidates = buildPublishEvidenceCandidates(postPackage);

  try {
    await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
      const matchedCard = await page.evaluate((evidenceCandidates) => {
        function normalize(value) {
          return String(value ?? "")
            .replace(/\s+/g, " ")
            .trim();
        }

        function parseNoteIdFromText(value) {
          const text = String(value ?? "");
          const idMatch =
            text.match(/"note_id"\s*:\s*"([0-9a-z]+)"/i) ??
            text.match(/note[_-]?id[=:"]+([0-9a-z]+)/i) ??
            text.match(/\/explore\/([0-9a-z]+)/i) ??
            text.match(/\b([0-9a-z]{24})\b/i);
          return idMatch?.[1] ?? null;
        }

        function extractCardInfo(card) {
          const text = normalize(card.innerText);
          const href =
            card.getAttribute("href") ??
            card.querySelector("a[href]")?.getAttribute("href") ??
            null;
          const dataImpression = card.getAttribute("data-impression") ?? card.dataset?.impression ?? null;
          const outerHtml = card.outerHTML ?? "";
          const noteId =
            parseNoteIdFromText(dataImpression) ??
            parseNoteIdFromText(href) ??
            parseNoteIdFromText(outerHtml);
          const shareUrl = noteId ? `https://www.xiaohongshu.com/explore/${noteId}` : null;
          return { text, href, data_impression: dataImpression, note_id: noteId, share_url: shareUrl };
        }

        const blocks = Array.from(document.querySelectorAll("[data-impression], a[href*='/explore/'], a[href*='note']"));

        for (const block of blocks) {
          const card = block.closest("[data-impression]") ?? block.closest("a") ?? block;
          const info = extractCardInfo(card);
          const matched = evidenceCandidates.find((candidate) => info.text.includes(candidate));
          if (matched) {
            return {
              kind: "note-manager-match",
              value: matched,
              page_url: location.href,
              note_id: info.note_id,
              share_url: info.share_url,
              card_href: info.href,
              data_impression: info.data_impression
            };
          }
        }

        const bodyText = normalize(document.body?.innerText ?? "");
        const matched = evidenceCandidates.find((candidate) => bodyText.includes(candidate));
        if (matched) {
          return {
            kind: "note-manager-match",
            value: matched,
            page_url: location.href,
            note_id: null,
            share_url: null
          };
        }

        return null;
      }, candidates);

      if (matchedCard) {
        return {
          ...matchedCard,
          page_url: page.url()
        };
      }

      await page.waitForTimeout(1000);
    }
  } catch {
    return null;
  }

  return null;
}

export async function finalizePublishAction({ page, config, postPackage, mode, receipt }) {
  if (mode === "dry-run") {
    appendFlowState(receipt, "dry-run-complete");
    return {
      successText: null,
      draftCompletion: null,
      publishVerification: null
    };
  }

  appendFlowState(receipt, mode === "publish" ? "submit-publish" : "submit-draft");
  const primaryButtonLabels =
    mode === "publish" ? config.xhs.selectors.publishButtonText : config.xhs.selectors.draftButtonText;
  const clickedLabel = await clickFirstButton(page, primaryButtonLabels, 10000);

  if (!clickedLabel) {
    throw new Error(`Could not find the ${mode} button.`);
  }

  if (mode === "publish") {
    appendFlowState(receipt, "confirm-publish");
    await clickFirstButton(page, config.xhs.selectors.confirmButtonText, 5000);
  }

  const successText = await waitForAnyText(page, config.xhs.selectors.successTexts, 10000);
  let draftCompletion = null;
  let publishVerification = null;

  if (mode === "draft" && !successText) {
    draftCompletion = await waitForDraftCompletion(page, config.xhs.creatorUrl, 15000);
  }

  if (mode === "publish") {
    publishVerification = await verifyPublishedInManager(page, postPackage, successText ? 10000 : 20000);
  }

  if (!successText && !draftCompletion && !publishVerification) {
    throw new Error("Submit action was triggered but no success signal was detected.");
  }

  appendFlowState(receipt, "submit-complete", {
    success_text: successText ?? null,
    draft_completion: Boolean(draftCompletion),
    manager_verification: Boolean(publishVerification)
  });

  return {
    successText,
    draftCompletion,
    publishVerification
  };
}
