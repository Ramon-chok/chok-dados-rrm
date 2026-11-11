import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  CalendarRange,
  TrendingUp,
  Users,
  Layers,
  ShoppingCart,
  Receipt,
  Percent,
  Info,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { KpiBloco, KpiPeriodo, KpisDiaMesResponse } from '../../lib/insights';

/**
 * Seção 5 — indicadores principais (Faturamento, Cobertura e Sortimento) em
 * duas leituras: **DIA** e **MÊS**.
 *
 * A troca é feita deslizando o dedo para o lado, exatamente como pedido; no
 * desktop há setas e, nos dois casos, as abas "Dia"/"Mês" funcionam por toque.
 *
 * Como foi feito: um contêiner com `scroll-snap` (classe `.ga-swipe`, em
 * index.css). O gesto é o próprio scroll horizontal nativo — ele já tem
 * inércia, acompanha o dedo e respeita `prefers-reduced-motion`, coisas que uma
 * implementação manual de arrastar costuma perder. O `scroll` só é observado
 * para marcar qual painel está ativo.
 */

const PERIODOS = [
  { id: 'dia' as const, titulo: 'Dia', icone: CalendarDays, descricao: 'Resultado do dia' },
  { id: 'mes' as const, titulo: 'Mês', icone: CalendarRange, descricao: 'Acumulado do mês' },
];

const fmtBRL = (v: number) => `R$ ${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
const fmtInt = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
const fmtPct = (v: number) => `${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

function dataExtensa(iso: string | null): string {
  if (!iso) return '';
  const [ano, mes, dia] = iso.slice(0, 10).split('-').map(Number);
  return new Date(ano, (mes || 1) - 1, dia || 1).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
  });
}

interface IndicadorProps {
  titulo: string;
  bloco: KpiBloco;
  formatar: (v: number) => string;
  icone: React.ReactNode;
}

const CardIndicador: React.FC<IndicadorProps> = ({ titulo, bloco, formatar, icone }) => {
  const { t } = useTheme();
  const corStatus = bloco.pct >= 100 ? t.success : bloco.pct >= 80 ? t.warning : t.danger;
  const progresso = Math.max(0, Math.min(100, bloco.pct));

  return (
    <div
      className="ga-card ga-card-hover"
      style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: t.textMuted,
          }}
        >
          {titulo}
        </span>
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: `${t.accentTeal}1A`,
            color: t.accentTeal,
            flexShrink: 0,
          }}
        >
          {icone}
        </span>
      </div>

      <div className="num" style={{ fontSize: 26, fontWeight: 700, color: t.text, lineHeight: 1.1 }}>
        {formatar(bloco.realizado)}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span className="num" style={{ fontSize: 13, fontWeight: 700, color: corStatus }}>
          {fmtPct(bloco.pct)}
        </span>
        <span style={{ fontSize: 11.5, color: t.textMuted }}>da meta {formatar(bloco.meta)}</span>
      </div>

      <div style={{ height: 5, borderRadius: 3, background: t.surfaceElevated, overflow: 'hidden' }}>
        <div
          style={{
            width: `${progresso}%`,
            height: '100%',
            borderRadius: 3,
            background: `linear-gradient(90deg, ${t.gradientFrom}, ${t.gradientTo})`,
            transition: 'width 0.5s ease',
          }}
        />
      </div>

      <div className="num" style={{ fontSize: 11.5, color: bloco.gap >= 0 ? t.success : t.danger }}>
        {bloco.gap >= 0 ? '+' : ''}
        {formatar(bloco.gap)} <span style={{ color: t.textMuted }}>vs. meta</span>
      </div>
    </div>
  );
};

const Secundario: React.FC<{ rotulo: string; valor: string; icone: React.ReactNode }> = ({ rotulo, valor, icone }) => {
  const { t } = useTheme();
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px',
        borderRadius: 10,
        background: t.surfaceElevated,
        border: `1px solid ${t.border}`,
        flex: '1 1 150px',
        minWidth: 0,
      }}
    >
      <span style={{ color: t.accentBlueLight, display: 'flex', flexShrink: 0 }}>{icone}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 10.5, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {rotulo}
        </div>
        <div className="num" style={{ fontSize: 14, fontWeight: 700, color: t.text }}>
          {valor}
        </div>
      </div>
    </div>
  );
};

