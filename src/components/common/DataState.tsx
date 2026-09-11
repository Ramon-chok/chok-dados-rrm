import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import { AlertCircle, Database } from 'lucide-react';

export const LoadingBlock: React.FC<{ label?: string }> = ({ label = 'Carregando dados do banco...' }) => {
  const { t } = useTheme();
  return (
    <div style={{ padding: '40px 20px', textAlign: 'center', color: t.textSecondary, fontSize: '13.5px' }}>
      {label}
    </div>
  );
};

export const ErrorBlock: React.FC<{ message: string }> = ({ message }) => {
  const { t } = useTheme();
  return (
    <div
      style={{
        margin: '20px 0',
        padding: '16px 18px',
        borderRadius: '10px',
        border: `1px solid ${t.border}`,
        background: t.surface,
        color: t.text,
        display: 'flex',
        gap: '10px',
        alignItems: 'flex-start',
        fontSize: '13.5px',
      }}
    >
      <AlertCircle size={18} color={t.primary} style={{ flexShrink: 0, marginTop: 2 }} />
      <div>
        <strong style={{ display: 'block', marginBottom: 4 }}>Não foi possível carregar os dados</strong>
        <span style={{ color: t.textSecondary }}>{message}</span>
      </div>
    </div>
  );
};

export const EmptyBlock: React.FC<{ title?: string; description?: string }> = ({
  title = 'Sem dados no banco',
  description = 'Nenhum registro encontrado para os filtros atuais. Importe planilhas ou ajuste o período.',
}) => {
  const { t } = useTheme();
  return (
    <div
      style={{
        margin: '20px 0',
        padding: '36px 20px',
        borderRadius: '12px',
        border: `1px dashed ${t.border}`,
        background: t.surface,
        textAlign: 'center',
        color: t.textSecondary,
      }}
    >
      <Database size={28} style={{ marginBottom: 10, opacity: 0.7 }} />
      <div style={{ fontWeight: 600, color: t.text, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: '13px', maxWidth: 420, margin: '0 auto' }}>{description}</div>
    </div>
  );
};
