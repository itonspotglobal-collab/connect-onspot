import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useTheme } from "@/components/ThemeProvider";

interface FooterProps {
  /**
   * Visual treatment for the surface immediately above the footer.
   * "dark-gradient" keeps the footer transparent inside a shared dark
   * gradient, while "adaptive" follows the light/dark page surface.
   */
  variant?: "dark-gradient" | "light" | "indigo" | "adaptive";
  /**
   * When true, renders a subtle top border to visually separate the footer
   * from the section above without breaking the shared background.
   */
  separator?: boolean;
}

const VARIANT_STYLES = {
  "dark-gradient": {
    background: "transparent",
    copyright: "rgba(220,224,255,0.38)",
    link: "rgba(220,224,255,0.46)",
    hover: "rgba(247,248,255,0.78)",
    separator: "rgba(255,255,255,0.16)",
  },
  light: {
    background: "#ffffff",
    copyright: "rgba(71,85,105,0.60)",
    link: "rgba(71,85,105,0.68)",
    hover: "#334155",
    separator: "rgba(15,23,42,0.10)",
  },
  indigo: {
    background: "#474EAD",
    copyright: "rgba(220,224,255,0.38)",
    link: "rgba(220,224,255,0.46)",
    hover: "rgba(247,248,255,0.78)",
    separator: "rgba(255,255,255,0.16)",
  },
  dark: {
    background: "#060816",
    copyright: "rgba(220,224,255,0.38)",
    link: "rgba(220,224,255,0.46)",
    hover: "rgba(247,248,255,0.78)",
    separator: "rgba(255,255,255,0.16)",
  },
} as const;

const NAV_LINKS = [
  { href: "/why-onspot/about",    label: "About" },
  { href: "/amazing",             label: "Stories" },
  { href: "/insights",            label: "Insights" },
  { href: "/hire-talent",         label: "Hire Talent" },
  { href: "/find-work/jobs",      label: "Find Work" },
  { href: "/affiliate-marketing", label: "Affiliate" },
  { href: "/bpo-partner",         label: "BPO Partner" },
  { href: "/investors",           label: "Investors" },
  { href: "/operations-playbook", label: "Playbook" },
  { href: "/privacy-policy",      label: "Privacy Policy" },
  { href: "/terms-and-conditions",label: "Terms" },
];

export function Footer({ variant = "indigo", separator = true }: FooterProps) {
  const { theme } = useTheme();
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const updateSystemTheme = () => setSystemTheme(media.matches ? "dark" : "light");

    updateSystemTheme();
    media.addEventListener("change", updateSystemTheme);
    return () => media.removeEventListener("change", updateSystemTheme);
  }, []);

  useEffect(() => {
    if (window.location.hash !== "#site-footer") return;

    const scrollToFooter = () =>
      document.getElementById("site-footer")?.scrollIntoView({ block: "start" });
    const frame = window.requestAnimationFrame(scrollToFooter);
    const timeout = window.setTimeout(scrollToFooter, 300);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, []);

  const resolvedTheme = theme === "system" ? systemTheme : theme;
  const resolvedVariant = variant === "adaptive" && resolvedTheme === "dark" ? "dark" : variant === "adaptive" ? "light" : variant;
  const styles = VARIANT_STYLES[resolvedVariant];

  return (
    <footer
      id="site-footer"
      style={{
        background: styles.background,
        padding: "32px 0 28px",
        ...(separator && { borderTop: `1px solid ${styles.separator}` }),
      }}
    >
      <div
        style={{
          maxWidth: 1140,
          margin: "0 auto",
          padding: "0 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 24,
          flexWrap: "wrap",
        }}
      >
        {/* Left: copyright */}
        <p
          style={{
            fontSize: 11.5,
            fontWeight: 600,
            color: styles.copyright,
            margin: 0,
            letterSpacing: "0.02em",
            whiteSpace: "nowrap",
          }}
        >
          Work Without Limits · © {new Date().getFullYear()} OnSpot
        </p>

        {/* Right: nav + legal */}
        <nav
          aria-label="Footer navigation"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "4px 18px",
            justifyContent: "flex-end",
          }}
        >
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={label}
              href={href}
              style={{
                fontSize: 11.5,
                color: styles.link,
                textDecoration: "none",
                transition: "color 0.14s",
              }}
              onMouseEnter={(e: any) =>
                (e.currentTarget.style.color = styles.hover)
              }
              onMouseLeave={(e: any) =>
                (e.currentTarget.style.color = styles.link)
              }
              className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
