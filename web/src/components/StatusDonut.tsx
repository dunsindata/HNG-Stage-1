const RADIUS = 26;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface StatusDonutProps {
  label: string;
  value: number;
  total: number;
  color: string;
}

/** A plain SVG ring: no chart library, and the percentage doubles as its label. */
export function StatusDonut({ label, value, total, color }: StatusDonutProps) {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0;
  const dash = (percent / 100) * CIRCUMFERENCE;

  return (
    <div className="donut">
      <svg
        className="donut__svg"
        width="76"
        height="76"
        viewBox="0 0 72 72"
        role="img"
        aria-label={`${label}: ${percent}%`}
      >
        <circle className="donut__track" cx="36" cy="36" r={RADIUS} />
        <circle
          className="donut__value"
          cx="36"
          cy="36"
          r={RADIUS}
          stroke={color}
          strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
          transform="rotate(-90 36 36)"
        />
        <text className="donut__label" x="36" y="36" textAnchor="middle" dominantBaseline="central">
          {percent}%
        </text>
      </svg>
    </div>
  );
}
