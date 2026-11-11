import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  FlaskConical,
  Minus,
  ShieldCheck,
  Target,
  TrendingUp,
  Users,
  Layers,
  Percent,
  Wallet,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { ErrorBlock, LoadingBlock } from '../../components/common/DataState';
import { getErrorMessage } from '../../lib/api';
import { ComparativoDelta, ComparativoResponse, fetchComparativo } from '../../lib/insights';
import { MESES } from '../../lib/semanaComercial';

/**
 * Seção 9 — Comparativos e simulações.
 *
 * Acesso exclusivo dos gerentes: o menu só mostra esta tela para quem tem
 * `comparisons.view`, e `/api/insights/comparativo` recusa com 403 quem não
 * tiver — abrir a URL na mão não adianta.
 *
 * Organização da tela (de cima para baixo, do mais decisivo ao mais detalhado):
 *
 * 1. **Períodos** — os dois recortes lado a lado, com botão de inverter.
 * 2. **Faturamento** — card de destaque, com as duas barras na mesma escala e o
 *    atingimento de cada período, que é a leitura que o gerente faz primeiro.
 * 3. **Blocos temáticos** — Alcance (cobertura/sortimento), Rentabilidade
 *    (margem) e Investimento. Agrupar evita a parede de sete cards iguais em
 *    que nada se destacava.
 * 4. **Simulação** — projeções, calculadas só no navegador.
 *
 * As simulações não gravam nada: resultados oficiais e histórico ficam como estão.
 */

const fmtBRL = (v: number) => `R$ ${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
const fmtInt = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
const fmtPct = (v: number) =>
  `${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

type Formato = 'brl' | 'int' | 'pct';

function formatar(valor: number | null | undefined, formato: Formato): string {
  if (valor === null || valor === undefined) return '—';
  if (formato === 'brl') return fmtBRL(valor);
  if (formato === 'pct') return fmtPct(valor);
  return fmtInt(valor);
}

/** Rótulo curto do período, para os cabeçalhos ("Nov/2026" ou "2026"). */
function rotuloPeriodo(ano: number, mes: number | null | undefined): string {
  return mes ? `${MESES[mes - 1].slice(0, 3)}/${ano}` : String(ano);
}

// ─────────────────────────────────────────────────────────────────────────────
// Peças reutilizadas
// ─────────────────────────────────────────────────────────────────────────────

/** Selo de variação: seta + diferença + percentual, com cor por direção. */
const Variacao: React.FC<{ delta: ComparativoDelta; formato: Formato; tamanho?: 'sm' | 'md' }> = ({
  delta,
  formato,
  tamanho = 'sm',
}) => {
  const { t } = useTheme();
  const diferenca = delta.diferenca ?? 0;
  const neutro = !diferenca;
  const positivo = diferenca > 0;
  const cor = neutro ? t.textMuted : positivo ? t.success : t.danger;
  const Icone = neutro ? Minus : positivo ? ArrowUpRight : ArrowDownRight;
  const fonte = tamanho === 'md' ? 14 : 12;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: tamanho === 'md' ? '5px 10px' : '3px 8px',
        borderRadius: 20,
        background: `${cor}1A`,
        border: `1px solid ${cor}3D`,
        color: cor,
        fontSize: fonte,
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
    >
      <Icone size={tamanho === 'md' ? 15 : 13} />
      <span className="num">{formatar(delta.diferenca, formato)}</span>
      {delta.variacao !== null && delta.variacao !== undefined && (
        <span className="num" style={{ fontWeight: 500, opacity: 0.85 }}>
          ({delta.variacao > 0 ? '+' : ''}
          {fmtPct(delta.variacao)})
        </span>
      )}
    </span>
  );
};

/**
 * Duas barras na MESMA escala (a maior das duas = 100%). É o que torna a
 * comparação legível de relance: a diferença de comprimento é a diferença real.
 */
