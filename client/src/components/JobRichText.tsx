/**
 * Safe, presentation-only renderer for the limited HTML emitted by the job
 * description editor. Keep the allowlist deliberately small so stored content
 * cannot turn a job preview into an executable document.
 */
const ALLOWED_TAGS = new Set(["p", "br", "strong", "b", "em", "i", "ul", "ol", "li", "a"]);

function isSafeHref(value: string): boolean {
  try {
    const url = new URL(value, window.location.origin);
    return url.protocol === "http:" || url.protocol === "https:" || url.protocol === "mailto:";
  } catch {
    return false;
  }
}

export function sanitizeJobRichText(html: string | null | undefined): string {
  if (!html?.trim() || typeof window === "undefined") return "";

  const source = new DOMParser().parseFromString(html, "text/html");
  const output = document.createElement("div");

  const copyNode = (node: Node, target: HTMLElement) => {
    if (node.nodeType === Node.TEXT_NODE) {
      target.append(document.createTextNode(node.textContent ?? ""));
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const element = node as HTMLElement;
    const tag = element.tagName.toLowerCase();
    if (["script", "style", "iframe", "object", "embed"].includes(tag)) {
      return;
    }
    if (!ALLOWED_TAGS.has(tag)) {
      Array.from(element.childNodes).forEach((child) => copyNode(child, target));
      return;
    }

    const safeElement = document.createElement(tag);
    if (tag === "a") {
      const href = element.getAttribute("href")?.trim();
      if (href && isSafeHref(href)) {
        safeElement.setAttribute("href", href);
        safeElement.setAttribute("target", "_blank");
        safeElement.setAttribute("rel", "noreferrer noopener");
      }
    }
    Array.from(element.childNodes).forEach((child) => copyNode(child, safeElement));
    target.append(safeElement);
  };

  Array.from(source.body.childNodes).forEach((node) => copyNode(node, output));
  return output.innerHTML;
}

export function JobRichText({
  html,
  className = "",
}: {
  html: string | null | undefined;
  className?: string;
}) {
  const isHtml = /<\/?[a-z][^>]*>/i.test(html ?? "");
  if (html?.trim() && !isHtml) {
    return <div className={`job-rich-text whitespace-pre-wrap text-sm leading-relaxed ${className}`}>{html}</div>;
  }

  const safeHtml = sanitizeJobRichText(html);
  if (!safeHtml) return null;

  return (
    <div
      className={`job-rich-text prose prose-slate max-w-none text-sm leading-relaxed dark:prose-invert prose-p:my-0 prose-p:not(:first-child):mt-3 prose-ul:my-3 prose-ol:my-3 prose-li:my-0.5 prose-a:text-[#474ead] ${className}`}
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
}