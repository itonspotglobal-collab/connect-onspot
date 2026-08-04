/**
 * BenefitsDisplay
 *
 * Renders a free-text benefits string as either:
 *  - A row of small lavender chips  (when the text is clearly a list)
 *  - Clean body text                (when the text appears to be a sentence)
 *
 * Parsing rules
 *  - Split on newlines, commas, and semicolons.
 *  - If that yields 2+ short items → chips.
 *  - If it yields 1 item that looks like a short label (≤ 60 chars, no full stop) → single chip.
 *  - Otherwise render as prose.
 */

interface BenefitsDisplayProps {
  benefits: string;
  /** Pass true when rendering on a dark background (job-details hero). */
  dark?: boolean;
}

function splitBenefits(text: string): string[] | null {
  const items = text
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (items.length === 0) return null;

  // Multiple items → always show as chips
  if (items.length >= 2) return items;

  // Single item: chip only when it looks like a label, not a sentence
  const single = items[0];
  if (single.length <= 60 && !single.includes(".") && !single.includes("?")) {
    return [single];
  }

  // Prose fallback
  return null;
}

export function BenefitsDisplay({ benefits, dark = false }: BenefitsDisplayProps) {
  const items = splitBenefits(benefits);

  if (!items) {
    // Render as clean body text
    return (
      <p
        className={
          dark
            ? "text-sm text-white/80 leading-relaxed"
            : "text-sm text-slate-700 dark:text-slate-300 leading-relaxed"
        }
      >
        {benefits}
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5 mt-0.5">
      {items.map((item, i) => (
        <span
          key={i}
          className={
            dark
              ? "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-purple-500/20 border border-purple-400/30 text-purple-200"
              : "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-purple-50 border border-purple-200 text-purple-700 dark:bg-purple-500/20 dark:border-purple-400/30 dark:text-purple-200"
          }
        >
          {item}
        </span>
      ))}
    </div>
  );
}
