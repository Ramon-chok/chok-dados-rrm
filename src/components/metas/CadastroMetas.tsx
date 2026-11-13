import React, { useEffect, useMemo, useState } from 'react';
import { Target, Plus, Pencil, Trash2, Save, X, Users, User, Factory, Info } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import {
  DashboardFilterOptions,
  MetaGeral,
  TargetRow,
  fetchDashboardFilterOptions,
  fetchManufacturers,
  fetchMetasGerais,
  fetchTargets,
  getErrorMessage,
  removerMetaFabricante,
  removerMetaGeral,
  salvarMetaFabricante,
  salvarMetaGeral,
} from '../../lib/api';
import { ErrorBlock, LoadingBlock } from '../common/DataState';

/**
 * Definir metas direto na tela.
 *
 * Duas abas:
 *   • Metas gerais — por VENDEDOR ou por EQUIPE: cobertura geral, sortimento,
 *     faseamento, faseamento II, desconcentração e desafio. A planilha de
 *     metas não traz nenhuma delas.
 *   • Por fabricante — faturamento e cobertura por vendedor × fabricante, a
 *     mesma tabela da planilha; serve para ajustar uma linha sem reimportar.
 *
 * Campo vazio = "não definido aqui": continua valendo o valor importado da aba
 * Mês. O servidor aplica essa regra em todo lugar que lê meta (Dashboard,
 * Objetivos, ficha do cliente) — a tela só precisa dizer isso ao usuário.
 */