const Painel: React.FC<{ dados: KpiPeriodo; legenda: string; aviso?: string | null }> = ({
  dados,
  legenda,
  aviso,
}) => {
  const { t } = useTheme();
  return (
    <section
      aria-label={legenda}
      style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '2px 2px 8px' }}
    >
      {aviso && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            padding: '9px 12px',
            borderRadius: 9,
            background: `${t.warning}14`,
            border: `1px solid ${t.warning}44`,
            fontSize: 11.5,
            color: t.textSecondary,
            lineHeight: 1.5,
          }}
        >
          <Info size={14} color={t.warning} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{aviso}</span>
        </div>
      )}
      {dados.semDados ? (
        <div
          className="ga-card"
          style={{ padding: 24, textAlign: 'center', color: t.textMuted, fontSize: 13 }}
        >
          Ainda não há carga para este período. Os números aparecem assim que a importação
          correspondente for feita.
        </div>
      ) : (
        <>
          <div className="kpi-grid">
            <CardIndicador titulo="Faturamento" bloco={dados.faturamento} formatar={fmtBRL} icone={<TrendingUp size={15} />} />
            <CardIndicador titulo="Cobertura" bloco={dados.cobertura} formatar={fmtInt} icone={<Users size={15} />} />
            <CardIndicador titulo="Sortimento" bloco={dados.sortimento} formatar={fmtInt} icone={<Layers size={15} />} />
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Secundario rotulo="Pedidos" valor={fmtInt(dados.pedidos)} icone={<ShoppingCart size={16} />} />
            <Secundario rotulo="Ticket médio" valor={fmtBRL(dados.ticketMedio)} icone={<Receipt size={16} />} />
            {/* Margem só existe aqui quando o perfil tem `margin.view`: sem a
                permissão o backend devolve null e o card nem é montado. */}
            {dados.margem !== null && (
              <Secundario rotulo="Margem" valor={fmtPct(dados.margem)} icone={<Percent size={16} />} />
            )}
          </div>
        </>
      )}
    </section>
  );
};

export interface KpiSwipeProps {
  dados: KpisDiaMesResponse;
  /** Rótulo do período selecionado no filtro global (ex.: "Novembro/2026"). */
  periodoLabel: string;
}