const BarrasComparativas: React.FC<{ delta: ComparativoDelta; rotuloA: string; rotuloB: string; formato: Formato }> = ({
  delta,
  rotuloA,
  rotuloB,
  formato,
}) => {
  const { t } = useTheme();
  const atual = delta.atual ?? 0;
  const anterior = delta.anterior ?? 0;
  const escala = Math.max(Math.abs(atual), Math.abs(anterior)) || 1;

  const linha = (rotulo: string, valor: number, destaque: boolean) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 10.5, color: t.textMuted, width: 58, flexShrink: 0 }}>{rotulo}</span>
      <div style={{ flex: 1, height: 8, borderRadius: 4, background: t.surfaceElevated, overflow: 'hidden' }}>
        <div
          style={{
            width: `${Math.max(1.5, (Math.abs(valor) / escala) * 100)}%`,
            height: '100%',
            borderRadius: 4,
            background: destaque
              ? `linear-gradient(90deg, ${t.gradientFrom}, ${t.gradientTo})`
              : t.textMuted,
            opacity: destaque ? 1 : 0.4,
            transition: 'width 0.45s ease',
          }}
        />
      </div>
      <span
        className="num"
        style={{
          fontSize: 11.5,
          color: destaque ? t.text : t.textMuted,
          fontWeight: destaque ? 700 : 500,
          minWidth: 76,
          textAlign: 'right',
          flexShrink: 0,
        }}
      >
        {formatar(valor, formato)}
      </span>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {linha(rotuloA, atual, true)}
      {linha(rotuloB, anterior, false)}
    </div>
  );
};

/** Card de indicador secundário. */
const CardIndicador: React.FC<{
  titulo: string;
  icone: React.ReactNode;
  delta: ComparativoDelta;
  formato: Formato;
  rotuloA: string;
  rotuloB: string;
}> = ({ titulo, icone, delta, formato, rotuloA, rotuloB }) => {
  const { t } = useTheme();
  return (
    <div className="ga-card ga-card-hover" style={{ padding: '15px 17px', display: 'flex', flexDirection: 'column', gap: 11 }}>
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
            width: 26,
            height: 26,
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

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span className="num" style={{ fontSize: 23, fontWeight: 700, color: t.text, lineHeight: 1.1 }}>
          {formatar(delta.atual, formato)}
        </span>
        <Variacao delta={delta} formato={formato} />
      </div>

      <BarrasComparativas delta={delta} rotuloA={rotuloA} rotuloB={rotuloB} formato={formato} />
    </div>
  );
};

