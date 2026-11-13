import React, { useEffect, useState } from 'react';
import { ArrowRight, Target } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { fetchObjetivosFaseamento, ObjetivosFaseamentoResponse } from '../../lib/api';

/**
 * Objetivos no Dashboard — só os números, em cartões rápidos.
 *
 * A tela de Objetivos tem anéis, tabelas e filtros; aqui fica a leitura de
 * um relance: meta, realizado e quanto falta de cada objetivo. Clicar em
 * qualquer cartão (ou em "Ver detalhes") leva à tela de Objetivos.
 *
 * Faseamento II e Desafio só aparecem "quando houver": sem meta no período,
 * o cartão sai em vez de mostrar um "0%" que pareceria resultado ruim.
 */
const fmtCurto = (v: number) => {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `R$ ${(v / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} mi`;
  if (abs >= 1_000) return `R$ ${(v / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  return `R$ ${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
};
const fmtPct = (v: number) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%`;

export const ObjetivosResumo: React.FC<{
  ano?: number;
  mes?: number;
  start?: string;
  end?: string;
  equipe?: string;
  vendedor?: string;
  /** Leva à tela de Objetivos. Sem ele, os cartões são só leitura. */
  onAbrir?: () => void;
}> = ({ ano, mes, start, end, equipe, vendedor, onAbrir }) => {
  const { t } = useTheme();
  const [dados, setDados] = useState<ObjetivosFaseamentoResponse | null>(null);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const res = await fetchObjetivosFaseamento({ ano, mes, start, end, equipe, vendedor });
        if (ativo) setDados(res);
      } catch {
        // Bloco auxiliar: se falhar, simplesmente não aparece.
        if (ativo) setDados(null);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [ano, mes, start, end, equipe, vendedor]);

  if (!dados) return null;

  const cartoes = [
    { titulo: 'Faseamento', bloco: dados.faseamento, sempre: true },
    { titulo: 'Faseamento II', bloco: dados.faseamentoII, sempre: false },
    { titulo: 'Desconcentração', bloco: dados.desconcentracao, sempre: true },
    { titulo: 'Desafio', bloco: dados.desafio, sempre: false },
  ].filter((c) => c.sempre || c.bloco.meta > 0);

  if (cartoes.every((c) => c.bloco.meta <= 0 && c.bloco.realizado <= 0)) return null;

  return (
    <section style={{ marginBottom: 24 }} aria-label="Objetivos do período">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <Target size={15} color={t.accentTeal} />
        <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: t.text }}>Objetivos</h2>
        {onAbrir && (
          <button
            type="button"
            onClick={onAbrir}
            style={{
              marginLeft: 'auto',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 10px',
              minHeight: 0,
              borderRadius: 8,
              border: `1px solid ${t.border}`,
              background: 'transparent',
              color: t.textSecondary,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Ver detalhes <ArrowRight size={13} />
          </button>
        )}
      </div>

      <div className="grade-kpi">
        {cartoes.map(({ titulo, bloco }) => {
          const semMeta = bloco.meta <= 0;
          const cor = semMeta ? t.textMuted : bloco.pct >= 100 ? t.success : bloco.pct >= 80 ? t.warning : t.danger;
          const falta = Math.max(0, bloco.meta - bloco.realizado);
          const Conteudo = (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: t.textMuted }}>
                  {titulo}
                </span>
                <span className="num" style={{ fontSize: 15, fontWeight: 700, color: cor }}>
                  {semMeta ? '—' : fmtPct(bloco.pct)}
                </span>
              </div>
              <div className="num" style={{ fontSize: 20, fontWeight: 700, color: t.text, marginTop: 6, lineHeight: 1.15 }}>
                {fmtCurto(bloco.realizado)}
              </div>
              <div className="num" style={{ fontSize: 11.5, color: t.textMuted, marginTop: 2 }}>
                {semMeta ? 'sem meta no período' : `meta ${fmtCurto(bloco.meta)}`}
              </div>
              {!semMeta && (
                <>
                  <div style={{ height: 4, borderRadius: 2, background: t.surfaceElevated, overflow: 'hidden', marginTop: 9 }}>
                    <div style={{ width: `${Math.max(0, Math.min(100, bloco.pct))}%`, height: '100%', background: cor, borderRadius: 2 }} />
                  </div>
                  <div className="num" style={{ fontSize: 11, color: falta > 0 ? t.textSecondary : t.success, marginTop: 6 }}>
                    {falta > 0 ? `faltam ${fmtCurto(falta)}` : 'meta batida'}
                  </div>
                </>
              )}
            </>
          );
          const estilo: React.CSSProperties = {
            textAlign: 'left',
            background: t.surface,
            border: `1px solid ${t.border}`,
            borderLeft: `3px solid ${cor}`,
            borderRadius: 12,
            padding: '12px 14px',
            minWidth: 0,
            color: 'inherit',
            font: 'inherit',
          };
          return onAbrir ? (
            <button
              key={titulo}
              type="button"
              onClick={onAbrir}
              className="ga-card-hover"
              title={`Abrir Objetivos — ${titulo}`}
              style={{ ...estilo, cursor: 'pointer', transition: 'border-color 0.18s ease, transform 0.18s ease' }}
            >
              {Conteudo}
            </button>
          ) : (
            <div key={titulo} style={estilo}>
              {Conteudo}
            </div>
          );
        })}
      </div>
    </section>
  );
};