export const KpiSwipe: React.FC<KpiSwipeProps> = ({ dados, periodoLabel }) => {
  const { t } = useTheme();
  const trilho = useRef<HTMLDivElement | null>(null);
  const [ativo, setAtivo] = useState(0);

  const irPara = useCallback((indice: number) => {
    const el = trilho.current;
    if (!el) return;
    el.scrollTo({ left: indice * el.clientWidth, behavior: 'smooth' });
    setAtivo(indice);
  }, []);

  // O scroll é a fonte da verdade: vale tanto para o gesto quanto para o clique.
  useEffect(() => {
    const el = trilho.current;
    if (!el) return;
    let frame = 0;
    const aoRolar = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const indice = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
        setAtivo((anterior) => (anterior === indice ? anterior : indice));
      });
    };
    el.addEventListener('scroll', aoRolar, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener('scroll', aoRolar);
    };
  }, []);

  // Teclado: setas ←/→ também alternam, para quem não usa mouse nem toque.
  const aoTeclar = (evento: React.KeyboardEvent) => {
    if (evento.key === 'ArrowRight') irPara(Math.min(1, ativo + 1));
    if (evento.key === 'ArrowLeft') irPara(Math.max(0, ativo - 1));
  };

  /**
   * O backend avisa quando as datas da base são cargas repetidas do mesmo
   * fechamento mensal. Nesse caso o painel do DIA não é a venda daquele dia, e
   * dizer isso é melhor do que exibir um número que o usuário interpretaria
   * errado. O aviso desaparece sozinho quando houver carga diária de verdade.
   */
  const avisoDia =
    dados.referencia.avisoCarga === 'snapshot_mensal'
      ? 'A carga atual é um fechamento mensal repetido em várias datas: este painel mostra o retrato do mês na data de referência, não a venda do dia. Para separar dia e mês, a base precisa receber movimento diário.'
      : dados.referencia.avisoCarga === 'dia_unico'
        ? 'Há uma única data de referência carregada neste período.'
        : null;

  const legendaDia = dados.referencia.diaSelecionado
    ? `${dataExtensa(dados.referencia.diaSelecionado)}${
        dados.referencia.semanaComercial ? ` · Semana ${dados.referencia.semanaComercial}` : ''
      }`
    : 'sem dia com dados no período';

  return (
    <div style={{ marginBottom: 24 }}>
      {/* Cabeçalho: abas (toque) + contexto do período */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 12,
          flexWrap: 'wrap',
        }}
      >
        <div
          role="tablist"
          aria-label="Período dos indicadores"
          style={{
            display: 'inline-flex',
            padding: 3,
            gap: 3,
            borderRadius: 10,
            background: t.surfaceElevated,
            border: `1px solid ${t.border}`,
          }}
        >
          {PERIODOS.map((periodo, indice) => {
            const Icone = periodo.icone;
            const selecionado = ativo === indice;
            return (
              <button
                key={periodo.id}
                role="tab"
                aria-selected={selecionado}
                onClick={() => irPara(indice)}
                className="ga-tap"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '7px 16px',
                  borderRadius: 8,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: selecionado ? 700 : 500,
                  color: selecionado ? '#fff' : t.textSecondary,
                  background: selecionado
                    ? `linear-gradient(135deg, ${t.gradientFrom}, ${t.gradientTo})`
                    : 'transparent',
                  transition: 'background 0.22s ease, color 0.22s ease',
                }}
              >
                <Icone size={14} />
                {periodo.titulo}
              </button>
            );
          })}
        </div>

        <div style={{ fontSize: 11.5, color: t.textMuted, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>{ativo === 0 ? legendaDia : `Acumulado de ${periodoLabel}`}</span>
          <span className="kpi-swipe-setas" style={{ display: 'inline-flex', gap: 4 }}>
            <button
              onClick={() => irPara(Math.max(0, ativo - 1))}
              disabled={ativo === 0}
              aria-label="Indicadores do dia"
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                border: `1px solid ${t.border}`,
                background: 'transparent',
                color: ativo === 0 ? t.textMuted : t.textSecondary,
                cursor: ativo === 0 ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: ativo === 0 ? 0.45 : 1,
              }}
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => irPara(Math.min(1, ativo + 1))}
              disabled={ativo === 1}
              aria-label="Indicadores do mês"
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                border: `1px solid ${t.border}`,
                background: 'transparent',
                color: ativo === 1 ? t.textMuted : t.textSecondary,
                cursor: ativo === 1 ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: ativo === 1 ? 0.45 : 1,
              }}
            >
              <ChevronRight size={14} />
            </button>
          </span>
        </div>
      </div>

      {/* Trilho deslizável */}
      <div
        ref={trilho}
        className="ga-swipe"
        tabIndex={0}
        onKeyDown={aoTeclar}
        aria-live="polite"
        style={{ gap: 0, outlineOffset: 4 }}
      >
        <Painel dados={dados.dia} legenda="Indicadores do dia" aviso={avisoDia} />
        <Painel dados={dados.mes} legenda="Indicadores do mês" />
      </div>

      {/* Pontinhos: indicação visual de qual período está selecionado */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 10 }}>
        {PERIODOS.map((periodo, indice) => (
          <button
            key={periodo.id}
            onClick={() => irPara(indice)}
            aria-label={periodo.descricao}
            style={{
              width: ativo === indice ? 22 : 7,
              height: 7,
              padding: 0,
              borderRadius: 4,
              border: 'none',
              cursor: 'pointer',
              background: ativo === indice ? t.accentTeal : t.border,
              transition: 'width 0.25s ease, background 0.25s ease',
              minHeight: 0,
            }}
          />
        ))}
      </div>

      <div style={{ textAlign: 'center', fontSize: 11, color: t.textMuted, marginTop: 6 }}>
        Deslize para o lado para alternar entre <strong>dia</strong> e <strong>mês</strong>
      </div>

      <style>{`
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }
        @media (max-width: 860px) {
          .kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 560px) {
          .kpi-grid { grid-template-columns: 1fr; }
          .kpi-swipe-setas { display: none !important; }
        }
      `}</style>
    </div>
  );
};
