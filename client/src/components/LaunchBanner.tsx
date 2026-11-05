import { Link } from "wouter";
import "./LaunchBanner.css";
import { HERO_COLORS } from "./HeroPresentation";

export function LaunchBanner() {
  return (
    <div className="launch-banner" role="region" aria-label="Launch announcement" style={{ backgroundColor: HERO_COLORS.orange }}>
      <div className="launch-banner-content">
        <span className="launch-banner-dot" aria-hidden="true" />
        <p className="launch-banner-copy">
          <strong className="launch-banner-desktop-lead">Launching soon.</strong>
          <span className="launch-banner-desktop-copy">
            {" "}Sign up in advance and be first in line for early access.
          </span>
          <span className="launch-banner-mobile-copy">
            <strong className="launch-banner-mobile-lead">Launching soon.</strong>
            {" "}Get early access first.
          </span>
        </p>
        <Link
          href="/waitlist"
          className="launch-banner-button"
          style={{ backgroundColor: HERO_COLORS.dark1 }}
        >
          Get early access <span aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  );
}

export default LaunchBanner;