const fmtBRL = (v: number | null) =>
  v === null || v === undefined ? '—' : `R$ ${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
const fmtNum = (v: number | null) => (v === null || v === undefined ? '—' : v.toLocaleString('pt-BR'));

type CampoGeral = 'metaCobertura' | 'metaSortimento' | 'metaFaseamento' | 'metaFaseamentoII' | 'metaDesconcentracao' | 'metaDesafio';

const CAMPOS: Array<{ id: CampoGeral; rotulo: string; dica: string; moeda: boolean }> = [
  { id: 'metaCobertura', rotulo: 'Cobertura geral', dica: 'clientes positivados', moeda: false },
  { id: 'metaSortimento', rotulo: 'Sortimento', dica: 'itens / SKUs', moeda: false },
  { id: 'metaFaseamento', rotulo: 'Faseamento', dica: 'R$', moeda: true },
  { id: 'metaFaseamentoII', rotulo: 'Faseamento II', dica: 'R$ · quando houver', moeda: true },
  { id: 'metaDesconcentracao', rotulo: 'Desconcentração', dica: 'R$', moeda: true },
  { id: 'metaDesafio', rotulo: 'Desafio', dica: 'R$ · quando houver', moeda: true },
];

const mesAtual = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const vazioGeral = (anoMes: string, nivel: 'vendedor' | 'equipe'): MetaGeral => ({
  anoMes,
  nivel,
  chave: '',
  metaCobertura: null,
  metaSortimento: null,
  metaFaseamento: null,
  metaFaseamentoII: null,
  metaDesconcentracao: null,
  metaDesafio: null,
  observacao: '',
});

/** "1.234,5" ou "1234.5" → número; vazio → null. */
const lerNumero = (texto: string): number | null => {
  const limpo = texto.trim().replace(/\s/g, '');
  if (!limpo) return null;
  const normal = limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo;
  const n = Number(normal);
  return Number.isFinite(n) ? n : null;
};

export const CadastroMetas: React.FC<{ anoMesInicial?: string }> = ({ anoMesInicial }) => {
  const { t } = useTheme();
  const [anoMes, setAnoMes] = useState(anoMesInicial || mesAtual());
  const [aba, setAba] = useState<'gerais' | 'fabricante'>('gerais');
  const [nivel, setNivel] = useState<'vendedor' | 'equipe'>('vendedor');

  const [opcoes, setOpcoes] = useState<DashboardFilterOptions | null>(null);
  const [fabricantes, setFabricantes] = useState<string[]>([]);

  const [gerais, setGerais] = useState<MetaGeral[]>([]);
  const [porFabricante, setPorFabricante] = useState<TargetRow[]>([]);
  const [podeGravar, setPodeGravar] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);

  // Formulários (null = fechado)
  const [formGeral, setFormGeral] = useState<MetaGeral | null>(null);
  const [textoGeral, setTextoGeral] = useState<Record<CampoGeral, string>>({} as Record<CampoGeral, string>);
  const [formFab, setFormFab] = useState<{ codVendedor: string; fabricante: string; fat: string; cob: string } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    if (anoMesInicial) setAnoMes(anoMesInicial);
  }, [anoMesInicial]);

  useEffect(() => {
    (async () => {
      try {
        const [opts, fabs] = await Promise.all([fetchDashboardFilterOptions(), fetchManufacturers()]);
        setOpcoes(opts);
        setFabricantes(
          fabs
            .map((f) => String((f as Record<string, unknown>).nome_fabricante || ''))
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b, 'pt-BR'))
        );
      } catch {
        // Sem as listas o formulário ainda aceita digitação livre.
      }
    })();
  }, []);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro(null);
    (async () => {
      try {
        const [g, f] = await Promise.all([fetchMetasGerais(anoMes), fetchTargets({ ano_mes: anoMes })]);
        if (!ativo) return;
        setGerais(g.metas);
        setPodeGravar(g.podeGravar);
        setPorFabricante(f);
      } catch (e) {
        if (ativo) setErro(getErrorMessage(e, 'Falha ao carregar as metas da competência.'));
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [anoMes, recarga]);

  const nomeVendedor = useMemo(() => {
    const m = new Map<string, { nome: string; equipe: string | null }>();
    (opcoes?.vendedores || []).forEach((v) => m.set(v.codVendedor, { nome: v.nome, equipe: v.equipe }));
    return m;
  }, [opcoes]);

  const listaGerais = gerais.filter((g) => g.nivel === nivel);

  const abrirGeral = (meta?: MetaGeral) => {
    const base = meta ? { ...meta } : vazioGeral(anoMes, nivel);
    setFormGeral(base);
    const txt = {} as Record<CampoGeral, string>;
    CAMPOS.forEach((c) => {
      const v = base[c.id];
      txt[c.id] = v === null || v === undefined ? '' : String(v).replace('.', ',');
    });
    setTextoGeral(txt);
    setErroForm(null);
    setAviso(null);
  };

  const salvarGeral = async () => {
    if (!formGeral) return;
    if (!formGeral.chave) {
      setErroForm(formGeral.nivel === 'vendedor' ? 'Escolha o vendedor.' : 'Escolha a equipe.');
      return;
    }
    const payload: MetaGeral = { ...formGeral, anoMes };
    for (const c of CAMPOS) {
      const bruto = textoGeral[c.id] || '';
      const n = lerNumero(bruto);
      if (bruto.trim() && n === null) {
        setErroForm(`Valor inválido em ${c.rotulo}.`);
        return;
      }
      payload[c.id] = n;
    }
    if (CAMPOS.every((c) => payload[c.id] === null)) {
      setErroForm('Preencha pelo menos uma meta.');
      return;
    }
    setSalvando(true);
    setErroForm(null);
    try {
      await salvarMetaGeral(payload);
      setFormGeral(null);
      setAviso('Meta salva. Dashboard e Objetivos já usam o novo valor.');
      setRecarga((x) => x + 1);
    } catch (e) {
      setErroForm(getErrorMessage(e, 'Não foi possível salvar a meta.'));
    } finally {
      setSalvando(false);
    }
  };

  const excluirGeral = async (meta: MetaGeral) => {
    const alvo = meta.nivel === 'vendedor' ? meta.nome || meta.chave : meta.chave;
    if (!window.confirm(`Excluir as metas gerais de ${alvo} em ${anoMes}? Os valores importados voltam a valer.`)) return;
    try {
      await removerMetaGeral({ ano_mes: anoMes, nivel: meta.nivel, chave: meta.chave });
      setRecarga((x) => x + 1);
    } catch (e) {
      setAviso(getErrorMessage(e, 'Não foi possível excluir a meta.'));
    }
  };

  const salvarFab = async () => {
    if (!formFab) return;
    if (!formFab.codVendedor || !formFab.fabricante.trim()) {
      setErroForm('Escolha o vendedor e o fabricante.');
      return;
    }
    const fat = lerNumero(formFab.fat);
    const cob = lerNumero(formFab.cob);
    if ((formFab.fat.trim() && fat === null) || (formFab.cob.trim() && cob === null)) {
      setErroForm('Valor de meta inválido.');
      return;
    }
    if (fat === null && cob === null) {
      setErroForm('Preencha a meta de faturamento ou de cobertura.');
      return;
    }
    setSalvando(true);
    setErroForm(null);
    try {
      await salvarMetaFabricante({
        anoMes,
        codVendedor: formFab.codVendedor,
        equipe: nomeVendedor.get(formFab.codVendedor)?.equipe ?? null,
        fabricante: formFab.fabricante.trim(),
        metaFaturamento: fat,
        metaCobertura: cob,
      });
      setFormFab(null);
      setAviso('Meta por fabricante salva.');
      setRecarga((x) => x + 1);
    } catch (e) {
      setErroForm(getErrorMessage(e, 'Não foi possível salvar a meta.'));
    } finally {
      setSalvando(false);
    }
  };

  const excluirFab = async (r: TargetRow) => {
    if (!window.confirm(`Excluir a meta de ${r.vendedor || r.codVendedor} em ${r.fabricante} (${anoMes})?`)) return;
    try {
      await removerMetaFabricante({ ano_mes: anoMes, cod_vendedor: r.codVendedor, fabricante: r.fabricante || '' });
      setRecarga((x) => x + 1);
    } catch (e) {
      setAviso(getErrorMessage(e, 'Não foi possível excluir a meta.'));
    }
  };

  // ── estilos ────────────────────────────────────────────────────────────
  const campo: React.CSSProperties = {
    width: '100%',
    padding: '9px 11px',
    borderRadius: 9,
    border: `1px solid ${t.border}`,
    background: t.surfaceElevated,
    color: t.text,
    font: 'inherit',
    fontSize: 13.5,
  };
  const rotulo: React.CSSProperties = { display: 'block', fontSize: 11.5, fontWeight: 600, color: t.textSecondary, marginBottom: 5 };
  const th: React.CSSProperties = {
    padding: '9px 12px',
    fontSize: 10.5,
    fontWeight: 700,
    color: t.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    textAlign: 'left',
    background: t.surfaceElevated,
    borderBottom: `1px solid ${t.border}`,
    whiteSpace: 'nowrap',
    position: 'sticky',
    top: 0,
  };
  const td: React.CSSProperties = { padding: '9px 12px', fontSize: 12.5, color: t.text, borderBottom: `1px solid ${t.border}`, whiteSpace: 'nowrap' };
  const botao = (primario: boolean): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 14px',
    borderRadius: 9,
    border: primario ? 'none' : `1px solid ${t.border}`,
    background: primario ? t.primary : 'transparent',
    color: primario ? t.primaryForeground : t.textSecondary,
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
  });
  const iconeAcao: React.CSSProperties = {
    width: 30,
    height: 30,
    minHeight: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    border: `1px solid ${t.border}`,
    background: 'transparent',
    color: t.textSecondary,
    cursor: 'pointer',
  };
  const seletor = (ativo: boolean): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 13px',
    borderRadius: 8,
    border: 'none',
    cursor: 'pointer',
    fontSize: 13,
    minHeight: 0,
    fontWeight: ativo ? 700 : 500,
    color: ativo ? t.primaryForeground : t.textSecondary,
    background: ativo ? t.primary : 'transparent',
  });

  return (
    <section
      style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 14, padding: '18px 18px 20px', marginBottom: 24 }}
    >
      <div className="cabeca-pagina" style={{ marginBottom: 14 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Target size={16} color={t.primary} />
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: t.text }}>Definir metas</h2>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: 12.5, color: t.textSecondary, maxWidth: '70ch' }}>
            Cadastre aqui as metas que a planilha não traz. Campo vazio continua usando o valor importado; campo
            preenchido passa a valer no Dashboard, em Objetivos e na ficha do cliente.
          </p>
        </div>
        <label style={{ flex: '0 0 auto' }}>
          <span style={rotulo}>Competência</span>
          <input
            type="month"
            value={anoMes}
            onChange={(e) => e.target.value && setAnoMes(e.target.value)}
            style={{ ...campo, width: 170, colorScheme: 'inherit' }}
          />
        </label>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ display: 'inline-flex', gap: 2, padding: 3, borderRadius: 10, background: t.surfaceElevated, border: `1px solid ${t.border}` }}>
          <button type="button" style={seletor(aba === 'gerais')} onClick={() => { setAba('gerais'); setFormFab(null); }}>
            <Target size={14} /> Metas gerais
          </button>
          <button type="button" style={seletor(aba === 'fabricante')} onClick={() => { setAba('fabricante'); setFormGeral(null); }}>
            <Factory size={14} /> Por fabricante
          </button>
        </div>
        {aba === 'gerais' && (
          <div style={{ display: 'inline-flex', gap: 2, padding: 3, borderRadius: 10, background: t.surfaceElevated, border: `1px solid ${t.border}` }}>
            <button type="button" style={seletor(nivel === 'vendedor')} onClick={() => { setNivel('vendedor'); setFormGeral(null); }}>
              <User size={14} /> Vendedor
            </button>
            <button type="button" style={seletor(nivel === 'equipe')} onClick={() => { setNivel('equipe'); setFormGeral(null); }}>
              <Users size={14} /> Equipe
            </button>
          </div>
        )}
        {podeGravar && (
          <button
            type="button"
            style={{ ...botao(true), marginLeft: 'auto' }}
            onClick={() => (aba === 'gerais' ? abrirGeral() : (setFormFab({ codVendedor: '', fabricante: '', fat: '', cob: '' }), setErroForm(null)))}
          >
            <Plus size={15} /> Nova meta
          </button>
        )}
      </div>

      {!podeGravar && !carregando && (
        <div style={{ display: 'flex', gap: 8, fontSize: 12.5, color: t.textSecondary, marginBottom: 12 }}>
          <Info size={15} color={t.info} style={{ flexShrink: 0, marginTop: 1 }} />
          Seu perfil está em modo consulta aqui: para gravar metas é preciso permissão de escrita (ou liberação ativa).
        </div>
      )}
      {aviso && (
        <div style={{ fontSize: 12.5, color: t.success, marginBottom: 12 }} role="status">
          {aviso}
        </div>
      )}

      {/* ── Formulário: meta geral ─────────────────────────────── */}
      {formGeral && (
        <div style={{ border: `1px solid ${t.primary}40`, background: `${t.primary}08`, borderRadius: 12, padding: 16, marginBottom: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 12 }}>
            <label style={{ gridColumn: '1 / -1' }}>
              <span style={rotulo}>{formGeral.nivel === 'vendedor' ? 'Vendedor' : 'Equipe'}</span>
              {formGeral.nivel === 'vendedor' ? (
                <select
                  value={formGeral.chave}
                  onChange={(e) => setFormGeral({ ...formGeral, chave: e.target.value })}
                  style={campo}
                  // Ao editar uma meta existente o alvo não muda — trocar o vendedor
                  // aqui gravaria por cima da meta de outra pessoa.
                  disabled={!!formGeral.atualizadoEm}
                >
                  <option value="">Escolha o vendedor…</option>
                  {(opcoes?.vendedores || []).map((v) => (
                    <option key={v.codVendedor} value={v.codVendedor}>
                      {v.nome} ({v.codVendedor}){v.equipe ? ` — ${v.equipe}` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  value={formGeral.chave}
                  onChange={(e) => setFormGeral({ ...formGeral, chave: e.target.value })}
                  style={campo}
                  disabled={!!formGeral.atualizadoEm}
                >
                  <option value="">Escolha a equipe…</option>
                  {(opcoes?.equipes || []).map((eq) => (
                    <option key={eq} value={eq}>
                      {eq}
                    </option>
                  ))}
                </select>
              )}
            </label>
            {CAMPOS.map((c) => (
              <label key={c.id}>
                <span style={rotulo}>
                  {c.rotulo} <span style={{ fontWeight: 400, color: t.textMuted }}>· {c.dica}</span>
                </span>
                <input
                  inputMode="decimal"
                  value={textoGeral[c.id] || ''}
                  onChange={(e) => setTextoGeral({ ...textoGeral, [c.id]: e.target.value })}
                  placeholder="vazio = usa o importado"
                  style={campo}
                />
              </label>
            ))}
            <label style={{ gridColumn: '1 / -1' }}>
              <span style={rotulo}>Observação</span>
              <input
                value={formGeral.observacao || ''}
                onChange={(e) => setFormGeral({ ...formGeral, observacao: e.target.value })}
                maxLength={400}
                placeholder="Opcional — ex.: faseamento II só a partir do dia 15"
                style={campo}
              />
            </label>
          </div>
          {erroForm && <div style={{ fontSize: 12.5, color: t.danger, marginTop: 10 }}>{erroForm}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14, flexWrap: 'wrap' }}>
            <button type="button" style={botao(false)} onClick={() => setFormGeral(null)}>
              <X size={14} /> Cancelar
            </button>
            <button type="button" style={{ ...botao(true), opacity: salvando ? 0.6 : 1 }} onClick={salvarGeral} disabled={salvando}>
              <Save size={14} /> {salvando ? 'Salvando…' : 'Salvar meta'}
            </button>
          </div>
        </div>
      )}

      {/* ── Formulário: meta por fabricante ─────────────────────── */}
      {formFab && (
        <div style={{ border: `1px solid ${t.primary}40`, background: `${t.primary}08`, borderRadius: 12, padding: 16, marginBottom: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 12 }}>
            <label>
              <span style={rotulo}>Vendedor</span>
              <select value={formFab.codVendedor} onChange={(e) => setFormFab({ ...formFab, codVendedor: e.target.value })} style={campo}>
                <option value="">Escolha o vendedor…</option>
                {(opcoes?.vendedores || []).map((v) => (
                  <option key={v.codVendedor} value={v.codVendedor}>
                    {v.nome} ({v.codVendedor})
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span style={rotulo}>Equipe</span>
              <input value={nomeVendedor.get(formFab.codVendedor)?.equipe || '—'} readOnly style={{ ...campo, opacity: 0.75 }} />
            </label>
            <label>
              <span style={rotulo}>Fabricante</span>
              <input
                list="cadastro-metas-fabricantes"
                value={formFab.fabricante}
                onChange={(e) => setFormFab({ ...formFab, fabricante: e.target.value })}
                placeholder="Digite ou escolha"
                style={campo}
              />
              <datalist id="cadastro-metas-fabricantes">
                {fabricantes.map((f) => (
                  <option key={f} value={f} />
                ))}
              </datalist>
            </label>
            <label>
              <span style={rotulo}>Meta de faturamento (R$)</span>
              <input inputMode="decimal" value={formFab.fat} onChange={(e) => setFormFab({ ...formFab, fat: e.target.value })} style={campo} />
            </label>
            <label>
              <span style={rotulo}>Meta de cobertura (clientes)</span>
              <input inputMode="decimal" value={formFab.cob} onChange={(e) => setFormFab({ ...formFab, cob: e.target.value })} style={campo} />
            </label>
          </div>
          {erroForm && <div style={{ fontSize: 12.5, color: t.danger, marginTop: 10 }}>{erroForm}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14, flexWrap: 'wrap' }}>
            <button type="button" style={botao(false)} onClick={() => setFormFab(null)}>
              <X size={14} /> Cancelar
            </button>
            <button type="button" style={{ ...botao(true), opacity: salvando ? 0.6 : 1 }} onClick={salvarFab} disabled={salvando}>
              <Save size={14} /> {salvando ? 'Salvando…' : 'Salvar meta'}
            </button>
          </div>
        </div>
      )}

      {carregando && <LoadingBlock label="Carregando metas da competência…" />}
      {erro && <ErrorBlock message={erro} />}

      {/* ── Lista: metas gerais ─────────────────────────────────── */}
      {!carregando && !erro && aba === 'gerais' && (
        listaGerais.length === 0 ? (
          <div style={{ padding: 22, textAlign: 'center', fontSize: 13, color: t.textMuted, border: `1px dashed ${t.border}`, borderRadius: 12 }}>
            Nenhuma meta geral de {nivel === 'vendedor' ? 'vendedor' : 'equipe'} definida em {anoMes}. Os valores importados estão valendo.
          </div>
        ) : (
          <div className="tabela-rolavel" style={{ border: `1px solid ${t.border}`, borderRadius: 12, maxHeight: 440, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>{nivel === 'vendedor' ? 'Vendedor' : 'Equipe'}</th>
                  {nivel === 'vendedor' && <th style={th}>Equipe</th>}
                  {CAMPOS.map((c) => (
                    <th key={c.id} style={{ ...th, textAlign: 'right' }}>
                      {c.rotulo}
                    </th>
                  ))}
                  {podeGravar && <th style={{ ...th, width: 80 }} />}
                </tr>
              </thead>
              <tbody>
                {listaGerais.map((g) => (
                  <tr key={`${g.nivel}-${g.chave}`}>
                    <td style={{ ...td, fontWeight: 600 }}>
                      {g.nivel === 'vendedor' ? g.nome || nomeVendedor.get(g.chave)?.nome || g.chave : g.chave}
                    </td>
                    {nivel === 'vendedor' && <td style={{ ...td, color: t.textSecondary }}>{g.equipe || '—'}</td>}
                    {CAMPOS.map((c) => (
                      <td key={c.id} className="num" style={{ ...td, textAlign: 'right', color: g[c.id] === null ? t.textMuted : t.text }}>
                        {c.moeda ? fmtBRL(g[c.id]) : fmtNum(g[c.id])}
                      </td>
                    ))}
                    {podeGravar && (
                      <td style={{ ...td, textAlign: 'right' }}>
                        <span style={{ display: 'inline-flex', gap: 6 }}>
                          <button type="button" style={iconeAcao} title="Editar" aria-label="Editar meta" onClick={() => abrirGeral(g)}>
                            <Pencil size={13} />
                          </button>
                          <button type="button" style={{ ...iconeAcao, color: t.danger }} title="Excluir" aria-label="Excluir meta" onClick={() => excluirGeral(g)}>
                            <Trash2 size={13} />
                          </button>
                        </span>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* ── Lista: metas por fabricante ─────────────────────────── */}
      {!carregando && !erro && aba === 'fabricante' && (
        porFabricante.length === 0 ? (
          <div style={{ padding: 22, textAlign: 'center', fontSize: 13, color: t.textMuted, border: `1px dashed ${t.border}`, borderRadius: 12 }}>
            Nenhuma meta por fabricante em {anoMes}. Importe a planilha abaixo ou cadastre em "Nova meta".
          </div>
        ) : (
          <div className="tabela-rolavel" style={{ border: `1px solid ${t.border}`, borderRadius: 12, maxHeight: 440, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Vendedor</th>
                  <th style={th}>Equipe</th>
                  <th style={th}>Fabricante</th>
                  <th style={{ ...th, textAlign: 'right' }}>Faturamento</th>
                  <th style={{ ...th, textAlign: 'right' }}>Cobertura</th>
                  {podeGravar && <th style={{ ...th, width: 80 }} />}
                </tr>
              </thead>
              <tbody>
                {porFabricante.map((r, i) => (
                  <tr key={`${r.codVendedor}-${r.fabricante}-${i}`}>
                    <td style={{ ...td, fontWeight: 600 }}>{r.vendedor || r.codVendedor}</td>
                    <td style={{ ...td, color: t.textSecondary }}>{r.equipe || '—'}</td>
                    <td style={td}>{r.fabricante || '—'}</td>
                    <td className="num" style={{ ...td, textAlign: 'right' }}>{fmtBRL(r.metaFaturamento)}</td>
                    <td className="num" style={{ ...td, textAlign: 'right' }}>{fmtNum(r.metaCobertura)}</td>
                    {podeGravar && (
                      <td style={{ ...td, textAlign: 'right' }}>
                        <span style={{ display: 'inline-flex', gap: 6 }}>
                          <button
                            type="button"
                            style={iconeAcao}
                            title="Editar"
                            aria-label="Editar meta"
                            onClick={() => {
                              setFormFab({
                                codVendedor: r.codVendedor,
                                fabricante: r.fabricante || '',
                                fat: r.metaFaturamento ? String(r.metaFaturamento).replace('.', ',') : '',
                                cob: r.metaCobertura ? String(r.metaCobertura).replace('.', ',') : '',
                              });
                              setErroForm(null);
                            }}
                          >
                            <Pencil size={13} />
                          </button>
                          <button type="button" style={{ ...iconeAcao, color: t.danger }} title="Excluir" aria-label="Excluir meta" onClick={() => excluirFab(r)}>
                            <Trash2 size={13} />
                          </button>
                        </span>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </section>
  );
};
