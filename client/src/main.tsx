import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initAnimatedFavicon } from "./utils/animatedFavicon";

// Initialize animated favicon with pulsing bluish-purple halo
initAnimatedFavicon({
  glowColor: '#6366f1', // Bluish-purple halo
  pulseSpeed: 2000, // 2 second gentle pulse
  size: 64,
});

createRoot(document.getElementById("root")!).render(<App />);
