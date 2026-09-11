import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useGlobalFilter } from '../../context/GlobalFilterContext';
import { PeriodSelector } from '../../components/common/PeriodSelector';
import { Sparkles, TrendingUp, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';

export const InsightsPage: React.FC = () => {
  const { t } = useTheme();
  const { selectedPeriod, periodMetrics } = useGlobalFilter();

  const insights = [
    {
      tipo: 'oportunidade',
      titulo: 'Recuperação de 42 Clientes Inativos em ARCOR',
      descricao:
        'A equipe TRAB ALFA possui 42 clientes que compravam balas e chocolates nos últimos 60 dias, mas ainda não positivaram no período selecionado. O potencial estimado é de R$ 74.000 em faturamento adicional.',
      impacto: '+R$ 74.000',
      prioridade: 'Alta',
    },
    {
      tipo: 'alerta',
      titulo: 'Concentração Elevada no Top 5 de Clientes',
      descricao:
        'Os 5 principais clientes respondem por 35,6% do faturamento total. Recomenda-se diversificar a carteira para mitigar risco operacional de crédito e sazonalidade.',
      impacto: 'Risco Médio',
      prioridade: 'Média',
    },
    {
      tipo: 'sucesso',
      titulo: 'Superação de Meta em UNILEVER na Gerência TRAD',
      descricao:
        'O atingimento do mix de sabão em pó e amaciante superou a cota mensal em 105,4%, gerando aumento de 0,8 p.p. na margem bruta consolidada.',
      impacto: '+0,8 p.p. Margem',
      prioridade: 'Positiva',
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 className="num" style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: 700, color: t.text }}>
            Insights Comerciais & Recomendações
          </h1>
          <p style={{ margin: 0, fontSize: '13px', color: t.textSecondary }}>
            Diagnósticos automatizados de gaps, oportunidades de positivação e variações críticas de faturamento.
          </p>
        </div>

        <PeriodSelector />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {insights.map((ins, idx) => (
          <div
            key={idx}
            style={{
              background: t.surface,
              border: `1px solid ${t.border}`,
              borderRadius: '12px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                <Sparkles size={16} color={t.primary} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: '14.5px', fontWeight: 700, color: t.text }}>{ins.titulo}</span>
              </div>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  padding: '3px 10px',
                  borderRadius: '6px',
                  background: ins.tipo === 'sucesso' ? 'rgba(61, 214, 140, 0.12)' : ins.tipo === 'oportunidade' ? 'rgba(232, 179, 57, 0.12)' : 'rgba(227, 6, 19, 0.12)',
                  color: ins.tipo === 'sucesso' ? '#3DD68C' : ins.tipo === 'oportunidade' ? '#E8B339' : t.primaryHover,
                }}
              >
                {ins.impacto}
              </span>
            </div>

            <p style={{ margin: 0, fontSize: '13px', color: t.textSecondary, lineHeight: 1.6 }}>
              {ins.descricao}
            </p>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', paddingTop: '8px', borderTop: `1px solid ${t.border}` }}>
              <span style={{ fontSize: '12px', color: t.textMuted }}>Contexto ativo: {selectedPeriod}</span>
              <span style={{ fontSize: '12px', fontWeight: 600, color: t.primary, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                Explorar Plano de Ação <ArrowRight size={13} />
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
