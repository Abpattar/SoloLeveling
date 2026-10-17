/**
 * INTEGRATION CONTRACT: LOCAL-WORKAROUND (A6) — shared UI
 * Purpose: a dependency-free bar chart for daily values. `react-native-svg` only; no chart library.
 *          Renders sanely with zero, one or many bars (GAT-042). Bars are never colour-coded by
 *          anything medical — colour only distinguishes the series from the target line.
 *          RELOCATION: see `LineChart.tsx` in this folder for why these charts are not under
 *          `progress/charts/` as AGENT_06_PROMPT.md §3 states.
 * Canonical definition: AGENT_06_PROMPT.md §3 (chart requirements, relocated as above)
 * Consumers: ProgressScreen.tsx
 * Contract status: APPROVED (local workaround, no registry ID)
 */
import React from 'react';
import { View } from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';
import { AppText } from '../AppText';
import { useTheme } from '../theme';

export interface BarChartPoint {
  label: string;
  value: number;
}

export interface BarChartProps {
  title: string;
  points: BarChartPoint[];
  /** Optional horizontal reference line, e.g. a user-set target. */
  referenceLines?: Array<{ label: string; value: number }>;
  unit?: string;
  height?: number;
  accessibilitySummary?: string;
}

const PADDING = { top: 12, right: 12, bottom: 22, left: 44 };

export function BarChart({
  title,
  points,
  referenceLines = [],
  unit = '',
  height = 180,
  accessibilitySummary,
}: BarChartProps): React.JSX.Element {
  const theme = useTheme();

  if (points.length === 0) {
    return (
      <View>
        <AppText variant="label" muted>
          {title}
        </AppText>
        <AppText variant="caption" muted>
          No data yet.
        </AppText>
      </View>
    );
  }

  const values = [...points.map((point) => point.value), ...referenceLines.map((l) => l.value)].filter(
    (value) => Number.isFinite(value),
  );
  const maxRaw = Math.max(...values, 0);
  const max = maxRaw <= 0 ? 1 : maxRaw;

  const width = 320;
  const plotWidth = width - PADDING.left - PADDING.right;
  const plotHeight = height - PADDING.top - PADDING.bottom;
  const slot = plotWidth / points.length;
  const barWidth = Math.max(2, Math.min(18, slot * 0.6));

  const summary =
    accessibilitySummary ??
    `${title}: ${points.length} days, highest ${maxRaw}${unit}`;

  return (
    <View accessibilityLabel={summary} accessible>
      <AppText variant="label" muted>
        {title}
      </AppText>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {referenceLines.map((line) => {
          const lineY = PADDING.top + plotHeight - (line.value / max) * plotHeight;
          return (
            <Line
              key={`ref-${line.label}`}
              x1={PADDING.left}
              y1={lineY}
              x2={width - PADDING.right}
              y2={lineY}
              stroke={theme.colors.textMuted}
              strokeDasharray="4 4"
              strokeWidth={1}
            />
          );
        })}
        <Line
          x1={PADDING.left}
          y1={PADDING.top + plotHeight}
          x2={width - PADDING.right}
          y2={PADDING.top + plotHeight}
          stroke={theme.colors.border}
          strokeWidth={1}
        />
        <SvgText x={4} y={PADDING.top + 4} fill={theme.colors.textMuted} fontSize={9}>
          {Math.round(max)}
        </SvgText>
        <SvgText x={4} y={PADDING.top + plotHeight} fill={theme.colors.textMuted} fontSize={9}>
          0
        </SvgText>
        {points.map((point, index) => {
          const value = Number.isFinite(point.value) ? Math.max(0, point.value) : 0;
          const barHeight = (value / max) * plotHeight;
          const x = PADDING.left + index * slot + (slot - barWidth) / 2;
          return (
            <Rect
              key={`${point.label}-${index}`}
              x={x}
              y={PADDING.top + plotHeight - barHeight}
              width={barWidth}
              height={Math.max(0, barHeight)}
              fill={theme.colors.primary}
              rx={2}
            />
          );
        })}
        {points.length > 0 ? (
          <>
            <SvgText x={PADDING.left} y={height - 6} fill={theme.colors.textMuted} fontSize={9}>
              {points[0]?.label}
            </SvgText>
            <SvgText
              x={width - PADDING.right}
              y={height - 6}
              fill={theme.colors.textMuted}
              fontSize={9}
              textAnchor="end"
            >
              {points[points.length - 1]?.label}
            </SvgText>
          </>
        ) : null}
      </Svg>
    </View>
  );
}