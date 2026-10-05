import type { CSSProperties } from "react";

export const HERO_COLORS = {
  dark1: "#272668",
  dark2: "#3A4295",
  dark3: "#4652B5",
  lightBg: "#FAF8F5",
  lightGlow: "rgba(71,78,173,0.06)",
  indigo: "#4B51B8",
  indigoDark: "#383E90",
  indigoDeep: "#272668",
  indigoLight: "#7B81D4",
  orange: "#FFAE21",
  orangeLight: "#FFC052",
  orangeDeep: "#A06800",
  charcoal: "#17171C",
  gray: "#6B6B76",
  grayLight: "#9494A0",
  lavenderBg: "#F1F0FF",
  warmBg: "#FFF9EF",
  navySection: "#0C123F",
} as const;

const HERO_TYPEFACE = "Inter, -apple-system, BlinkMacSystemFont, sans-serif";
const HERO_MUTED_TEXT = "rgba(199,203,242,0.8)";

export const HERO_HEADLINE_STYLE = {
  fontFamily: HERO_TYPEFACE,
  fontWeight: 700,
  letterSpacing: "-0.03em",
  lineHeight: 0.99,
} as const;

export const HERO_SUBTITLE_STYLE = {
  fontFamily: HERO_TYPEFACE,
  fontSize: "clamp(16px, 1.35vw, 22px)",
  lineHeight: 1.4,
} as const;

export const HERO_SUBTITLE_LEAD_STYLE = {
  color: "#ffffff",
  fontWeight: 600,
} as const;

export const HERO_SUBTITLE_MUTED_STYLE = {
  color: HERO_MUTED_TEXT,
  fontWeight: 400,
} as const;

const rgbChannels = (hex: string) =>
  [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16)).join(", ");

export const HERO_SHARED_CSS_VARS = {
  "--hero-dark-1": HERO_COLORS.dark1,
  "--hero-dark-2": HERO_COLORS.dark2,
  "--hero-dark-3": HERO_COLORS.dark3,
  "--hero-indigo": HERO_COLORS.indigo,
  "--hero-orange": HERO_COLORS.orange,
  "--hero-orange-rgb": rgbChannels(HERO_COLORS.orange),
  "--hero-orange-light": HERO_COLORS.orangeLight,
  "--hero-orange-light-rgb": rgbChannels(HERO_COLORS.orangeLight),
  "--hero-orange-deep": HERO_COLORS.orangeDeep,
  "--hero-muted-light": HERO_MUTED_TEXT,
  "--hero-eyebrow-color": "rgba(255,255,255,0.75)",
  "--hero-typeface": HERO_TYPEFACE,
  "--hero-headline-weight": String(HERO_HEADLINE_STYLE.fontWeight),
  "--hero-headline-letter-spacing": HERO_HEADLINE_STYLE.letterSpacing,
  "--hero-headline-line-height": String(HERO_HEADLINE_STYLE.lineHeight),
  "--hero-subtitle-size": HERO_SUBTITLE_STYLE.fontSize,
  "--hero-subtitle-line-height": String(HERO_SUBTITLE_STYLE.lineHeight),
  "--hero-white": "#ffffff",
} as CSSProperties;

// Keep the work slide and pages that continue it on precisely the same canvas.
export const HERO_WORK_BACKGROUND =
  `radial-gradient(ellipse at 70% 30%, rgba(70,82,181,0.55), transparent 60%), linear-gradient(150deg, ${HERO_COLORS.dark1} 0%, ${HERO_COLORS.dark2} 55%, ${HERO_COLORS.dark3} 100%)`;

export const HERO_PRIMARY_CTA_STYLE = {
  color: HERO_COLORS.indigo,
  boxShadow: "0 12px 32px -8px rgba(0,0,0,0.35)",
} as const;

export const HERO_GLASS_CTA_STYLE = {
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.4)",
  backdropFilter: "blur(8px)",
} as const;

export const HERO_PRIMARY_CTA_CLASS =
  "inline-flex h-[52px] min-w-[180px] items-center justify-center rounded-full bg-white px-8 text-[15.5px] font-semibold transition hover:-translate-y-[1px] hover:bg-white/95";

export const HERO_GLASS_CTA_CLASS =
  "inline-flex h-[52px] min-w-[180px] items-center justify-center rounded-full px-8 text-[15.5px] font-semibold text-white transition hover:-translate-y-[1px]";
