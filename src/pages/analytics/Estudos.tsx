import React, { useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { Plus, X, FileText } from 'lucide-react';

const ESTUDOS_INICIAIS = [
  { id: 1, titulo: 'Impacto da queda de cobertura em ARCOR — 3º trim.', periodo: 'Jul–Set/2026', responsavel: 'Ramon', data: '05/09/2026', status: 'Concluído',
    descricao: 'Avaliação da queda de cobertura no fabricante ARCOR na equipe TRAB ALFA.',
    conclusao: 'Queda concentrada em 12 clientes que migraram para concorrência local; recomendada ação comercial direcionada.' },
  { id: 2, titulo: 'Concentração de faturamento — Top 20 clientes AS', periodo: '1º semestre 2026', responsavel: 'Ramon', data: '28/08/2026', status: 'Concluído',
    descricao: 'Estudo de concentração de faturamento nos 20 maiores clientes da gerência AS.',
    conclusao: 'Top 20 responde por 62% do faturamento da gerência — risco de concentração acima do saudável.' },
  { id: 3, titulo: 'Projeção de atingimento — Setembro/2026', periodo: 'Setembro/2026', responsavel: 'Ramon', data: '08/09/2026', status: 'Em andamento',
    descricao: 'Projeção do atingimento de meta da empresa considerando ritmo diário dos últimos 10 dias úteis.',
    conclusao: '' },
];

export const EstudosPage: React.FC = () => {
  const { t } = useTheme();
  const [estudos, setEstudos] = useState(ESTUDOS_INICIAIS);
  const [selecionado, setSelecionado] = useState(ESTUDOS_INICIAIS[0]);
  const [criando, setCriando] = useState(false);

  // New study form state
  const [novoTitulo, setNovoTitulo] = useState('');
  const [novoPeriodo, setNovoPeriodo] = useState('');
  const [novaDescricao, setNovaDescricao] = useState('');
  const [novaConclusao, setNovaConclusao] = useState('');

  const statusColor = (s: string) => (s === 'Concluído' ? '#3DD68C' : s === 'Em andamento' ? '#E8B339' : t.textMuted);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoTitulo.trim()) return;

    const novo = {
      id: Date.now(),
      titulo: novoTitulo,
      periodo: novoPeriodo || 'Setembro/2026',
      responsavel: 'Usuário Ativo',
      data: 'Hoje',
      status: 'Em andamento',
      descricao: novaDescricao || 'Análise comercial iniciada.',
      conclusao: novaConclusao || '',
    };

    setEstudos([novo, ...estudos]);
    setSelecionado(novo);
    setCriando(false);
    setNovoTitulo('');
    setNovoPeriodo('');
    setNovaDescricao('');
    setNovaConclusao('');
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 className="num" style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: 700, color: t.text }}>
            Estudos Comerciais & Diagnósticos
          </h2>
          <div style={{ fontSize: '12.5px', color: t.textMuted }}>
            Registro e acompanhamento de análises aprofundadas com conclusão, dados e histórico
          </div>
        </div>

        <button
          onClick={() => setCriando(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
            fontWeight: 600,
            padding: '8px 14px',
            borderRadius: '8px',
            border: 'none',
            background: t.primary,
            color: '#fff',
            cursor: 'pointer',
            boxShadow: '0 2px 10px rgba(227, 6, 19, 0.3)',
          }}
        >
          <Plus size={14} color="#fff" />
          <span>Novo Estudo</span>
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '18px', alignItems: 'start' }} className="estudos-grid">
        {/* Lista */}
        <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: '12px', overflow: 'hidden' }}>
          {estudos.map((e) => (
            <div
              key={e.id}
              onClick={() => { setSelecionado(e); setCriando(false); }}
              style={{
                padding: '14px 16px',
                borderBottom: `1px solid ${t.border}`,
                cursor: 'pointer',
                background: !criando && selecionado?.id === e.id ? t.surfaceElevated : 'transparent',
                borderLeft: !criando && selecionado?.id === e.id ? `3px solid ${t.primary}` : '3px solid transparent',
              }}
            >
              <div style={{ fontSize: '13.5px', fontWeight: 600, marginBottom: '6px', lineHeight: 1.3, color: t.text }}>
                {e.titulo}
              </div>
              <div style={{ fontSize: '12px', color: t.textMuted, marginBottom: '6px' }}>{e.periodo}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11.5px', fontWeight: 600, color: statusColor(e.status) }}>● {e.status}</span>
                <span style={{ fontSize: '11.5px', color: t.textMuted }}>{e.data}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Detalhe / criação */}
        <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: '12px', padding: '24px' }}>
          {criando ? (
            <form onSubmit={handleCreate}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                <div style={{ fontSize: '16px', fontWeight: 600, color: t.text }}>Criar Novo Estudo</div>
                <button type="button" onClick={() => setCriando(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: t.textMuted }}>
                  <X size={18} />
                </button>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '12.5px', color: t.textSecondary, display: 'block', marginBottom: '6px' }}>Título do Estudo</label>
                <input
                  value={novoTitulo}
                  onChange={(e) => setNovoTitulo(e.target.value)}
                  placeholder="Ex.: Queda de positivação — Equipe TRAB BETA"
                  required
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${t.border}`, background: t.bgSecondary, color: t.text, fontSize: '13.5px', fontFamily: "'Inter', sans-serif" }}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '12.5px', color: t.textSecondary, display: 'block', marginBottom: '6px' }}>Período de Análise</label>
                <input
                  value={novoPeriodo}
                  onChange={(e) => setNovoPeriodo(e.target.value)}
                  placeholder="Ex.: Agosto/2026 ou 3º Trimestre"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${t.border}`, background: t.bgSecondary, color: t.text, fontSize: '13.5px', fontFamily: "'Inter', sans-serif" }}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '12.5px', color: t.textSecondary, display: 'block', marginBottom: '6px' }}>Descrição e Metodologia</label>
                <textarea
                  rows={3}
                  value={novaDescricao}
                  onChange={(e) => setNovaDescricao(e.target.value)}
                  placeholder="Descreva o escopo, amostra e motivo do estudo..."
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${t.border}`, background: t.bgSecondary, color: t.text, fontSize: '13.5px', fontFamily: "'Inter', sans-serif", resize: 'vertical' }}
                />
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={{ fontSize: '12.5px', color: t.textSecondary, display: 'block', marginBottom: '6px' }}>Conclusão Preliminar / Ações</label>
                <textarea
                  rows={3}
                  value={novaConclusao}
                  onChange={(e) => setNovaConclusao(e.target.value)}
                  placeholder="O que este estudo concluiu..."
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${t.border}`, background: t.bgSecondary, color: t.text, fontSize: '13.5px', fontFamily: "'Inter', sans-serif", resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setCriando(false)} style={{ padding: '9px 16px', borderRadius: '8px', border: `1px solid ${t.border}`, background: 'transparent', color: t.textSecondary, fontSize: '13px', cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button type="submit" style={{ padding: '9px 18px', borderRadius: '8px', border: 'none', background: t.primary, color: '#fff', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
                  Salvar Estudo
                </button>
              </div>
            </form>
          ) : selecionado ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px', gap: '12px' }}>
                <div style={{ fontSize: '17px', fontWeight: 600, lineHeight: 1.3, color: t.text }}>{selecionado.titulo}</div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: statusColor(selecionado.status), whiteSpace: 'nowrap' }}>● {selecionado.status}</span>
              </div>
              <div style={{ fontSize: '12.5px', color: t.textMuted, marginBottom: '20px' }}>
                {selecionado.periodo} · Responsável: {selecionado.responsavel} · Criado em {selecionado.data}
              </div>
              <div style={{ marginBottom: '18px' }}>
                <div style={{ fontSize: '12.5px', color: t.textSecondary, fontWeight: 600, marginBottom: '6px' }}>Descrição</div>
                <div style={{ fontSize: '13.5px', color: t.text, lineHeight: 1.6 }}>{selecionado.descricao}</div>
              </div>
              <div>
                <div style={{ fontSize: '12.5px', color: t.textSecondary, fontWeight: 600, marginBottom: '6px' }}>Conclusão</div>
                <div style={{ fontSize: '13.5px', color: selecionado.conclusao ? t.text : t.textMuted, lineHeight: 1.6, fontStyle: selecionado.conclusao ? 'normal' : 'italic' }}>
                  {selecionado.conclusao || 'Estudo ainda em andamento — conclusão pendente.'}
                </div>
              </div>
            </>
          ) : (
            <div style={{ color: t.textMuted, fontSize: '13.5px' }}>Selecione um estudo na lista ao lado.</div>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 860px) {
          .estudos-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
};
