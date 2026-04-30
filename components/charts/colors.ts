/**
 * A consistent palette for chart series so the doughnut and bar chart agree on
 * "Direct" being the same colour across views.
 */
export const CHART_PALETTE = [
  "hsl(187 100% 60%)", // cyan
  "hsl(142 90% 55%)", // green
  "hsl(265 90% 70%)", // violet
  "hsl(38 95% 60%)", // amber
  "hsl(330 90% 65%)", // pink
  "hsl(210 90% 65%)", // sky
  "hsl(15 90% 65%)", // orange
  "hsl(160 70% 50%)", // teal
  "hsl(280 70% 65%)", // purple
  "hsl(50 90% 60%)", // yellow
];

export function paletteFor(index: number): string {
  return CHART_PALETTE[index % CHART_PALETTE.length];
}
