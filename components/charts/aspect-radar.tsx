"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { BaseTickContentProps } from "recharts";
import type { AspectScores } from "@/lib/types";
import { clampScore } from "@/lib/numbers";

export const ASPECT_AXES: { key: keyof AspectScores; label: string }[] = [
  { key: "product_quality", label: "Kualitas Produk" },
  { key: "pricing_value", label: "Harga/Value" },
  { key: "service_speed", label: "Kecepatan Layanan" },
  { key: "ambience_facility", label: "Fasilitas & Suasana" },
];

/** An axis label; the left and right labels break onto two lines so they are not clipped on a phone. */
function AxisTick({ x = 0, y = 0, textAnchor = "middle", payload }: BaseTickContentProps) {
  const words = String(payload?.value ?? "").split(" ");
  const half = Math.ceil(words.length / 2);
  const lines =
    textAnchor !== "middle" && words.length > 1
      ? [words.slice(0, half).join(" "), words.slice(half).join(" ")]
      : [words.join(" ")];
  return (
    <text x={x} y={y} textAnchor={textAnchor} fill="var(--text)" fontSize={12}>
      {lines.map((line, i) => (
        <tspan key={line + i} x={x} dy={i === 0 ? (lines.length > 1 ? "-0.25em" : "0.35em") : "1.2em"}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

export interface RadarSeries {
  name: string;
  color: string;
  /** SVG stroke-dasharray; the series hues sit close in value, so each series also gets its own line. */
  dash?: string;
  scores: AspectScores;
}

/** A legend swatch drawn as the series' own line: same colour, same dash. */
export function SeriesSwatch({ color, dash }: { color: string; dash?: string }) {
  return (
    <svg width="16" height="8" viewBox="0 0 16 8" className="flex-none" aria-hidden="true">
      <line x1="0" y1="4" x2="16" y2="4" stroke={color} strokeWidth="2" strokeDasharray={dash || undefined} />
    </svg>
  );
}

/**
 * Four fixed axes, a fixed 0–100 radius whatever the data, one series per competitor (max 3).
 * Scores are guarded (finite, clamped) and otherwise plotted unchanged. The chart is hidden from
 * screen readers; the aspect table beside it is the text alternative and the legend.
 */
export function AspectRadar({ series, height = 320 }: { series: RadarSeries[]; height?: number }) {
  const safeSeries = series.slice(0, 3);
  const data = ASPECT_AXES.map((axis) => {
    const row: Record<string, string | number> = { axis: axis.label };
    safeSeries.forEach((s, i) => {
      row[`s${i}`] = clampScore(s.scores?.[axis.key]);
    });
    return row;
  });

  return (
    <div aria-hidden="true" style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        {/* Side labels wrap to two lines and get 48px margins, so they stay inside a phone-width card. */}
        <RadarChart data={data} outerRadius="72%" margin={{ top: 8, right: 48, bottom: 8, left: 48 }}>
          <PolarGrid stroke="var(--grid)" />
          <PolarAngleAxis dataKey="axis" tick={AxisTick} />
          <PolarRadiusAxis
            domain={[0, 100]}
            tickCount={5}
            angle={45}
            axisLine={false}
            tick={{ fill: "var(--text-muted)", fontSize: 11 }}
          />
          {safeSeries.map((s, i) => (
            <Radar
              key={s.name + i}
              name={s.name}
              dataKey={`s${i}`}
              stroke={s.color}
              strokeWidth={2}
              strokeDasharray={s.dash || undefined}
              fill={s.color}
              fillOpacity={0.06}
              isAnimationActive={false}
            />
          ))}
          <Tooltip
            contentStyle={{
              border: "1px solid var(--border)",
              borderRadius: 6,
              boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
              fontSize: 13,
            }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
