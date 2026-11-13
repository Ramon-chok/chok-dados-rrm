import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Handshake, Plus, Search, Trash2, Pencil, X, Truck } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { ErrorBlock, LoadingBlock } from '../../components/common/DataState';
import { getErrorMessage } from '../../lib/api';
import {
  Fornecedor,
  Negociacao,
  NegociacaoStatus,
  NegociacoesResponse,
  fetchFornecedores,
  fetchNegociacoes,
  removerFornecedor,
  removerNegociacao,
  salvarFornecedor,
  salvarNegociacao,
} from '../../lib/purchasing';

/**
 * Seção 3 — Compras.
 *
 * Duas abas: **Fornecedores** (cadastro e acompanhamento) e **Negociações**
 * (pedidos de compra e fechamentos, com valores, descontos, bonificações e
 * investimentos). O resumo no topo das negociações mostra o custo líquido —
 * valor de compra menos desconto e bonificação — calculado no backend para a
 * tela e os relatórios nunca divergirem.
 *
 * A edição depende de `purchasing.edit`; quem só tem `purchasing.view`
 * (ex.: Gerente Comercial) enxerga tudo em modo leitura.
 */

const fmtBRL = (v: number) => `R$ ${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
const fmtPct = (v: number) => `${v.toFixed(1)}%`;

const STATUS_NEGOCIACAO: Array<{ id: NegociacaoStatus; rotulo: string }> = [
  { id: 'aberta', rotulo: 'Aberta' },
  { id: 'fechada', rotulo: 'Fechada' },
  { id: 'cancelada', rotulo: 'Cancelada' },
];

type Aba = 'fornecedores' | 'negociacoes';

export const ComprasPage: React.FC = () => {
  const { t } = useTheme();
  const { hasPermission } = useAuth();
  const podeEditar = hasPermission('purchasing.edit');

  const [aba, setAba] = useState<Aba>('negociacoes');
  const [busca, setBusca] = useState('');
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [negociacoes, setNegociacoes] = useState<NegociacoesResponse | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [formFornecedor, setFormFornecedor] = useState<Partial<Fornecedor> | null>(null);
  const [formNegociacao, setFormNegociacao] = useState<Partial<Negociacao> | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [listaFornecedores, listaNegociacoes] = await Promise.all([
        fetchFornecedores({ q: busca || undefined }),
        fetchNegociacoes(),
      ]);
      setFornecedores(listaFornecedores);
      setNegociacoes(listaNegociacoes);
    } catch (e) {
      setErro(getErrorMessage(e, 'Falha ao carregar o módulo de compras.'));
    } finally {
      setCarregando(false);
    }
  }, [busca]);

  useEffect(() => {
    // Pequeno atraso para a busca não disparar a cada tecla.
    const timer = window.setTimeout(() => void carregar(), busca ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [carregar, busca]);

  const mapaFornecedores = useMemo(
    () => new Map(fornecedores.map((f) => [f.id, f.nome])),
    [fornecedores]
  );

  const salvar = async () => {
    setSalvando(true);
    setErroForm(null);
    try {
      if (formFornecedor) {
        await salvarFornecedor(formFornecedor, formFornecedor.id);
        setFormFornecedor(null);
      } else if (formNegociacao) {
        await salvarNegociacao(formNegociacao, formNegociacao.id);
        setFormNegociacao(null);
      }
      await carregar();
    } catch (e) {
      setErroForm(getErrorMessage(e, 'Não foi possível salvar.'));
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async (tipo: Aba, id: number) => {
    if (!window.confirm('Remover este registro? A ação não pode ser desfeita.')) return;
    try {
      if (tipo === 'fornecedores') await removerFornecedor(id);
      else await removerNegociacao(id);
      await carregar();
    } catch (e) {
      setErro(getErrorMessage(e, 'Não foi possível remover.'));
    }
  };

  const th: React.CSSProperties = {
    padding: '9px 12px',
    fontSize: 10.5,
    fontWeight: 700,
    color: t.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    textAlign: 'left',
    borderBottom: `1px solid ${t.border}`,
    background: t.surfaceElevated,
  };
  const td: React.CSSProperties = {
    padding: '9px 12px',
    fontSize: 12.5,
    color: t.text,
    borderBottom: `1px solid ${t.border}`,
  };
  const campo: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    borderRadius: 8,
    border: `1px solid ${t.border}`,
    background: t.surfaceElevated,
    color: t.text,
    fontSize: 13,
    boxSizing: 'border-box',
  };
  const rotulo: React.CSSProperties = {
    fontSize: 10.5,
    color: t.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: 4,
    display: 'block',
  };
  const botaoIcone: React.CSSProperties = {
    width: 27,
    height: 27,
    minHeight: 27,
    borderRadius: 7,
    border: `1px solid ${t.border}`,
    background: 'transparent',
    color: t.textSecondary,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  };

  const Resumo: React.FC<{ rotulo: string; valor: string; destaque?: boolean }> = ({ rotulo: r, valor, destaque }) => (
    <div className="ga-card" style={{ padding: '12px 14px', flex: '1 1 150px', minWidth: 0 }}>
      <div style={{ fontSize: 10.5, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{r}</div>
      <div className="num" style={{ fontSize: 17, fontWeight: 700, color: destaque ? t.accentTeal : t.text, marginTop: 4 }}>
        {valor}
      </div>
    </div>
  );

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 18,
        }}
      >
        <div>
          <h1 className="num" style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: t.text }}>
            Compras
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: t.textSecondary }}>
            Fornecedores, negociações e fechamentos — custos, descontos, bonificações e investimentos.
          </p>
        </div>
        {podeEditar && (
          <button
            onClick={() => {
              setErroForm(null);
              if (aba === 'fornecedores') setFormFornecedor({ status: 'Ativo' });
              else setFormNegociacao({ status: 'aberta', dataNegociacao: new Date().toISOString().slice(0, 10) });
            }}
            className="ga-tap"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              padding: '8px 14px',
              borderRadius: 8,
              border: 'none',
              background: `linear-gradient(135deg, ${t.gradientFrom}, ${t.gradientTo})`,
              color: '#fff',
              cursor: 'pointer',
              fontSize: 12.5,
              fontWeight: 600,
            }}
          >
            <Plus size={14} /> {aba === 'fornecedores' ? 'Novo fornecedor' : 'Nova negociação'}
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <div
          style={{
            display: 'inline-flex',
            gap: 2,
            padding: 3,
            borderRadius: 10,
            background: t.surfaceElevated,
            border: `1px solid ${t.border}`,
          }}
        >
          {([
            { id: 'negociacoes' as Aba, rotulo: 'Negociações', icone: <Handshake size={14} /> },
            { id: 'fornecedores' as Aba, rotulo: 'Fornecedores', icone: <Truck size={14} /> },
          ]).map((item) => {
            const ativo = aba === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setAba(item.id)}
                className="ga-tap"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '7px 15px',
                  borderRadius: 8,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 12.5,
                  fontWeight: ativo ? 700 : 500,
                  color: ativo ? '#fff' : t.textSecondary,
                  background: ativo ? `linear-gradient(135deg, ${t.gradientFrom}, ${t.gradientTo})` : 'transparent',
                }}
              >
                {item.icone}
                {item.rotulo}
              </button>
            );
          })}
        </div>

        {aba === 'fornecedores' && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              padding: '6px 11px',
              borderRadius: 8,
              border: `1px solid ${t.border}`,
              background: t.surface,
            }}
          >
            <Search size={14} color={t.textMuted} />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Nome, CNPJ ou fabricante"
              style={{ border: 'none', outline: 'none', background: 'transparent', color: t.text, fontSize: 12.5, minWidth: 180 }}
            />
          </div>
        )}
      </div>

      {carregando && <LoadingBlock label="Carregando compras..." />}
      {erro && <ErrorBlock message={erro} />}

      {!carregando && !erro && aba === 'negociacoes' && negociacoes && (
        <>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <Resumo rotulo="Negociações" valor={String(negociacoes.resumo.total)} />
            <Resumo rotulo="Fechadas" valor={String(negociacoes.resumo.fechadas)} />
            <Resumo rotulo="Valor de compra" valor={fmtBRL(negociacoes.resumo.valorCompra)} />
            <Resumo rotulo="Descontos" valor={`${fmtBRL(negociacoes.resumo.desconto)} · ${fmtPct(negociacoes.resumo.pctDesconto)}`} />
            <Resumo rotulo="Bonificações" valor={fmtBRL(negociacoes.resumo.bonificacao)} />
            <Resumo rotulo="Investimentos" valor={fmtBRL(negociacoes.resumo.investimento)} />
            <Resumo rotulo="Custo líquido" valor={fmtBRL(negociacoes.resumo.custoLiquido)} destaque />
          </div>

          <div className="ga-card" style={{ overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 880 }}>
                <thead>
                  <tr>
                    <th style={th}>Data</th>
                    <th style={th}>Fornecedor</th>
                    <th style={th}>Fabricante</th>
                    <th style={{ ...th, textAlign: 'right' }}>Compra</th>
                    <th style={{ ...th, textAlign: 'right' }}>Desconto</th>
                    <th style={{ ...th, textAlign: 'right' }}>Bonificação</th>
                    <th style={{ ...th, textAlign: 'right' }}>Investimento</th>
                    <th style={{ ...th, textAlign: 'right' }}>Custo líquido</th>
                    <th style={th}>Status</th>
                    {podeEditar && <th style={th} />}
                  </tr>
                </thead>
                <tbody>
                  {negociacoes.negociacoes.length === 0 && (
                    <tr>
                      <td style={{ ...td, color: t.textMuted }} colSpan={podeEditar ? 10 : 9}>
                        Nenhuma negociação registrada.
                      </td>
                    </tr>
                  )}
                  {negociacoes.negociacoes.map((n) => (
                    <tr key={n.id}>
                      <td className="num" style={td}>
                        {n.dataNegociacao ? n.dataNegociacao.split('-').reverse().join('/') : '—'}
                      </td>
                      <td style={td}>{n.fornecedor || (n.fornecedorId ? mapaFornecedores.get(n.fornecedorId) : '—') || '—'}</td>
                      <td style={{ ...td, color: t.textSecondary }}>{n.fabricante || '—'}</td>
                      <td className="num" style={{ ...td, textAlign: 'right' }}>{fmtBRL(n.valorCompra)}</td>
                      <td className="num" style={{ ...td, textAlign: 'right' }}>{fmtBRL(n.desconto)}</td>
                      <td className="num" style={{ ...td, textAlign: 'right' }}>{fmtBRL(n.bonificacao)}</td>
                      <td className="num" style={{ ...td, textAlign: 'right' }}>{fmtBRL(n.investimento)}</td>
                      <td className="num" style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{fmtBRL(n.custoLiquido)}</td>
                      <td style={td}>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: 20,
                            fontSize: 11,
                            background:
                              n.status === 'fechada' ? `${t.success}1F` : n.status === 'cancelada' ? `${t.danger}1F` : t.surfaceElevated,
                            color: n.status === 'fechada' ? t.success : n.status === 'cancelada' ? t.danger : t.textSecondary,
                            border: `1px solid ${t.border}`,
                          }}
                        >
                          {STATUS_NEGOCIACAO.find((s) => s.id === n.status)?.rotulo}
                        </span>
                      </td>
                      {podeEditar && (
                        <td style={{ ...td, whiteSpace: 'nowrap' }}>
                          <span style={{ display: 'inline-flex', gap: 5 }}>
                            <button onClick={() => setFormNegociacao(n)} aria-label="Editar" style={botaoIcone}>
                              <Pencil size={12} />
                            </button>
                            <button onClick={() => excluir('negociacoes', n.id)} aria-label="Remover" style={botaoIcone}>
                              <Trash2 size={12} />
                            </button>
                          </span>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!carregando && !erro && aba === 'fornecedores' && (
        <div className="ga-card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 780 }}>
              <thead>
                <tr>
                  <th style={th}>Fornecedor</th>
                  <th style={th}>CNPJ</th>
                  <th style={th}>Fabricante</th>
                  <th style={th}>Contato</th>
                  <th style={th}>Condição de pagamento</th>
                  <th style={th}>Status</th>
                  {podeEditar && <th style={th} />}
                </tr>
              </thead>
              <tbody>
                {fornecedores.length === 0 && (
                  <tr>
                    <td style={{ ...td, color: t.textMuted }} colSpan={podeEditar ? 7 : 6}>
                      Nenhum fornecedor cadastrado.
                    </td>
                  </tr>
                )}
                {fornecedores.map((f) => (
                  <tr key={f.id}>
                    <td style={{ ...td, fontWeight: 600 }}>{f.nome}</td>
                    <td className="num" style={{ ...td, color: t.textSecondary }}>{f.cnpj || '—'}</td>
                    <td style={{ ...td, color: t.textSecondary }}>{f.fabricante || '—'}</td>
                    <td style={{ ...td, color: t.textSecondary }}>
                      {[f.contato, f.email, f.telefone].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td style={{ ...td, color: t.textSecondary }}>{f.condicaoPagamento || '—'}</td>
                    <td style={td}>
                      <span style={{ color: f.status === 'Ativo' ? t.success : t.textMuted, fontSize: 12 }}>{f.status}</span>
                    </td>
                    {podeEditar && (
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>
                        <span style={{ display: 'inline-flex', gap: 5 }}>
                          <button onClick={() => setFormFornecedor(f)} aria-label="Editar" style={botaoIcone}>
                            <Pencil size={12} />
                          </button>
                          <button onClick={() => excluir('fornecedores', f.id)} aria-label="Remover" style={botaoIcone}>
                            <Trash2 size={12} />
                          </button>
                        </span>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Formulários */}
      {(formFornecedor || formNegociacao) && (
        <div
          onClick={() => {
            setFormFornecedor(null);
            setFormNegociacao(null);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(3, 7, 14, 0.66)',
            backdropFilter: 'blur(4px)',
            zIndex: 130,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            className="ga-fade-in"
            style={{
              width: '100%',
              maxWidth: 560,
              maxHeight: '88vh',
              overflowY: 'auto',
              background: t.surface,
              border: `1px solid ${t.border}`,
              borderRadius: 14,
              boxShadow: t.shadow,
            }}
          >
            <div className="ga-accent-bar" />
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 18px',
                borderBottom: `1px solid ${t.border}`,
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>
                {formFornecedor
                  ? formFornecedor.id
                    ? 'Editar fornecedor'
                    : 'Novo fornecedor'
                  : formNegociacao?.id
                    ? 'Editar negociação'
                    : 'Nova negociação'}
              </span>
              <button
                onClick={() => {
                  setFormFornecedor(null);
                  setFormNegociacao(null);
                }}
                aria-label="Fechar"
                style={botaoIcone}
              >
                <X size={14} />
              </button>
            </div>

            <div style={{ padding: 18, display: 'grid', gap: 12 }}>
              {formFornecedor && (
                <>
                  <div>
                    <label style={rotulo}>Nome *</label>
                    <input
                      style={campo}
                      value={formFornecedor.nome || ''}
                      onChange={(e) => setFormFornecedor({ ...formFornecedor, nome: e.target.value })}
                    />
                  </div>
                  <div className="grade-responsiva" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                    <div>
                      <label style={rotulo}>CNPJ</label>
                      <input
                        style={campo}
                        value={formFornecedor.cnpj || ''}
                        onChange={(e) => setFormFornecedor({ ...formFornecedor, cnpj: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={rotulo}>Fabricante</label>
                      <input
                        style={campo}
                        value={formFornecedor.fabricante || ''}
                        onChange={(e) => setFormFornecedor({ ...formFornecedor, fabricante: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={rotulo}>Contato</label>
                      <input
                        style={campo}
                        value={formFornecedor.contato || ''}
                        onChange={(e) => setFormFornecedor({ ...formFornecedor, contato: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={rotulo}>E-mail</label>
                      <input
                        style={campo}
                        value={formFornecedor.email || ''}
                        onChange={(e) => setFormFornecedor({ ...formFornecedor, email: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={rotulo}>Telefone</label>
                      <input
                        style={campo}
                        value={formFornecedor.telefone || ''}
                        onChange={(e) => setFormFornecedor({ ...formFornecedor, telefone: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={rotulo}>Condição de pagamento</label>
                      <input
                        style={campo}
                        value={formFornecedor.condicaoPagamento || ''}
                        onChange={(e) => setFormFornecedor({ ...formFornecedor, condicaoPagamento: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={rotulo}>Status</label>
                      <select
                        style={campo}
                        value={formFornecedor.status || 'Ativo'}
                        onChange={(e) =>
                          setFormFornecedor({ ...formFornecedor, status: e.target.value as 'Ativo' | 'Inativo' })
                        }
                      >
                        <option value="Ativo">Ativo</option>
                        <option value="Inativo">Inativo</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label style={rotulo}>Observações</label>
                    <textarea
                      style={{ ...campo, minHeight: 70, resize: 'vertical' }}
                      value={formFornecedor.observacoes || ''}
                      onChange={(e) => setFormFornecedor({ ...formFornecedor, observacoes: e.target.value })}
                    />
                  </div>
                </>
              )}

              {formNegociacao && (
                <>
                  <div className="grade-responsiva" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                    <div>
                      <label style={rotulo}>Fornecedor</label>
                      <select
                        style={campo}
                        value={formNegociacao.fornecedorId ?? ''}
                        onChange={(e) =>
                          setFormNegociacao({
                            ...formNegociacao,
                            fornecedorId: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                      >
                        <option value="">—</option>
                        {fornecedores.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.nome}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={rotulo}>Data *</label>
                      <input
                        type="date"
                        style={campo}
                        value={(formNegociacao.dataNegociacao || '').slice(0, 10)}
                        onChange={(e) => setFormNegociacao({ ...formNegociacao, dataNegociacao: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={rotulo}>Fabricante</label>
                      <input
                        style={campo}
                        value={formNegociacao.fabricante || ''}
                        onChange={(e) => setFormNegociacao({ ...formNegociacao, fabricante: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={rotulo}>Categoria</label>
                      <input
                        style={campo}
                        value={formNegociacao.categoria || ''}
                        onChange={(e) => setFormNegociacao({ ...formNegociacao, categoria: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={rotulo}>Valor de compra (R$)</label>
                      <input
                        type="number"
                        style={campo}
                        value={formNegociacao.valorCompra ?? ''}
                        onChange={(e) =>
                          setFormNegociacao({ ...formNegociacao, valorCompra: Number(e.target.value) })
                        }
                      />
                    </div>
                    <div>
                      <label style={rotulo}>Desconto (R$)</label>
                      <input
                        type="number"
                        style={campo}
                        value={formNegociacao.desconto ?? ''}
                        onChange={(e) => setFormNegociacao({ ...formNegociacao, desconto: Number(e.target.value) })}
                      />
                    </div>
                    <div>
                      <label style={rotulo}>Bonificação (R$)</label>
                      <input
                        type="number"
                        style={campo}
                        value={formNegociacao.bonificacao ?? ''}
                        onChange={(e) => setFormNegociacao({ ...formNegociacao, bonificacao: Number(e.target.value) })}
                      />
                    </div>
                    <div>
                      <label style={rotulo}>Investimento (R$)</label>
                      <input
                        type="number"
                        style={campo}
                        value={formNegociacao.investimento ?? ''}
                        onChange={(e) => setFormNegociacao({ ...formNegociacao, investimento: Number(e.target.value) })}
                      />
                    </div>
                    <div>
                      <label style={rotulo}>Status</label>
                      <select
                        style={campo}
                        value={formNegociacao.status || 'aberta'}
                        onChange={(e) =>
                          setFormNegociacao({ ...formNegociacao, status: e.target.value as NegociacaoStatus })
                        }
                      >
                        {STATUS_NEGOCIACAO.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.rotulo}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label style={rotulo}>Descrição</label>
                    <textarea
                      style={{ ...campo, minHeight: 70, resize: 'vertical' }}
                      value={formNegociacao.descricao || ''}
                      onChange={(e) => setFormNegociacao({ ...formNegociacao, descricao: e.target.value })}
                    />
                  </div>
                </>
              )}

              {erroForm && <div style={{ fontSize: 12.5, color: t.danger }}>{erroForm}</div>}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  onClick={() => {
                    setFormFornecedor(null);
                    setFormNegociacao(null);
                  }}
                  className="ga-tap"
                  style={{
                    padding: '9px 16px',
                    borderRadius: 8,
                    border: `1px solid ${t.border}`,
                    background: 'transparent',
                    color: t.textSecondary,
                    cursor: 'pointer',
                    fontSize: 13,
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={salvar}
                  disabled={salvando || (!!formFornecedor && !formFornecedor.nome) || (!!formNegociacao && !formNegociacao.dataNegociacao)}
                  className="ga-tap"
                  style={{
                    padding: '9px 18px',
                    borderRadius: 8,
                    border: 'none',
                    background: `linear-gradient(135deg, ${t.gradientFrom}, ${t.gradientTo})`,
                    color: '#fff',
                    cursor: salvando ? 'wait' : 'pointer',
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  {salvando ? 'Salvando…' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
