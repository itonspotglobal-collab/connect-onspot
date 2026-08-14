import { Link } from "wouter";

interface FooterProps {
  /**
   * CSS background value for the footer — pass the same value the preceding
   * section uses so the footer reads as a seamless continuation (zero visual break).
   * Defaults to the brand indigo used on the About page.
   */
  bg?: string;
}

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

export function Footer({ bg = "#474EAD" }: FooterProps) {
  return (
    <footer style={{ background: bg, padding: "32px 0 28px" }}>
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
            color: "rgba(255,255,255,0.32)",
            margin: 0,
            letterSpacing: "0.02em",
            whiteSpace: "nowrap",
          }}
        >
          Work Without Limits · © {new Date().getFullYear()} OnSpot
        </p>

        {/* Right: nav + legal */}
        <div
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
                color: "rgba(255,255,255,0.28)",
                textDecoration: "none",
                transition: "color 0.14s",
              }}
              onMouseEnter={(e: any) =>
                (e.currentTarget.style.color = "rgba(255,255,255,0.65)")
              }
              onMouseLeave={(e: any) =>
                (e.currentTarget.style.color = "rgba(255,255,255,0.28)")
              }
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
