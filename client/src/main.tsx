import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initAnimatedFavicon } from "./utils/animatedFavicon";

// Initialize animated favicon with pulsing glow
initAnimatedFavicon({
  faviconPath: '/favicon.png',
  glowColor: '#5B7CFF', // Violet-blue from CTA gradient
  pulseSpeed: 2000, // 2 second gentle pulse
  size: 64,
});

createRoot(document.getElementById("root")!).render(<App />);
