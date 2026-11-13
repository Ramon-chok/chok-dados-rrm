import React, { useEffect, useMemo, useState } from 'react';
import { Package, Info, Search } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { fetchProdutoClientes, getErrorMessage, ProdutoClientesResponse } from '../../lib/api';
import { PainelLateral } from '../common/PainelLateral';
import { ErrorBlock, LoadingBlock } from '../common/DataState';

/**
 * Ficha do produto — abre ao clicar num item da Lista de Sortimento.
 *
 * Mostra SÓ os clientes que compraram o produto. Quem comprou fora do
 * período escolhido continua na lista, com a data e o valor do último pedido
 * e o selo "fora do período" — é justamente o cliente que vale reativar.
 *
 * Os dados vêm da API do ERP (ver backend `/catalog/produto-clientes`).
 * Sem a API configurada a ficha diz isso, em vez de mostrar uma lista vazia
 * que pareceria "ninguém comprou".
 */
const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtData = (iso: string | null) => {
  if (!iso) return '—';
  const [a, m, d] = iso.slice(0, 10).split('-');
  return d && m && a ? `${d}/${m}/${a}` : iso;
};

export interface ProdutoAlvo {
  codigo: string;
  produto?: string | null;
}

export const ProdutoDetalhe: React.FC<{
  alvo: ProdutoAlvo | null;
  onClose: () => void;
  start?: string;
  end?: string;
  periodoLabel?: string;
}> = ({ alvo, onClose, start, end, periodoLabel }) => {
  const { t } = useTheme();
  const [dados, setDados] = useState<ProdutoClientesResponse | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<'todos' | 'periodo' | 'fora'>('todos');
  const [busca, setBusca] = useState('');

  useEffect(() => {
    if (!alvo) return;
    let ativo = true;
    setCarregando(true);
    setErro(null);
    setDados(null);
    setFiltro('todos');
    setBusca('');
    (async () => {
      try {
        const res = await fetchProdutoClientes({ cod_produto: alvo.codigo, start, end });
        if (ativo) setDados(res);
      } catch (e) {
        if (ativo) setErro(getErrorMessage(e, 'Falha ao carregar os clientes deste produto.'));
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [alvo, start, end]);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (dados?.clientes || []).filter((c) => {
      if (filtro === 'periodo' && !c.noPeriodo) return false;
      if (filtro === 'fora' && c.noPeriodo) return false;
      if (!q) return true;
      return [c.cliente, c.codigo, c.vendedor].some((x) => (x || '').toLowerCase().includes(q));
    });
  }, [dados, filtro, busca]);

  const aba = (id: typeof filtro, rotulo: string, qtd: number) => {
    const sel = filtro === id;
    return (
      <button
        key={id}
        type="button"
        onClick={() => setFiltro(id)}
        style={{
          padding: '6px 12px',
          borderRadius: 8,
          border: 'none',
          cursor: 'pointer',
          fontSize: 12.5,
          fontWeight: sel ? 700 : 500,
          color: sel ? t.primaryForeground : t.textSecondary,
          background: sel ? t.primary : 'transparent',
          minHeight: 0,
        }}
      >
        {rotulo} <span className="num">({qtd})</span>
      </button>
    );
  };

  return (
    <PainelLateral
      aberto={!!alvo}
      onClose={onClose}
      rotulo={`Clientes do produto ${alvo?.codigo || ''}`}
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
            <Package size={18} color="#fff" />
          </span>
          <div style={{ minWidth: 0 }}>
            <h2
              className="faixa-texto-forte"
              style={{ margin: 0, fontSize: 16.5, fontWeight: 700, lineHeight: 1.25, overflowWrap: 'anywhere' }}
            >
              {dados?.produto.produto || alvo?.produto || alvo?.codigo}
            </h2>
            <div className="faixa-texto-suave" style={{ fontSize: 11.5, marginTop: 3 }}>
              <span className="mono">{alvo?.codigo}</span>
              {[dados?.produto.fabricante, dados?.produto.categoria].filter(Boolean).map((x) => ` · ${x}`)}
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
      {carregando && <LoadingBlock label="Buscando os clientes que compraram este produto…" />}
      {erro && <ErrorBlock message={erro} />}

      {dados && dados.fonte !== 'api' && (
        <div
          style={{
            display: 'flex',
            gap: 10,
            padding: '14px 16px',
            borderRadius: 12,
            background: `${dados.fonte === 'erro' ? t.danger : t.info}12`,
            border: `1px solid ${dados.fonte === 'erro' ? t.danger : t.info}40`,
            fontSize: 13,
            color: t.textSecondary,
            lineHeight: 1.55,
          }}
        >
          <Info size={16} color={dados.fonte === 'erro' ? t.danger : t.info} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{dados.mensagem}</span>
        </div>
      )}

      {dados && dados.fonte === 'api' && (
        <>
          <div className="grade-kpi" style={{ marginBottom: 14 }}>
            {[
              ['Clientes que compraram', String(dados.resumo.clientes)],
              ['Compraram no período', String(dados.resumo.noPeriodo)],
              ['Última compra fora do período', String(dados.resumo.foraPeriodo)],
              ['Venda no período', fmt(dados.resumo.valorPeriodo)],
            ].map(([r, v]) => (
              <div
                key={r}
                style={{ background: t.surfaceElevated, border: `1px solid ${t.border}`, borderRadius: 10, padding: '10px 12px' }}
              >
                <div style={{ fontSize: 10.5, color: t.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {r}
                </div>
                <div className="num" style={{ fontSize: 18, fontWeight: 700, color: t.text, marginTop: 2 }}>
                  {v}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
            <div
              style={{
                display: 'inline-flex',
                gap: 2,
                padding: 3,
                borderRadius: 10,
                background: t.surfaceElevated,
                border: `1px solid ${t.border}`,
                flexWrap: 'wrap',
              }}
            >
              {aba('todos', 'Todos', dados.resumo.clientes)}
              {aba('periodo', 'No período', dados.resumo.noPeriodo)}
              {aba('fora', 'Fora do período', dados.resumo.foraPeriodo)}
            </div>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flex: '1 1 200px',
                border: `1px solid ${t.border}`,
                borderRadius: 10,
                padding: '8px 12px',
                background: t.surface,
              }}
            >
              <Search size={15} color={t.textMuted} />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar cliente ou vendedor"
                aria-label="Buscar cliente ou vendedor"
                style={{ border: 0, outline: 0, background: 'transparent', color: t.text, width: '100%', font: 'inherit', fontSize: 13 }}
              />
            </label>
          </div>

          {lista.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: t.textMuted, border: `1px dashed ${t.border}`, borderRadius: 12 }}>
              {dados.resumo.clientes === 0
                ? 'Nenhum cliente comprou este produto.'
                : 'Nenhum cliente nesta seleção.'}
            </div>
          ) : (
            /* Cartões em vez de tabela: no celular uma tabela de 5 colunas
               rola de lado; o cartão cabe inteiro na tela e lê de cima para baixo. */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {lista.map((c) => (
                <div
                  key={`${c.codigo}-${c.numeroPedido || ''}`}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) auto',
                    gap: '4px 14px',
                    padding: '12px 14px',
                    borderRadius: 12,
                    border: `1px solid ${t.border}`,
                    background: t.surface,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: t.text, overflowWrap: 'anywhere' }}>
                      {c.cliente || c.codigo}
                    </div>
                    <div style={{ fontSize: 11.5, color: t.textMuted, marginTop: 2 }}>
                      <span className="mono">{c.codigo}</span>
                      {c.vendedor ? ` · ${c.vendedor}` : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="num" style={{ fontSize: 14, fontWeight: 700, color: t.text }}>
                      {fmt(c.noPeriodo && c.valorPeriodo > 0 ? c.valorPeriodo : c.valorUltimoPedido)}
                    </div>
                    <div style={{ fontSize: 10.5, color: t.textMuted }}>
                      {c.noPeriodo && c.valorPeriodo > 0 ? 'no período' : 'último pedido'}
                    </div>
                  </div>
                  <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 4 }}>
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 999,
                        background: `${c.noPeriodo ? t.success : t.warning}1A`,
                        color: c.noPeriodo ? t.success : t.warning,
                      }}
                    >
                      {c.noPeriodo ? 'No período' : 'Fora do período'}
                    </span>
                    <span style={{ fontSize: 11.5, color: t.textSecondary }}>
                      Último pedido em <strong className="num">{fmtData(c.dataUltimoPedido)}</strong>
                      {c.numeroPedido ? (
                        <>
                          {' '}· nº <span className="mono">{c.numeroPedido}</span>
                        </>
                      ) : null}
                      {' '}· <span className="num">{fmt(c.valorUltimoPedido)}</span>
                      {c.quantidadeUltimoPedido > 0 && (
                        <span className="num"> · {c.quantidadeUltimoPedido.toLocaleString('pt-BR')} un.</span>
                      )}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </PainelLateral>
  );
};
