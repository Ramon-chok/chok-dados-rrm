import React, { useEffect, useState } from 'react';
import {
  Store,
  TrendingUp,
  Target,
  Wallet,
  ChevronDown,
  ChevronRight,
  Info,
  Package,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import {
  ClienteDetalheResponse,
  ClienteFabricanteItensResponse,
  fetchClienteDetalhe,
  fetchClienteFabricanteItens,
  getErrorMessage,
} from '../../lib/api';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../common/DataState';
import { PainelLateral } from '../common/PainelLateral';

/**
 * Ficha do cliente — a mesma em toda a plataforma.
 *
 * Abre no Dashboard (tabela e gráfico de Top Clientes, e o cartão TOP 5), no
 * TOP Clientes e nos Não Positivados. Um componente só: o que o usuário vê ao
 * clicar num cliente é idêntico venha de onde vier, e o período é sempre o já
 * escolhido na tela de origem — a ficha não cria um recorte próprio.
 *
 * O que mostra, nesta ordem:
 *   1. Realizado de venda do cliente no período.
 *   2. O peso dele na CARTEIRA: participação, posição e quantos clientes há.
 *   3. O peso dele na META do vendedor — a meta total e, abaixo, cada
 *      objetivo (faseamento, faseamento II, desconcentração e desafio).
 *   4. Os fabricantes em que ele comprou, com valor; ao abrir um fabricante,
 *      as categorias e os produtos daquele fabricante.
 *
 * Sobre a fonte do passo 4: o valor por FABRICANTE é real (matriz
 * cliente x fabricante da planilha de Não Positivados). Categoria e produto
 * NÃO existem por cliente em nenhuma base importada — a venda é gravada só no
 * total do pedido —, então esse nível vem da Lista de Sortimento, que é o
 * portfólio do fabricante. A tela diz isso em vez de exibir um número que
 * pareceria ser a compra do cliente.
 */

const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
const fmtPct = (v: number) => `${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const fmtInt = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 0 });

export interface ClienteAlvo {
  /** Código do ponto de venda. Nulo em rede — aí vale o nome. */
  codigo?: string | null;
  nome: string;
}

export interface ClienteDetalheProps {
  alvo: ClienteAlvo | null;
  onClose: () => void;
  /** Período e recorte vindos da tela de origem. */
  ano?: number;
  mes?: number;
  start?: string;
  end?: string;
  equipe?: string;
  vendedor?: string;
  /** Rótulo do período, só para o cabeçalho da ficha. */
  periodoLabel?: string;
}

export const ClienteDetalhe: React.FC<ClienteDetalheProps> = ({
  alvo,
  onClose,
  ano,
  mes,
  start,
  end,
  equipe,
  vendedor,
  periodoLabel,
}) => {
  const { t } = useTheme();
  const [dados, setDados] = useState<ClienteDetalheResponse | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Fabricante aberto e o que já foi buscado dele (cache por nome).
  const [fabAberto, setFabAberto] = useState<string | null>(null);
  const [itens, setItens] = useState<
    Record<string, ClienteFabricanteItensResponse | 'carregando' | 'erro'>
  >({});

  const chave = alvo ? `${alvo.codigo || ''}|${alvo.nome}` : '';

  useEffect(() => {
    if (!alvo) return;
    let ativo = true;
    setCarregando(true);
    setErro(null);
    setDados(null);
    setFabAberto(null);
    setItens({});
    (async () => {
      try {
        const res = await fetchClienteDetalhe({
          codigo: alvo.codigo || undefined,
          nome: alvo.codigo ? undefined : alvo.nome,
          ano,
          mes,
          start,
          end,
          equipe,
          vendedor,
        });
        if (ativo) setDados(res);
      } catch (e) {
        if (ativo) setErro(getErrorMessage(e, 'Falha ao carregar a ficha do cliente.'));
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, ano, mes, start, end, equipe, vendedor]);

  const abrirFabricante = async (fabricante: string) => {
    if (fabAberto === fabricante) {
      setFabAberto(null);
      return;
    }
    setFabAberto(fabricante);
    if (itens[fabricante]) return;
    setItens((prev) => ({ ...prev, [fabricante]: 'carregando' }));
    try {
      const res = await fetchClienteFabricanteItens({ fabricante });
      setItens((prev) => ({ ...prev, [fabricante]: res }));
    } catch {
      setItens((prev) => ({ ...prev, [fabricante]: 'erro' }));
    }
  };

  if (!alvo) return null;

  const corVariacao = (v: number) => (v > 0 ? t.success : v < 0 ? t.danger : t.textMuted);
  const corAtingimento = (v: number) => (v >= 100 ? t.success : v >= 80 ? t.warning : t.danger);

  const thStyle: React.CSSProperties = {
    padding: '9px 12px',
    fontSize: 10.5,
    fontWeight: 700,
    color: t.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    textAlign: 'left',
    background: t.surfaceElevated,
    borderBottom: `1px solid ${t.border}`,
    position: 'sticky',
    top: 0,
  };
  const tdStyle: React.CSSProperties = {
    padding: '9px 12px',
    fontSize: 12.5,
    color: t.text,
    borderBottom: `1px solid ${t.border}`,
  };

  return (
    <PainelLateral
      aberto
      largo
      onClose={onClose}
      rotulo={`Ficha do cliente ${alvo.nome}`}
      cabecalho={
        <div style={{ display: 'flex', gap: 12, minWidth: 0 }}>
          <span
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: 'rgba(255,255,255,0.16)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Store size={18} color="#fff" />
          </span>
          <div style={{ minWidth: 0 }}>
            <h2
              className="faixa-texto-forte"
              style={{ margin: 0, fontSize: 17, fontWeight: 700, lineHeight: 1.25, overflowWrap: 'anywhere' }}
            >
              {dados?.cliente.nome || alvo.nome}
            </h2>
            <div className="faixa-texto-suave" style={{ fontSize: 11.5, marginTop: 3 }}>
              {[
                dados?.cliente.eRede
                  ? `Rede · ${fmtInt(dados.cliente.pontos)} ponto(s)`
                  : dados?.cliente.codigo || alvo.codigo || null,
                dados?.cliente.municipio,
                dados?.cliente.vendedor,
                dados?.cliente.equipe,
              ]
                .filter(Boolean)
                .join(' · ') || 'Carregando identificação…'}
            </div>
            {periodoLabel && (
              <div className="faixa-texto-suave" style={{ fontSize: 11, marginTop: 2, opacity: 0.85 }}>
                Período: {periodoLabel}
              </div>
            )}
          </div>
        </div>
      }
    >
          {carregando && <LoadingBlock label="Carregando a ficha do cliente…" />}
          {erro && <ErrorBlock message={erro} />}
          {!carregando && !erro && !dados && <EmptyBlock title="Cliente sem dados no período" />}

          {dados && (
            <>
              {/* ── 1. Venda realizada no período ──────────────────────── */}
              <Secao titulo="Realizado no período" icone={<TrendingUp size={14} />} />
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                  gap: 10,
                  marginBottom: 20,
                }}
              >
                <Bloco rotulo="Venda do cliente" valor={fmt(dados.venda.realizado)} destaque />
                {dados.venda.temComparativo ? (
                  <>
                    <Bloco
                      rotulo="Crescimento no mês"
                      valor={fmtPct(dados.venda.pctCrescMes)}
                      cor={corVariacao(dados.venda.pctCrescMes)}
                      apoio={`${fmt(dados.venda.mesAnterior)} → ${fmt(dados.venda.mesAtual)}`}
                    />
                    <Bloco
                      rotulo="Crescimento no trimestre"
                      valor={fmtPct(dados.venda.pctCrescTrimestre)}
                      cor={corVariacao(dados.venda.pctCrescTrimestre)}
                      apoio={`${fmt(dados.venda.trimestreAnterior)} → ${fmt(dados.venda.trimestreAtual)}`}
                    />
                  </>
                ) : (
                  <Bloco
                    rotulo="Comparativo"
                    valor="—"
                    apoio="Cliente não consta na planilha de crescimento (TOP 20) neste período."
                  />
                )}
              </div>

              {/* ── 2. Peso na carteira ────────────────────────────────── */}
              <Secao titulo="O que isso representa na carteira" icone={<Wallet size={14} />} />
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                  gap: 10,
                  marginBottom: 8,
                }}
              >
                <Bloco
                  rotulo="Participação na carteira"
                  valor={fmtPct(dados.carteira.participacao)}
                  destaque
                  apoio={`de ${fmt(dados.carteira.total)} vendidos`}
                />
                <Bloco rotulo="Posição no ranking" valor={`${dados.carteira.posicao}º`} apoio={`entre ${fmtInt(dados.carteira.clientes)} clientes`} />
                <Bloco rotulo="Clientes na carteira" valor={fmtInt(dados.carteira.clientes)} apoio={dados.cliente.vendedor || 'recorte atual'} />
              </div>
              <BarraParticipacao pct={dados.carteira.participacao} />

              {/* ── 3. Peso na meta ────────────────────────────────────── */}
              <Secao titulo="O que isso representa na meta" icone={<Target size={14} />} />
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                  gap: 10,
                  marginBottom: 12,
                }}
              >
                <Bloco rotulo="Meta total do vendedor" valor={fmt(dados.meta.metaTotal)} />
                <Bloco
                  rotulo="Atingimento do vendedor"
                  valor={fmtPct(dados.meta.pctAtingimento)}
                  cor={corAtingimento(dados.meta.pctAtingimento)}
                  apoio={`realizado ${fmt(dados.meta.realizadoVendedor)}`}
                />
                <Bloco
                  rotulo="Este cliente cobre"
                  valor={fmtPct(dados.meta.contribuicaoNaMeta)}
                  destaque
                  apoio="da meta total"
                />
              </div>

              {/* Objetivos: faseamento, faseamento II, desconcentração e
                  desafio — a meta total sozinha não conta a história. */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
                  gap: 10,
                  marginBottom: 20,
                }}
              >
                <Objetivo titulo="Faseamento" bloco={dados.meta.objetivos.faseamento} />
                <Objetivo titulo="Faseamento II" bloco={dados.meta.objetivos.faseamentoII} />
                <Objetivo titulo="Desconcentração" bloco={dados.meta.objetivos.desconcentracao} />
                <Objetivo titulo="Desafio" bloco={dados.meta.objetivos.desafio} />
              </div>

              {/* ── 4. Fabricantes com venda ───────────────────────────── */}
              <Secao
                titulo="Fabricantes com venda"
                icone={<Package size={14} />}
                contagem={dados.fabricantes.length}
              />
              {dados.fonteFabricante && (
                <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 8 }}>
                  Fonte: {dados.fonteFabricante}. Clique em um fabricante para ver categorias e produtos.
                </div>
              )}

              {dados.fabricantes.length === 0 ? (
                <div
                  style={{
                    padding: '14px 16px',
                    borderRadius: 10,
                    border: `1px dashed ${t.border}`,
                    fontSize: 12.5,
                    color: t.textMuted,
                  }}
                >
                  Sem valor por fabricante para este cliente no período.
                </div>
              ) : (
                <div
                  style={{
                    border: `1px solid ${t.border}`,
                    borderRadius: 10,
                    maxHeight: 360,
                    overflowY: 'auto',
                    overflowX: 'auto',
                  }}
                >
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ ...thStyle, width: 34 }} />
                        <th style={thStyle}>Fabricante</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Valor de venda</th>
                        <th style={{ ...thStyle, textAlign: 'right', width: 120 }}>Part.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dados.fabricantes.map((f) => {
                        const aberto = fabAberto === f.fabricante;
                        const detalhe = itens[f.fabricante];
                        return (
                          <React.Fragment key={f.fabricante}>
                            <tr
                              onClick={() => abrirFabricante(f.fabricante)}
                              style={{ cursor: 'pointer' }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = t.surfaceElevated)}
                              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                            >
                              <td style={{ ...tdStyle, textAlign: 'center', color: t.textMuted }}>
                                {aberto ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              </td>
                              <td style={{ ...tdStyle, fontWeight: 600 }}>{f.fabricante}</td>
                              <td className="num" style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>
                                {fmt(f.valor)}
                              </td>
                              <td style={{ ...tdStyle, textAlign: 'right' }}>
                                <span className="num" style={{ fontSize: 12, color: t.textSecondary }}>
                                  {fmtPct(f.part)}
                                </span>
                              </td>
                            </tr>
                            {aberto && (
                              <tr>
                                <td colSpan={4} style={{ padding: 0, background: t.bgSecondary }}>
                                  <div style={{ padding: '10px 16px 14px 46px' }}>
                                    {detalhe === 'carregando' && (
                                      <div style={{ fontSize: 12, color: t.textMuted }}>Carregando categorias…</div>
                                    )}
                                    {detalhe === 'erro' && (
                                      <div style={{ fontSize: 12, color: t.danger }}>
                                        Não foi possível carregar as categorias deste fabricante.
                                      </div>
                                    )}
                                    {detalhe && detalhe !== 'carregando' && detalhe !== 'erro' && (
                                      <ItensDoFabricante detalhe={detalhe} valorFabricante={f.valor} />
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {dados.avisos.length > 0 && (
                <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {dados.avisos.map((aviso) => (
                    <Aviso key={aviso} texto={aviso} />
                  ))}
                </div>
              )}
            </>
          )}
    </PainelLateral>
  );
};

/* ------------------------------------------------------------------ *
 * Peças da ficha
 * ------------------------------------------------------------------ */

const Secao: React.FC<{ titulo: string; icone: React.ReactNode; contagem?: number }> = ({
  titulo,
  icone,
  contagem,
}) => {
  const { t } = useTheme();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 10px' }}>
      <span style={{ color: t.accentTeal, display: 'flex' }}>{icone}</span>
      <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: t.text }}>{titulo}</h3>
      {contagem !== undefined && contagem > 0 && (
        <span
          className="num"
          style={{
            fontSize: 10,
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: 20,
            background: `${t.primary}15`,
            color: t.primary,
            border: `1px solid ${t.primary}30`,
          }}
        >
          {contagem}
        </span>
      )}
    </div>
  );
};

const Bloco: React.FC<{
  rotulo: string;
  valor: string;
  apoio?: string;
  cor?: string;
  destaque?: boolean;
}> = ({ rotulo, valor, apoio, cor, destaque }) => {
  const { t } = useTheme();
  return (
    <div
      style={{
        background: destaque ? `${t.primary}0F` : t.surfaceElevated,
        border: `1px solid ${destaque ? `${t.primary}33` : t.border}`,
        borderRadius: 10,
        padding: '11px 13px',
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontSize: 10.5,
          color: t.textMuted,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          fontWeight: 600,
        }}
      >
        {rotulo}
      </div>
      <div className="num" style={{ fontSize: 19, fontWeight: 700, color: cor || t.text, lineHeight: 1.25, marginTop: 3 }}>
        {valor}
      </div>
      {apoio && <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2, lineHeight: 1.4 }}>{apoio}</div>}
    </div>
  );
};

/** Barra de quanto o cliente ocupa da carteira — o número fica tangível. */
const BarraParticipacao: React.FC<{ pct: number }> = ({ pct }) => {
  const { t } = useTheme();
  const largura = Math.max(1, Math.min(100, pct));
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ height: 8, borderRadius: 4, background: t.surfaceElevated, overflow: 'hidden' }}>
        <div
          style={{
            width: `${largura}%`,
            height: '100%',
            borderRadius: 4,
            background: `linear-gradient(90deg, ${t.gradientFrom}, ${t.gradientTo})`,
            transition: 'width 0.5s ease',
          }}
        />
      </div>
      <div style={{ fontSize: 11, color: t.textMuted, marginTop: 5 }}>
        Este cliente ocupa {fmtPct(pct)} da carteira no período.
      </div>
    </div>
  );
};

const Objetivo: React.FC<{ titulo: string; bloco: { meta: number; realizado: number; pct: number } }> = ({
  titulo,
  bloco,
}) => {
  const { t } = useTheme();
  const semMeta = bloco.meta <= 0;
  const cor = semMeta ? t.textMuted : bloco.pct >= 100 ? t.success : bloco.pct >= 80 ? t.warning : t.danger;
  return (
    <div
      style={{
        background: t.surfaceElevated,
        border: `1px solid ${t.border}`,
        borderRadius: 10,
        padding: '11px 13px',
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, color: t.textSecondary }}>{titulo}</div>
      <div className="num" style={{ fontSize: 17, fontWeight: 700, color: cor, marginTop: 2 }}>
        {semMeta ? '—' : fmtPct(bloco.pct)}
      </div>
      <div style={{ fontSize: 10.5, color: t.textMuted, marginTop: 2 }}>
        {semMeta ? 'sem meta importada' : `${fmt(bloco.realizado)} de ${fmt(bloco.meta)}`}
      </div>
      {!semMeta && (
        <div style={{ height: 4, borderRadius: 2, background: t.border, overflow: 'hidden', marginTop: 7 }}>
          <div
            style={{
              width: `${Math.max(0, Math.min(100, bloco.pct))}%`,
              height: '100%',
              background: cor,
              borderRadius: 2,
            }}
          />
        </div>
      )}
    </div>
  );
};

const Aviso: React.FC<{ texto: string }> = ({ texto }) => {
  const { t } = useTheme();
  return (
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
      <span>{texto}</span>
    </div>
  );
};

/**
 * Categorias e produtos do fabricante aberto.
 *
 * O aviso no topo não é decoração: sem ele o usuário leria a lista como "o
 * que este cliente comprou", e ela é o portfólio do fabricante. O único valor
 * de venda confiável neste nível é o total do fabricante, repetido aqui para
 * a leitura não se perder.
 */
const ItensDoFabricante: React.FC<{
  detalhe: ClienteFabricanteItensResponse;
  valorFabricante: number;
}> = ({ detalhe, valorFabricante }) => {
  const { t } = useTheme();
  const [categoriaAberta, setCategoriaAberta] = useState<string | null>(
    detalhe.categorias[0]?.categoria ?? null
  );

  if (detalhe.categorias.length === 0) {
    return (
      <div style={{ fontSize: 12, color: t.textMuted }}>
        A Lista de Sortimento não tem itens deste fabricante — sem ela não há categorias nem produtos
        para mostrar.
      </div>
    );
  }

  return (
    <div>
      <Aviso
        texto={`Venda deste cliente em ${detalhe.fabricante}: ${fmt(valorFabricante)}. A base registra a venda no total do pedido, então ela não se divide por categoria ou produto — a lista abaixo é o portfólio do fabricante (${detalhe.fonte}).`}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
        {detalhe.categorias.map((cat) => {
          const aberta = categoriaAberta === cat.categoria;
          return (
            <div
              key={cat.categoria}
              style={{ border: `1px solid ${t.border}`, borderRadius: 9, background: t.surface, overflow: 'hidden' }}
            >
              <button
                onClick={() => setCategoriaAberta(aberta ? null : cat.categoria)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 12px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: t.text,
                  font: 'inherit',
                  textAlign: 'left',
                }}
              >
                <span style={{ color: t.textMuted, display: 'flex' }}>
                  {aberta ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                </span>
                <span style={{ fontSize: 12.5, fontWeight: 600, flex: 1, minWidth: 0 }}>{cat.categoria}</span>
                <span className="num" style={{ fontSize: 11, color: t.textMuted }}>
                  {fmtInt(cat.skus)} SKU(s)
                </span>
              </button>

              {aberta && (
                <div style={{ maxHeight: 220, overflowY: 'auto', borderTop: `1px solid ${t.border}` }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={celulaCabecalho(t)}>Código</th>
                        <th style={celulaCabecalho(t)}>Produto</th>
                        <th style={celulaCabecalho(t)}>Linha</th>
                        <th style={{ ...celulaCabecalho(t), textAlign: 'right' }}>Preço de tabela</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cat.produtos.map((p) => (
                        <tr key={p.codigo}>
                          <td style={{ ...celulaCorpo(t), fontFamily: 'var(--ga-mono)', color: t.textMuted }}>
                            {p.codigo}
                          </td>
                          <td style={celulaCorpo(t)}>{p.produto}</td>
                          <td style={{ ...celulaCorpo(t), color: t.textSecondary }}>{p.linha}</td>
                          <td className="num" style={{ ...celulaCorpo(t), textAlign: 'right' }}>
                            {p.precoTabela > 0 ? fmt(p.precoTabela) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const celulaCabecalho = (t: any): React.CSSProperties => ({
  padding: '7px 11px',
  fontSize: 10,
  fontWeight: 700,
  color: t.textMuted,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  textAlign: 'left',
  background: t.surfaceElevated,
  position: 'sticky',
  top: 0,
});

const celulaCorpo = (t: any): React.CSSProperties => ({
  padding: '7px 11px',
  fontSize: 12,
  color: t.text,
  borderBottom: `1px solid ${t.border}`,
});
