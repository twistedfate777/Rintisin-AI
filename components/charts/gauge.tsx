"use client";

import { PolarAngleAxis, RadialBar, RadialBarChart } from "recharts";
import { clampScore } from "@/lib/numbers";

/**
 * A half-ring gauge on a fixed 0–100 scale. The value is guarded (finite, clamped) before it reaches
 * Recharts; the arc fills in proportion and the label is the same number as text, so the chart itself
 * is hidden from screen readers and a text alternative carries name and value.
 */
export function Gauge({
  value,
  label,
  name,
  color = "var(--chart-1)",
  size = 200,
}: {
  value: unknown;
  /** The formatted value shown in the centre, e.g. "48,6%". */
  label: string;
  /** What the value is, for the text alternative. */
  name: string;
  color?: string;
  size?: number;
}) {
  const safe = clampScore(value);
  const height = Math.round(size * 0.58);
  return (
    <figure className="relative flex flex-col items-center" style={{ width: size }}>
      <div aria-hidden="true" style={{ width: size, height }}>
        <RadialBarChart
          width={size}
          height={size}
          cx={size / 2}
          cy={size / 2}
          innerRadius={size / 2 - 16}
          outerRadius={size / 2}
          startAngle={180}
          endAngle={0}
          data={[{ value: safe }]}
          barSize={14}
          margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} axisLine={false} />
          <RadialBar
            dataKey="value"
            fill={color}
            background={{ fill: "var(--active)" }}
            isAnimationActive={false}
          />
        </RadialBarChart>
      </div>
      <div
        aria-hidden="true"
        className="num absolute inset-x-0 text-center text-kpi font-normal text-ink"
        style={{ top: height - 40 }}
      >
        {label}
      </div>
      <div aria-hidden="true" className="num mt-1 flex w-full justify-between px-1 text-xs text-ink-muted">
        <span>0</span>
        <span>100</span>
      </div>
      <figcaption className="sr-only">
        {name}: {label} dari skala 0 sampai 100.
      </figcaption>
    </figure>
  );
}
