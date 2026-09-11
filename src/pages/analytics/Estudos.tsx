import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import { EmptyBlock } from '../../components/common/DataState';
import { FileText } from 'lucide-react';

export const EstudosPage: React.FC = () => {
  const { t } = useTheme();
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h1 className="num" style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: t.text }}>Estudos</h1>
        <p style={{ margin: 0, fontSize: 13, color: t.textSecondary, display: 'flex', alignItems: 'center', gap: 6 }}>
          <FileText size={14} /> Ainda não há endpoint de estudos no backend. Dados simulados foram removidos.
        </p>
      </div>
      <EmptyBlock title="Sem estudos no banco" description="Quando a API de estudos estiver disponível, os registros do database aparecerão aqui." />
    </div>
  );
};
