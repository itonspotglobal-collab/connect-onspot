export function BrainGradient() {
  return (
    <svg
      viewBox="0 0 800 800"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-auto"
    >
      <defs>
        <linearGradient id="brainGradient1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.8" />
          <stop offset="50%" stopColor="#3B82F6" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.4" />
        </linearGradient>
        <radialGradient id="brainGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.3" />
          <stop offset="70%" stopColor="#8B5CF6" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
        </radialGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="8" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      
      {/* Background glow */}
      <circle cx="400" cy="400" r="350" fill="url(#brainGlow)" opacity="0.5"/>
      
      {/* Left hemisphere - simplified, no lung-like details */}
      <path
        d="M 250 400 Q 200 300, 250 200 Q 300 150, 350 200 Q 380 250, 360 300 Q 340 350, 320 380 Q 300 400, 250 400 Z"
        fill="url(#brainGradient1)"
        filter="url(#glow)"
        opacity="0.9"
      />
      
      {/* Right hemisphere - simplified, no lung-like details */}
      <path
        d="M 550 400 Q 600 300, 550 200 Q 500 150, 450 200 Q 420 250, 440 300 Q 460 350, 480 380 Q 500 400, 550 400 Z"
        fill="url(#brainGradient1)"
        filter="url(#glow)"
        opacity="0.9"
      />
      
      {/* Connecting corpus callosum */}
      <path
        d="M 350 350 Q 400 360, 450 350"
        stroke="url(#brainGradient1)"
        strokeWidth="12"
        fill="none"
        opacity="0.5"
        filter="url(#glow)"
      />
      
      {/* Neural pathways */}
      <path
        d="M 280 280 Q 320 300, 360 285"
        stroke="url(#brainGradient1)"
        strokeWidth="3"
        fill="none"
        opacity="0.6"
      />
      <path
        d="M 520 280 Q 480 300, 440 285"
        stroke="url(#brainGradient1)"
        strokeWidth="3"
        fill="none"
        opacity="0.6"
      />
      <path
        d="M 300 320 Q 340 340, 380 325"
        stroke="url(#brainGradient1)"
        strokeWidth="3"
        fill="none"
        opacity="0.6"
      />
      <path
        d="M 500 320 Q 460 340, 420 325"
        stroke="url(#brainGradient1)"
        strokeWidth="3"
        fill="none"
        opacity="0.6"
      />
      
      {/* Synaptic nodes */}
      <circle cx="290" cy="240" r="6" fill="#8B5CF6" opacity="0.8" filter="url(#glow)"/>
      <circle cx="320" cy="270" r="5" fill="#3B82F6" opacity="0.7"/>
      <circle cx="270" cy="310" r="5" fill="#8B5CF6" opacity="0.7"/>
      <circle cx="510" cy="240" r="6" fill="#8B5CF6" opacity="0.8" filter="url(#glow)"/>
      <circle cx="480" cy="270" r="5" fill="#3B82F6" opacity="0.7"/>
      <circle cx="530" cy="310" r="5" fill="#8B5CF6" opacity="0.7"/>
      <circle cx="400" cy="350" r="7" fill="#3B82F6" opacity="0.9" filter="url(#glow)"/>
    </svg>
  );
}
