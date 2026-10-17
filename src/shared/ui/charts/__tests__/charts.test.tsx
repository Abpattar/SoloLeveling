import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { BarChart } from '../BarChart';
import { LineChart } from '../LineChart';
import type { BarChartPoint } from '../BarChart';
import type { LineChartPoint } from '../LineChart';

/** SVG text nodes render as RNSVGText, not RN Text, so they are asserted on the tree. */
function rendered(): string {
  return JSON.stringify(screen.toJSON());
}

function line(points: Array<[string, number]>): LineChartPoint[] {
  return points.map(([label, value]) => ({ label, value }));
}

function bars(points: Array<[string, number]>): BarChartPoint[] {
  return points.map(([label, value]) => ({ label, value }));
}

describe('LineChart (GAT-042)', () => {
  it('renders with no points and does not crash', async () => {
    await render(<LineChart title="Weight trend" points={[]} />);

    expect(screen.getByText('No data yet.')).toBeTruthy();
  });

  it('renders a single point', async () => {
    await render(<LineChart title="Weight trend" points={line([['10 Mar', 80]])} />);

    expect(screen.getByText('Weight trend')).toBeTruthy();
    expect(rendered()).toContain('10 Mar');
  });

  it('renders many points with both axis ends labelled', async () => {
    await render(
      <LineChart
        title="Weight trend"
        points={line([
          ['1 Mar', 80],
          ['5 Mar', 81],
          ['10 Mar', 79.5],
        ])}
      />,
    );

    expect(rendered()).toContain('1 Mar');
    expect(rendered()).toContain('10 Mar');
expect(rendered()).toContain('81.0');
expect(rendered()).toContain('79.5');
  });

  it('renders a flat series without dividing by a zero range', async () => {
    await render(
      <LineChart
        title="Weight trend"
        points={line([
          ['1 Mar', 80],
          ['2 Mar', 80],
        ])}
      />,
    );

    expect(screen.getByText('Weight trend')).toBeTruthy();
    expect(rendered()).toContain('1 Mar');
  });

  it('exposes an accessibility summary', async () => {
    await render(
      <LineChart
        title="Weight trend"
        points={line([
          ['1 Mar', 80],
          ['2 Mar', 81],
        ])}
        accessibilitySummary="Weight trend: 2 points, rising"
      />,
    );

    expect(screen.getByLabelText('Weight trend: 2 points, rising')).toBeTruthy();
  });

  it('renders the average series and reference lines together', async () => {
    await render(
      <LineChart
        title="Weight trend"
        points={line([
          ['1 Mar', 80],
          ['2 Mar', 81],
        ])}
        averagePoints={line([
          ['1 Mar', 80],
          ['2 Mar', 80.5],
        ])}
        referenceLines={[{ label: 'target', value: 75 }]}
      />,
    );

    expect(screen.getByText('Weight trend')).toBeTruthy();
  });

  it('handles negative values', async () => {
    await render(
      <LineChart
        title="Change"
        points={line([
          ['1 Mar', -3],
          ['2 Mar', -1],
        ])}
      />,
    );

    expect(rendered()).toContain('-3.0');
  });
});

describe('BarChart (GAT-042)', () => {
  it('renders with no points and does not crash', async () => {
    await render(<BarChart title="Daily calories" points={[]} />);

    expect(screen.getByText('No data yet.')).toBeTruthy();
  });

  it('renders a single bar', async () => {
    await render(<BarChart title="Daily calories" points={bars([['10 Mar', 2000]])} />);

    expect(screen.getByText('Daily calories')).toBeTruthy();
    expect(rendered()).toContain('10 Mar');
  });

  it('renders many bars and labels both ends', async () => {
    await render(
      <BarChart
        title="Daily calories"
        points={bars([
          ['1 Mar', 2000],
          ['2 Mar', 2400],
          ['3 Mar', 1800],
        ])}
      />,
    );

    expect(rendered()).toContain('1 Mar');
    expect(rendered()).toContain('3 Mar');
  });

  it('renders all-zero values without crashing', async () => {
    await render(
      <BarChart
        title="Daily calories"
        points={bars([
          ['1 Mar', 0],
          ['2 Mar', 0],
        ])}
      />,
    );

    expect(screen.getByText('Daily calories')).toBeTruthy();
  });

  it('renders a reference line for a user-set target', async () => {
    await render(
      <BarChart
        title="Daily calories"
        points={bars([['1 Mar', 2000]])}
        referenceLines={[{ label: 'your calorie target', value: 2200 }]}
        accessibilitySummary="Daily calories: 1 days, highest 2200 kcal"
      />,
    );

    expect(screen.getByLabelText('Daily calories: 1 days, highest 2200 kcal')).toBeTruthy();
  });

  it('ignores a non-finite value instead of crashing', async () => {
    await render(
      <BarChart
        title="Daily calories"
        points={bars([
          ['1 Mar', Number.NaN],
          ['2 Mar', 2000],
        ])}
      />,
    );

    expect(screen.getByText('Daily calories')).toBeTruthy();
  });
});