/** Título de bloco temático. */
const TituloBloco: React.FC<{ texto: string; descricao: string }> = ({ texto, descricao }) => {
  const { t } = useTheme();
  return (
    <div style={{ margin: '26px 0 12px' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{texto}</div>
      <div style={{ fontSize: 11.5, color: t.textMuted, marginTop: 2 }}>{descricao}</div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Página
// ─────────────────────────────────────────────────────────────────────────────
export const ComparativosPage: React.FC = () => {
  const { t } = useTheme();
  const agora = useMemo(() => new Date(), []);
  const anoAtual = agora.getFullYear();
  const mesAtual = agora.getMonth() + 1;

  const [anoA, setAnoA] = useState(anoAtual);
  const [mesA, setMesA] = useState<number | ''>(mesAtual);
  const [anoB, setAnoB] = useState(mesAtual === 1 ? anoAtual - 1 : anoAtual);
  const [mesB, setMesB] = useState<number | ''>(mesAtual === 1 ? 12 : mesAtual - 1);

  const [dados, setDados] = useState<ComparativoResponse | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Simulação — percentuais aplicados sobre o período atual.
  const [simFaturamento, setSimFaturamento] = useState(0);
  const [simCobertura, setSimCobertura] = useState(0);
  const [simMargem, setSimMargem] = useState(0);

  useEffect(() => {
    let ativo = true;
    (async () => {
      setCarregando(true);
      setErro(null);
      try {
        const resposta = await fetchComparativo({
          anoA,
          anoB,
          mesA: mesA === '' ? undefined : mesA,
          mesB: mesB === '' ? undefined : mesB,
        });
        if (ativo) setDados(resposta);
      } catch (e) {
        if (ativo) setErro(getErrorMessage(e, 'Falha ao carregar o comparativo.'));
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [anoA, mesA, anoB, mesB]);

  const anos = useMemo(() => [0, 1, 2, 3].map((d) => anoAtual - d), [anoAtual]);

  const inverterPeriodos = () => {
    setAnoA(anoB);
    setMesA(mesB);
    setAnoB(anoA);
    setMesB(mesA);
  };

  const rotuloA = rotuloPeriodo(anoA, mesA === '' ? null : mesA);
  const rotuloB = rotuloPeriodo(anoB, mesB === '' ? null : mesB);

  const campo: React.CSSProperties = {
    padding: '7px 10px',
    borderRadius: 8,
    border: `1px solid ${t.border}`,
    background: t.surfaceElevated,
    color: t.text,
    fontSize: 12.5,
    cursor: 'pointer',
  };

  const seletorPeriodo = (
    etiqueta: string,
    legenda: string,
    cor: string,
    ano: number,
    setAno: (v: number) => void,
    mes: number | '',
    setMes: (v: number | '') => void
  ) => (
    <div className="ga-card" style={{ padding: '13px 15px', flex: '1 1 230px', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 9 }}>
        <span
          style={{
            width: 20,
            height: 20,
            borderRadius: 6,
            background: `${cor}26`,
            color: cor,
            fontSize: 11,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {etiqueta}
        </span>
        <span
          style={{
            fontSize: 10.5,
            color: t.textMuted,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {legenda}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <select style={campo} value={ano} onChange={(e) => setAno(Number(e.target.value))} aria-label={`Ano — ${legenda}`}>
          {anos.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <select
          style={{ ...campo, flex: 1, minWidth: 110 }}
          value={mes}
          onChange={(e) => setMes(e.target.value === '' ? '' : Number(e.target.value))}
          aria-label={`Mês — ${legenda}`}
        >
          <option value="">Ano inteiro</option>
          {MESES.map((nome, i) => (
            <option key={nome} value={i + 1}>
              {nome}
            </option>
          ))}
        </select>
      </div>
    </div>
  );

  const indicadores = dados?.indicadores;
  const faturamento = indicadores?.faturamento;
  const meta = indicadores?.meta;

  /** Atingimento (realizado ÷ meta) de cada período — leitura que falta no bruto. */
  const atingimento = (realizado: number | null | undefined, metaValor: number | null | undefined) =>
    realizado !== null && realizado !== undefined && metaValor ? (realizado / metaValor) * 100 : null;

  const atingA = atingimento(faturamento?.atual, meta?.atual);
  const atingB = atingimento(faturamento?.anterior, meta?.anterior);

  const mostraMargem =
    !!dados?.podeVerMargem && indicadores?.margem?.atual !== null && indicadores?.margem?.atual !== undefined;

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <h1 className="num" style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: t.text }}>
          Comparativos &amp; Simulações
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: t.textSecondary }}>
          Compare períodos e projete cenários. Acesso restrito à gerência comercial e de vendas.
        </p>
      </div>

      {/* ── Períodos ──────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'stretch' }}>
        {seletorPeriodo('A', 'Período atual', t.accentTeal, anoA, setAnoA, mesA, setMesA)}
        <button
          onClick={inverterPeriodos}
          title="Inverter os dois períodos"
          aria-label="Inverter os dois períodos"
          className="ga-tap"
          style={{
            width: 38,
            borderRadius: 10,
            border: `1px solid ${t.border}`,
            background: t.surface,
            color: t.textSecondary,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <ArrowLeftRight size={16} />
        </button>
        {seletorPeriodo('B', 'Comparar com', t.textMuted, anoB, setAnoB, mesB, setMesB)}
      </div>

      {carregando && <LoadingBlock label="Comparando períodos..." />}
      {erro && <ErrorBlock message={erro} />}

      {!carregando && !erro && dados && indicadores && faturamento && meta && (
        <>
          {/* ── Faturamento: o card que manda na tela ──────────── */}
          <TituloBloco
            texto="Resultado"
            descricao={`Faturamento de ${rotuloA} comparado a ${rotuloB}, e o quanto cada período entregou da própria meta.`}
          />
          <div className="ga-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="ga-accent-bar" />
            <div className="hero-comp">
              <div style={{ padding: '18px 20px', minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: t.textMuted,
                    marginBottom: 10,
                  }}
                >
                  Faturamento
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
                  <span className="num" style={{ fontSize: 34, fontWeight: 700, color: t.text, lineHeight: 1 }}>
                    {formatar(faturamento.atual, 'brl')}
                  </span>
                  <Variacao delta={faturamento} formato="brl" tamanho="md" />
                </div>
                <BarrasComparativas delta={faturamento} rotuloA={rotuloA} rotuloB={rotuloB} formato="brl" />
              </div>

              {/* Atingimento lado a lado: contexto que o valor bruto não dá. */}
              <div
                className="hero-comp-lado"
                style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: t.textMuted,
                  }}
                >
                  Atingimento da meta
                </div>
                {[
                  { rotulo: rotuloA, pct: atingA, metaValor: meta.atual, destaque: true },
                  { rotulo: rotuloB, pct: atingB, metaValor: meta.anterior, destaque: false },
                ].map((linha) => {
                  const cor =
                    linha.pct === null ? t.textMuted : linha.pct >= 100 ? t.success : linha.pct >= 80 ? t.warning : t.danger;
                  return (
                    <div key={linha.rotulo}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                        <span style={{ fontSize: 11.5, color: t.textMuted }}>{linha.rotulo}</span>
                        <span
                          className="num"
                          style={{ fontSize: linha.destaque ? 18 : 15, fontWeight: 700, color: cor }}
                        >
                          {linha.pct === null ? '—' : fmtPct(linha.pct)}
                        </span>
                      </div>
                      <div
                        style={{
                          height: 5,
                          borderRadius: 3,
                          background: t.surfaceElevated,
                          overflow: 'hidden',
                          margin: '6px 0 4px',
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.max(0, Math.min(100, linha.pct ?? 0))}%`,
                            height: '100%',
                            borderRadius: 3,
                            background: cor,
                            transition: 'width 0.45s ease',
                          }}
                        />
                      </div>
                      <div style={{ fontSize: 10.5, color: t.textMuted }}>
                        meta <span className="num">{formatar(linha.metaValor, 'brl')}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Alcance ────────────────────────────────────────── */}
          <TituloBloco texto="Alcance" descricao="Quantos clientes e quantos itens o período cobriu." />
          <div className="comp-grid">
            <CardIndicador
              titulo="Cobertura"
              icone={<Users size={14} />}
              delta={indicadores.cobertura}
              formato="int"
              rotuloA={rotuloA}
              rotuloB={rotuloB}
            />
            <CardIndicador
              titulo="Sortimento"
              icone={<Layers size={14} />}
              delta={indicadores.sortimento}
              formato="int"
              rotuloA={rotuloA}
              rotuloB={rotuloB}
            />
            <CardIndicador
              titulo="Meta de cobertura"
              icone={<Target size={14} />}
              delta={indicadores.metaCobertura}
              formato="int"
              rotuloA={rotuloA}
              rotuloB={rotuloB}
            />
            <CardIndicador
              titulo="Meta de sortimento"
              icone={<Target size={14} />}
              delta={indicadores.metaSortimento}
              formato="int"
              rotuloA={rotuloA}
              rotuloB={rotuloB}
            />
          </div>

          {/* ── Rentabilidade (só com margin.view) ─────────────── */}
          {mostraMargem && (
            <>
              <TituloBloco texto="Rentabilidade" descricao="Margem média dos dois períodos." />
              <div className="comp-grid">
                <CardIndicador
                  titulo="Margem"
                  icone={<Percent size={14} />}
                  delta={indicadores.margem}
                  formato="pct"
                  rotuloA={rotuloA}
                  rotuloB={rotuloB}
                />
              </div>
            </>
          )}

          {/* ── Investimento ───────────────────────────────────── */}
          <TituloBloco
            texto="Investimento"
            descricao="Valores das ações do calendário comercial que caem em cada período."
          />
          <div className="comp-grid">
            <CardIndicador
              titulo="Previsto"
              icone={<Wallet size={14} />}
              delta={indicadores.investimentoPrevisto}
              formato="brl"
              rotuloA={rotuloA}
              rotuloB={rotuloB}
            />
            <CardIndicador
              titulo="Realizado"
              icone={<TrendingUp size={14} />}
              delta={indicadores.investimentoRealizado}
              formato="brl"
              rotuloA={rotuloA}
              rotuloB={rotuloB}
            />
          </div>

          {/* ── Simulação ──────────────────────────────────────── */}
          {dados.podeSimular && (
            <>
              <TituloBloco
                texto="Simulação de cenário"
                descricao="Projeções a partir do período A. Mover os controles não altera dado nenhum."
              />
              <div className="ga-card" style={{ padding: '16px 18px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    fontSize: 11.5,
                    color: t.textMuted,
                    marginBottom: 18,
                  }}
                >
                  <FlaskConical size={13} color={t.accentTeal} />
                  <ShieldCheck size={13} color={t.success} />
                  Calculado apenas nesta tela — nada é gravado e nenhum resultado oficial muda.
                </div>

                <div className="sim-grid">
                  <SimuladorLinha
                    rotulo="Crescimento de faturamento"
                    valor={simFaturamento}
                    onChange={setSimFaturamento}
                    base={faturamento.atual ?? 0}
                    formatar={fmtBRL}
                  />
                  <SimuladorLinha
                    rotulo="Aumento de cobertura"
                    valor={simCobertura}
                    onChange={setSimCobertura}
                    base={indicadores.cobertura.atual ?? 0}
                    formatar={fmtInt}
                  />
                  {mostraMargem && (
                    <SimuladorLinha
                      rotulo="Evolução de margem"
                      valor={simMargem}
                      onChange={setSimMargem}
                      base={indicadores.margem.atual ?? 0}
                      formatar={fmtPct}
                    />
                  )}
                </div>
              </div>
            </>
          )}
        </>
      )}

      <style>{`
        .comp-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 14px;
        }
        .sim-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 22px;
        }
        .hero-comp {
          display: grid;
          grid-template-columns: minmax(0, 1.45fr) minmax(0, 1fr);
        }
        .hero-comp-lado {
          border-left: 1px solid var(--ga-border);
        }
        @media (max-width: 880px) {
          .hero-comp { grid-template-columns: 1fr; }
          .hero-comp-lado {
            border-left: none;
            border-top: 1px solid var(--ga-border);
          }
        }
      `}</style>
    </div>
  );
};

const SimuladorLinha: React.FC<{
  rotulo: string;
  valor: number;
  onChange: (v: number) => void;
  base: number;
  formatar: (v: number) => string;
}> = ({ rotulo, valor, onChange, base, formatar: formatarValor }) => {
  const { t } = useTheme();
  const projetado = base * (1 + valor / 100);
  const diferenca = projetado - base;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: t.textSecondary }}>{rotulo}</span>
        <span
          className="num"
          style={{ fontSize: 13, fontWeight: 700, color: valor === 0 ? t.textMuted : t.accentTeal }}
        >
          {valor > 0 ? '+' : ''}
          {valor}%
        </span>
      </div>
      <input
        type="range"
        min={-30}
        max={50}
        step={1}
        value={valor}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: t.accentTeal }}
        aria-label={rotulo}
      />
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 8,
          fontSize: 11.5,
          marginTop: 8,
        }}
      >
        <span style={{ color: t.textMuted }}>
          hoje <span className="num">{formatarValor(base)}</span>
        </span>
        <span style={{ color: t.text, fontWeight: 600, textAlign: 'right' }}>
          cenário <span className="num">{formatarValor(projetado)}</span>
          {valor !== 0 && (
            <span className="num" style={{ color: diferenca > 0 ? t.success : t.danger, marginLeft: 6 }}>
              ({diferenca > 0 ? '+' : ''}
              {formatarValor(diferenca)})
            </span>
          )}
        </span>
      </div>
    </div>
  );
};
