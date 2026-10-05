import { useEffect, useRef, useState } from "react";

type InvestorGaugeProps = {
  count: number | null;
  goal: number | null;
  label: string;
};

function useReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);

  return reduced;
}

function useAnimatedValue(target: number | null, reducedMotion: boolean) {
  const [value, setValue] = useState(0);
  const current = useRef(0);
  const frame = useRef<number | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (target === null || !Number.isFinite(target)) return;
    if (frame.current !== null) cancelAnimationFrame(frame.current);

    const start = reducedMotion ? target : initialized.current ? current.current : 0;
    initialized.current = true;
    if (reducedMotion) {
      current.current = target;
      setValue(target);
      return;
    }

    const startTime = performance.now();
    const duration = 1250;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - progress, 4);
      const next = start + (target - start) * eased;
      current.current = next;
      setValue(next);
      if (progress < 1) frame.current = requestAnimationFrame(tick);
      else frame.current = null;
    };
    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [target, reducedMotion]);

  return value;
}

export function InvestorGauge({ count, goal, label }: InvestorGaugeProps) {
  const reducedMotion = useReducedMotion();
  const animatedCount = useAnimatedValue(count, reducedMotion);
  const hasGoal = count !== null && goal !== null && goal > 0 && Number.isFinite(goal);
  const finalProgress = hasGoal ? Math.max(0, Math.min(count / goal, 1)) : 0;
  const progressTarget = hasGoal ? finalProgress : null;
  const animatedProgress = useAnimatedValue(progressTarget, reducedMotion);
  const circumference = 2 * Math.PI * 136;
  const countDigits = count === null ? 1 : Math.max(1, Math.floor(Math.abs(count)).toLocaleString().length);
  const dynamicSize = countDigits >= 9 ? "clamp(3.8rem, 6.6vw, 6rem)" : "clamp(4.6rem, 8.2vw, 7.5rem)";

  return (
    <article className="investor-gauge" aria-label={`${label}: ${count === null ? "unavailable" : `${count.toLocaleString()} registered accounts`}${hasGoal ? `; goal for 2027: ${goal.toLocaleString()}` : ""}`}>
      <div className={`investor-gauge-visual${hasGoal ? " has-goal" : ""}`}>
        {hasGoal && (
          <svg className="investor-gauge-ring" viewBox="0 0 300 300" aria-hidden="true">
            <circle className="investor-gauge-track" cx="150" cy="150" r="136" />
            <circle
              className="investor-gauge-fill"
              cx="150"
              cy="150"
              r="136"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - (reducedMotion ? finalProgress : animatedProgress))}
            />
          </svg>
        )}
        <span
          className="investor-gauge-count"
          aria-hidden="true"
          style={{ fontSize: dynamicSize }}
        >
          {count === null
            ? "—"
            : Math.round(reducedMotion ? count : animatedCount).toLocaleString()}
        </span>
      </div>
      <h2 className="investor-gauge-label">{label}</h2>
      {hasGoal && (
        <p className="investor-gauge-goal">
          Goal for 2027: <strong>{goal.toLocaleString()}</strong>
        </p>
      )}
    </article>
  );
}
