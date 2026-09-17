import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import { History, Clock, AlertCircle } from 'lucide-react';

export const HistoricoPage: React.FC = () => {
  const { t } = useTheme();

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 className="num" style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: 700, color: t.text }}>
          Histórico
        </h1>
        <div style={{ fontSize: '12.5px', color: t.textMuted }}>
          Consolidado mensal a partir de indicadores_fabricante
        </div>
      </div>

      {/* Em Manutenção Container */}
      <div
        style={{
          background: t.surface,
          border: `1px solid ${t.border}`,
          borderRadius: '16px',
          padding: '48px 24px',
          textAlign: 'center',
          maxWidth: '620px',
          margin: '40px auto 0',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            background: 'rgba(227, 6, 19, 0.1)',
            border: '1px solid rgba(227, 6, 19, 0.2)',
            color: t.primary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
          }}
        >
          <History size={32} />
        </div>

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 12px',
            borderRadius: '20px',
            background: 'rgba(234, 179, 8, 0.12)',
            border: '1px solid rgba(234, 179, 8, 0.3)',
            color: '#eab308',
            fontSize: '12px',
            fontWeight: 700,
            marginBottom: '16px',
          }}
        >
          <Clock size={14} />
          <span>Em Manutenção</span>
        </div>

        <h2 style={{ margin: '0 0 10px', fontSize: '20px', fontWeight: 700, color: t.text }}>
          Histórico em Manutenção
        </h2>

        <p
          style={{
            margin: '0 auto 24px',
            fontSize: '13.5px',
            color: t.textSecondary,
            lineHeight: 1.6,
            maxWidth: '480px',
          }}
        >
          Esta página está passando por ajustes e melhorias no consolidado mensal de indicadores e voltará em breve.
        </p>

        <div
          style={{
            background: t.bgSecondary,
            border: `1px solid ${t.border}`,
            borderRadius: '10px',
            padding: '14px 18px',
            fontSize: '12.5px',
            color: t.textMuted,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            textAlign: 'left',
          }}
        >
          <AlertCircle size={18} color={t.textSecondary} style={{ flexShrink: 0 }} />
          <span>
            Para consultar dados históricos consolidados, utilize por enquanto o módulo Análises.
          </span>
        </div>
      </div>
    </div>
  );
};
