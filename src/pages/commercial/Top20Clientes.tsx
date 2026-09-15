import React from 'react';
import { useTheme } from '../../context/ThemeContext';

export const Top20ClientesPage: React.FC = () => {
  const { t } = useTheme();

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h1 className="num" style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: t.text }}>TOP 20 Clientes</h1>
          <p style={{ margin: 0, fontSize: 13, color: t.textSecondary }}>Em construção.</p>
        </div>
      </div>
    </div>
  );
};
