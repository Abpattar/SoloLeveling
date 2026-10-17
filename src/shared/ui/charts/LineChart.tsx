/**
 * INTEGRATION CONTRACT: LOCAL-WORKAROUND (A6) — shared UI
 * Purpose: a dependency-free line chart. `react-native-svg` only — CONTRACT §1 forbids a chart
 *          library. It renders sanely with zero, one or many points, and never crashes on an empty
 *          range (GAT-042).
 *          RELOCATION: AGENT_06_PROMPT.md §3 puts this file in `progress/charts/`, but CONTRACT §2.8
 *          allows `progress → body` and never `body → progress`, while CMP-BODY-001 also needs a
 *          weight chart. A dependency-free presentational component belongs in shared UI, so the file
 *          lives at `shared/ui/charts/LineChart.tsx` and both modules reach it by deep path. This
 *          keeps every allowed module edge intact and avoids a `body ↔ progress` cycle.
 * Canonical definition: AGENT_06_PROMPT.md §3 (chart requirements, relocated as above)
 * Consumers: ProgressScreen.tsx, MeasurementsScreen.tsx
 * Contract status: APPROVED (local workaround, no registry ID)
 */
import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { AppText } from '../AppText';
import { useTheme } from '../theme';

export interface LineChartPoint {
  label: string;
  value: number;
}

export interface LineChartProps {
  title: string;
  points: LineChartPoint[];
  /** Optional second series drawn thinner, e.g. a trailing average. */
  averagePoints?: LineChartPoint[];
  /** Optional horizontal reference lines, e.g. a user-set target. */
  referenceLines?: Array<{ label: string; value: number }>;
  unit?: string;
  height?: number;
  accessibilitySummary?: string;
}

const PADDING = { top: 12, right: 12, bottom: 22, left: 40 };

export function LineChart({
  title,
  points,
  averagePoints = [],
  referenceLines = [],
  unit = '',
  height = 180,
  accessibilitySummary,
}: LineChartProps): React.JSX.Element {
  const theme = useTheme();

  if (points.length === 0 && averagePoints.length === 0) {
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

  const allValues = [
    ...points.map((point) => point.value),
    ...averagePoints.map((point) => point.value),
    ...referenceLines.map((line) => line.value),
  ].filter((value) => Number.isFinite(value));

  // A flat series still needs a visible height, so widen the range by 1 kg / unit when it collapses.
  let min = Math.min(...allValues);
  let max = Math.max(...allValues);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const span = max - min || 1;

  const width = 320;
  const plotWidth = width - PADDING.left - PADDING.right;
  const plotHeight = height - PADDING.top - PADDING.bottom;

  const x = (index: number, total: number): number =>
    PADDING.left + (total <= 1 ? plotWidth / 2 : (index / (total - 1)) * plotWidth);
  const y = (value: number): number => PADDING.top + plotHeight - ((value - min) / span) * plotHeight;

  const pathFor = (series: LineChartPoint[]): string => {
    if (series.length === 0) {
      return '';
    }
    if (series.length === 1) {
      return '';
    }
    return series
      .map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index, series.length)} ${y(point.value)}`)
      .join(' ');
  };

  const summary =
    accessibilitySummary ??
    (points.length === 0
      ? `${title}: no data`
      : `${title}: ${points.length} points, from ${points[0]?.value}${unit} to ${
          points[points.length - 1]?.value
        }${unit}`);

  return (
    <View accessibilityLabel={summary} accessible>
      <AppText variant="label" muted>
        {title}
      </AppText>
      {points.length === 0 ? (
        <AppText variant="caption" muted>
          No data yet.
        </AppText>
      ) : (
        <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
          {referenceLines.map((line) => (
            <Line
              key={`ref-${line.label}`}
              x1={PADDING.left}
              y1={y(line.value)}
              x2={width - PADDING.right}
              y2={y(line.value)}
              stroke={theme.colors.textMuted}
              strokeDasharray="4 4"
              strokeWidth={1}
            />
          ))}
          <Line
            x1={PADDING.left}
            y1={PADDING.top}
            x2={PADDING.left}
            y2={PADDING.top + plotHeight}
            stroke={theme.colors.border}
            strokeWidth={1}
          />
          <SvgText x={4} y={PADDING.top + 4} fill={theme.colors.textMuted} fontSize={9}>
            {max.toFixed(1)}
          </SvgText>
          <SvgText
            x={4}
            y={PADDING.top + plotHeight}
            fill={theme.colors.textMuted}
            fontSize={9}
          >
            {min.toFixed(1)}
          </SvgText>
          <Path
            d={pathFor(points)}
            fill="none"
            stroke={theme.colors.primary}
            strokeWidth={2}
            strokeLinejoin="round"
          />
          {points.length === 1 ? (
            <Circle
              cx={x(0, 1)}
              cy={y((points[0] as LineChartPoint).value)}
              r={4}
              fill={theme.colors.primary}
            />
          ) : null}
          {averagePoints.length > 0 ? (
            <Path
              d={pathFor(averagePoints)}
              fill="none"
              stroke={theme.colors.warning}
              strokeWidth={1.5}
              strokeDasharray="5 4"
            />
          ) : null}
          {points.length > 0 ? (
            <SvgText
              x={PADDING.left}
              y={height - 6}
              fill={theme.colors.textMuted}
              fontSize={9}
            >
              {points[0]?.label}
            </SvgText>
          ) : null}
          {points.length > 1 ? (
            <SvgText
              x={width - PADDING.right}
              y={height - 6}
              fill={theme.colors.textMuted}
              fontSize={9}
              textAnchor="end"
            >
              {points[points.length - 1]?.label}
            </SvgText>
          ) : null}
        </Svg>
      )}
    </View>
  );
}