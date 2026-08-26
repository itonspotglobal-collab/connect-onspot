/**
 * Converts stored Quill/legacy HTML into a compact, readable text summary.
 * This is intentionally for snippets and cards only; full job views use
 * JobRichText so their formatting can remain visible.
 */
export function htmlToPlainText(value: string | null | undefined): string {
  if (!value?.trim()) return "";

  if (typeof DOMParser === "undefined") {
    return value
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/\s+/g, " ")
      .trim();
  }

  const document = new DOMParser().parseFromString(value, "text/html");
  document.querySelectorAll("script, style, iframe, object, embed").forEach((element) => element.remove());
  document.querySelectorAll("br").forEach((element) => element.replaceWith(" "));
  document.querySelectorAll("p, div, li, ul, ol, h1, h2, h3, h4, h5, h6").forEach((element) => {
    element.before(" ");
    element.after(" ");
  });

  return (document.body.textContent ?? "").replace(/\s+/g, " ").trim();
}