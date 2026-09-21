import React from 'react';

interface ScrollableChartProps {
  /** Largura mínima (px) do gráfico; abaixo disso aparece scroll horizontal em vez de espremer. */
  minWidth: number;
  height?: number | string;
  children: React.ReactNode;
}

/** Envolve um <ResponsiveContainer height="100%"> e habilita rolagem horizontal quando faltar espaço. */
export const ScrollableChart: React.FC<ScrollableChartProps> = ({ minWidth, height = '100%', children }) => (
  <div style={{ width: '100%', height, overflowX: 'auto', overflowY: 'hidden' }}>
    <div style={{ width: '100%', minWidth, height: '100%' }}>{children}</div>
  </div>
);
