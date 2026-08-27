import sanitizeHtml from "sanitize-html";
import { load } from "cheerio";

const EMAIL_TEXT_TAGS = [
  "a",
  "b",
  "blockquote",
  "br",
  "div",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "i",
  "li",
  "ol",
  "p",
  "s",
  "span",
  "strong",
  "u",
  "ul",
];

/**
 * Converts user-controlled rich-text HTML into readable email text.
 *
 * The result is plain text rather than email HTML: tags, attributes, scripts,
 * styles, frames, and executable markup cannot reach the email renderer.
 */
export function htmlToPlainText(value: string | null | undefined): string {
  if (!value?.trim()) return "";

  const sanitized = sanitizeHtml(`<div>${value}</div>`, {
    allowedTags: EMAIL_TEXT_TAGS,
    allowedAttributes: {},
    disallowedTagsMode: "completelyDiscard",
  });
  const $ = load(sanitized, null, false);

  $("br").replaceWith("\n");
  $("li").each((_index, element) => {
    $(element).prepend("• ");
  });
  $("p, div, li, ul, ol, blockquote, h1, h2, h3, h4, h5, h6").each(
    (_index, element) => {
      $(element).before("\n");
      $(element).after("\n");
    },
  );

  return $.root()
    .text()
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/\n+/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}