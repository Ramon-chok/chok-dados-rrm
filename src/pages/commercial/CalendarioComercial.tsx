import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Trash2, X, Pencil, PartyPopper } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { ErrorBlock, LoadingBlock } from '../../components/common/DataState';
import { getErrorMessage } from '../../lib/api';
import {
  CalendarioResponse,
  EventoComercial,
  EventoStatus,
  EventoTipo,
  atualizarEvento,
  criarEvento,
  fetchCalendario,
  removerEvento,
} from '../../lib/insights';
import { DIAS_CURTOS, FIM_DE_SEMANA, MESES, isoDia, linhasDoMes, mesmoDia } from '../../lib/semanaComercial';
import { Feriado, feriadoDe, feriadosDoMes } from '../../lib/feriados';

/**
 * Seção 8 — Calendário comercial e semanas SAR.
 *
 * Abre automaticamente no mês atual e permite navegar para qualquer mês/ano.
 * As semanas são as do calendário civil: **domingo a sábado**.
 *
 * Ao lado de **cada linha semanal** aparece o número do ciclo comercial interno
 * ("SEMANA 3"), que segue a referência combinada — janeiro/2026 começa na
 * Semana 3 — e **nunca reinicia** ao virar mês ou ano.
 *
 * Feriados nacionais e pontos facultativos (Carnaval, Cinzas, Corpus Christi)
 * vêm de `src/lib/feriados.ts`, calculados no próprio navegador.
 *
 * A numeração vem de `src/lib/semanaComercial.ts`, espelho exato da função do
 * backend; as duas são testadas contra a mesma referência.
 */

const TIPOS: Array<{ id: EventoTipo; rotulo: string; cor: (t: any) => string }> = [
  { id: 'campanha', rotulo: 'Campanha', cor: (t) => t.primary },
  { id: 'oportunidade', rotulo: 'Oportunidade', cor: (t) => t.accentTeal },
  { id: 'acao_fabricante', rotulo: 'Ação de fabricante', cor: (t) => t.accentBlueLight },
  { id: 'reuniao', rotulo: 'Reunião', cor: (t) => t.warning },
  { id: 'outro', rotulo: 'Outro', cor: (t) => t.textMuted },
];

const STATUS: Array<{ id: EventoStatus; rotulo: string }> = [
  { id: 'planejado', rotulo: 'Planejado' },
  { id: 'em_andamento', rotulo: 'Em andamento' },
  { id: 'concluido', rotulo: 'Concluído' },
  { id: 'cancelado', rotulo: 'Cancelado' },
];

const fmtBRL = (v: number) => `R$ ${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;

const VAZIO = {
  titulo: '',
  descricao: '',
  tipo: 'campanha' as EventoTipo,
  dataInicio: '',
  dataFim: '',
  fabricante: '',
  categoria: '',
  equipe: '',
  codVendedor: '',
  responsavel: '',
  potencialFaturamento: '',
  investimentoPrevisto: '',
  faturamentoRealizado: '',
  investimentoRealizado: '',
  status: 'planejado' as EventoStatus,
};

type Formulario = typeof VAZIO;

export const CalendarioComercialPage: React.FC = () => {
  const { t } = useTheme();
  const hoje = useMemo(() => new Date(), []);
  // Abre no mês atual, como pedido.
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() + 1);

  const [dados, setDados] = useState<CalendarioResponse | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);

  const [formAberto, setFormAberto] = useState(false);
  const [editando, setEditando] = useState<number | null>(null);
  const [form, setForm] = useState<Formulario>(VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setDados(await fetchCalendario(ano, mes));
    } catch (e) {
      setErro(getErrorMessage(e, 'Falha ao carregar o calendário.'));
    } finally {
      setCarregando(false);
    }
  }, [ano, mes]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const linhas = useMemo(() => linhasDoMes(ano, mes), [ano, mes]);

  /** Eventos que tocam cada dia (um evento com intervalo aparece em todos). */
  const eventosPorDia = useMemo(() => {
    const mapa = new Map<string, EventoComercial[]>();
    (dados?.eventos || []).forEach((evento) => {
      const inicio = evento.dataInicio.slice(0, 10);
      const fim = (evento.dataFim || evento.dataInicio).slice(0, 10);
      linhas.forEach((linha) =>
        linha.dias.forEach((dia) => {
          const chave = isoDia(dia);
          if (chave >= inicio && chave <= fim) {
            mapa.set(chave, [...(mapa.get(chave) || []), evento]);
          }
        })
      );
    });
    return mapa;
  }, [dados, linhas]);

  const eventosDoDia = diaSelecionado ? eventosPorDia.get(diaSelecionado) || [] : [];

  /** Feriados que caem no mês exibido, para a lista lateral. */
  const feriadosDoMesAtual = useMemo(() => feriadosDoMes(ano, mes), [ano, mes]);

  const navegar = (passo: number) => {
    const alvo = new Date(ano, mes - 1 + passo, 1);
    setAno(alvo.getFullYear());
    setMes(alvo.getMonth() + 1);
    setDiaSelecionado(null);
  };

  const abrirNovo = (dia?: string) => {
    setEditando(null);
    setErroForm(null);
    setForm({ ...VAZIO, dataInicio: dia || diaSelecionado || isoDia(hoje) });
    setFormAberto(true);
  };

  const abrirEdicao = (evento: EventoComercial) => {
    setEditando(evento.id);
    setErroForm(null);
    setForm({
      titulo: evento.titulo,
      descricao: evento.descricao || '',
      tipo: evento.tipo,
      dataInicio: evento.dataInicio.slice(0, 10),
      dataFim: (evento.dataFim || '').slice(0, 10),
      fabricante: evento.fabricante || '',
      categoria: evento.categoria || '',
      equipe: evento.equipe || '',
      codVendedor: evento.codVendedor || '',
      responsavel: evento.responsavel || '',
      potencialFaturamento: String(evento.potencialFaturamento || ''),
      investimentoPrevisto: String(evento.investimentoPrevisto || ''),
      faturamentoRealizado: String(evento.faturamentoRealizado || ''),
      investimentoRealizado: String(evento.investimentoRealizado || ''),
      status: evento.status,
    });
    setFormAberto(true);
  };

  const salvar = async () => {
    setSalvando(true);
    setErroForm(null);
    const payload = {
      ...form,
      dataFim: form.dataFim || null,
      potencialFaturamento: form.potencialFaturamento ? Number(form.potencialFaturamento) : null,
      investimentoPrevisto: form.investimentoPrevisto ? Number(form.investimentoPrevisto) : null,
      faturamentoRealizado: form.faturamentoRealizado ? Number(form.faturamentoRealizado) : null,
      investimentoRealizado: form.investimentoRealizado ? Number(form.investimentoRealizado) : null,
    } as any;
    try {
      if (editando) await atualizarEvento(editando, payload);
      else await criarEvento(payload);
      setFormAberto(false);
      await carregar();
    } catch (e) {
      setErroForm(getErrorMessage(e, 'Não foi possível salvar o evento.'));
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async (id: number) => {
    // Remoção é irreversível: confirma antes.
    if (!window.confirm('Remover este evento do calendário?')) return;
    try {
      await removerEvento(id);
      await carregar();
    } catch (e) {
      setErro(getErrorMessage(e, 'Não foi possível remover o evento.'));
    }
  };

  const corDoTipo = (tipo: EventoTipo) => (TIPOS.find((x) => x.id === tipo)?.cor || (() => t.primary))(t);

  /** Feriado nacional pesa mais que ponto facultativo — a cor reflete isso. */
  const corDoFeriado = (feriado: Feriado) =>
    feriado.tipo === 'facultativo' ? t.warning : t.complementaryRed;

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

  const podeEditar = !!dados?.podeEditar;

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
            Calendário Comercial
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: t.textSecondary }}>
            Campanhas, oportunidades e ações de fabricante — com as semanas do ciclo SAR.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              border: `1px solid ${t.border}`,
              borderRadius: 9,
              background: t.surface,
              padding: 3,
            }}
          >
            <button onClick={() => navegar(-1)} aria-label="Mês anterior" style={botaoIcone(t)}>
              <ChevronLeft size={15} />
            </button>
            <span className="num" style={{ fontSize: 13, fontWeight: 700, color: t.text, minWidth: 136, textAlign: 'center' }}>
              {MESES[mes - 1]} / {ano}
            </span>
            <button onClick={() => navegar(1)} aria-label="Próximo mês" style={botaoIcone(t)}>
              <ChevronRight size={15} />
            </button>
          </div>
          <button
            onClick={() => {
              setAno(hoje.getFullYear());
              setMes(hoje.getMonth() + 1);
              setDiaSelecionado(null);
            }}
            className="ga-tap"
            style={{
              padding: '7px 13px',
              borderRadius: 8,
              border: `1px solid ${t.border}`,
              background: t.surface,
              color: t.textSecondary,
              cursor: 'pointer',
              fontSize: 12.5,
            }}
          >
            Hoje
          </button>
          {podeEditar && (
            <button
              onClick={() => abrirNovo()}
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
              <Plus size={14} /> Novo evento
            </button>
          )}
        </div>
      </div>

      {carregando && <LoadingBlock label="Carregando calendário..." />}
      {erro && <ErrorBlock message={erro} />}

      {!carregando && !erro && (
        <div className="cal-layout">
          <div className="ga-card" style={{ padding: 14, overflowX: 'auto' }}>
            <div style={{ minWidth: 680 }}>
              {/* Cabeçalho dos dias — a primeira coluna é a faixa da semana. */}
              <div style={{ display: 'grid', gridTemplateColumns: '84px repeat(7, 1fr)', gap: 6, marginBottom: 6 }}>
                <div />
                {DIAS_CURTOS.map((dia, indice) => (
                  <div
                    key={dia}
                    style={{
                      textAlign: 'center',
                      fontSize: 10.5,
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      // Fim de semana em tom mais apagado: a semana de trabalho
                      // fica visualmente separada sem precisar de outra cor.
                      color: FIM_DE_SEMANA.includes(indice) ? t.textMuted : t.textSecondary,
                      opacity: FIM_DE_SEMANA.includes(indice) ? 0.75 : 1,
                      padding: '4px 0',
                    }}
                  >
                    {dia}
                  </div>
                ))}
              </div>

              {linhas.map((linha) => (
                <div
                  key={isoDia(linha.inicio)}
                  style={{ display: 'grid', gridTemplateColumns: '84px repeat(7, 1fr)', gap: 6, marginBottom: 6 }}
                >
                  {/* Identificador da semana comercial, ao lado da linha */}
                  <div
                    title="Ciclo comercial interno de 4 semanas (não é a semana ISO do ano)"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 9,
                      background: `${t.accentTeal}12`,
                      border: `1px solid ${t.accentTeal}33`,
                      padding: '6px 4px',
                    }}
                  >
                    <span style={{ fontSize: 8.5, letterSpacing: '0.1em', color: t.textMuted, fontWeight: 700 }}>
                      SEMANA
                    </span>
                    <span className="num" style={{ fontSize: 19, fontWeight: 700, color: t.accentTeal, lineHeight: 1.1 }}>
                      {linha.semana}
                    </span>
                  </div>

                  {linha.dias.map((dia) => {
                    const chave = isoDia(dia);
                    const doMes = dia.getMonth() === mes - 1;
                    const eventos = eventosPorDia.get(chave) || [];
                    const ehHoje = mesmoDia(dia, hoje);
                    const selecionado = diaSelecionado === chave;
                    const feriado = feriadoDe(dia);
                    const ehFimDeSemana = FIM_DE_SEMANA.includes(dia.getDay());
                    // Prioridade da borda: hoje > dia selecionado > feriado > padrão.
                    const corBorda = ehHoje
                      ? t.accentTeal
                      : selecionado
                        ? t.primary
                        : feriado
                          ? `${corDoFeriado(feriado)}66`
                          : t.border;
                    const fundo = selecionado
                      ? `${t.primary}1F`
                      : feriado && doMes
                        ? `${corDoFeriado(feriado)}14`
                        : doMes && !ehFimDeSemana
                          ? t.surfaceElevated
                          : 'transparent';
                    return (
                      <div
                        key={chave}
                        onClick={() => setDiaSelecionado(selecionado ? null : chave)}
                        onDoubleClick={() => podeEditar && abrirNovo(chave)}
                        className="ga-tap"
                        title={feriado ? `${feriado.nome}${feriado.tipo === 'facultativo' ? ' (ponto facultativo)' : ''}` : undefined}
                        style={{
                          minHeight: 76,
                          borderRadius: 9,
                          padding: '6px 7px',
                          cursor: 'pointer',
                          background: fundo,
                          border: `1px solid ${corBorda}`,
                          opacity: doMes ? 1 : 0.4,
                          transition: 'background 0.16s ease, border-color 0.16s ease',
                          overflow: 'hidden',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                          <span
                            className="num"
                            style={{
                              fontSize: 12,
                              fontWeight: ehHoje ? 700 : 500,
                              color: ehHoje
                                ? t.accentTeal
                                : feriado
                                  ? corDoFeriado(feriado)
                                  : ehFimDeSemana
                                    ? t.textMuted
                                    : t.textSecondary,
                            }}
                          >
                            {dia.getDate()}
                          </span>
                          {feriado && (
                            <span
                              aria-hidden="true"
                              style={{
                                width: 5,
                                height: 5,
                                borderRadius: '50%',
                                background: corDoFeriado(feriado),
                                flexShrink: 0,
                              }}
                            />
                          )}
                        </div>
                        {feriado && (
                          <div
                            style={{
                              fontSize: 9,
                              lineHeight: 1.25,
                              marginBottom: 3,
                              color: corDoFeriado(feriado),
                              fontWeight: 600,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {feriado.nome}
                          </div>
                        )}
                        {eventos.slice(0, 2).map((evento) => (
                          <div
                            key={evento.id}
                            title={evento.titulo}
                            style={{
                              fontSize: 9.5,
                              lineHeight: 1.3,
                              padding: '2px 4px',
                              borderRadius: 4,
                              marginBottom: 2,
                              background: `${corDoTipo(evento.tipo)}26`,
                              color: t.text,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              borderLeft: `2px solid ${corDoTipo(evento.tipo)}`,
                            }}
                          >
                            {evento.titulo}
                          </div>
                        ))}
                        {eventos.length > 2 && (
                          <div style={{ fontSize: 9, color: t.textMuted }}>+{eventos.length - 2}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12, fontSize: 10.5, color: t.textMuted }}>
              {TIPOS.map((tipo) => (
                <span key={tipo.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 3, background: tipo.cor(t) }} />
                  {tipo.rotulo}
                </span>
              ))}
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: t.complementaryRed }} />
                Feriado nacional
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: t.warning }} />
                Ponto facultativo
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            {/* Feriados do mês — lista explícita, para não depender só da cor
                na grade. Ponto facultativo vem marcado como tal, porque em
                muitas operações o time trabalha nesses dias. */}
            {feriadosDoMesAtual.length > 0 && (
              <div className="ga-card" style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <PartyPopper size={15} color={t.complementaryRed} />
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: t.text }}>
                    Feriados de {MESES[mes - 1]}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {feriadosDoMesAtual.map((feriado) => (
                    <div
                      key={`${feriado.data}-${feriado.nome}`}
                      style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12 }}
                    >
                      <span
                        className="num"
                        style={{
                          minWidth: 34,
                          textAlign: 'center',
                          padding: '2px 5px',
                          borderRadius: 6,
                          fontWeight: 700,
                          color: corDoFeriado(feriado),
                          background: `${corDoFeriado(feriado)}1A`,
                          border: `1px solid ${corDoFeriado(feriado)}3D`,
                          flexShrink: 0,
                        }}
                      >
                        {feriado.data.slice(8, 10)}
                      </span>
                      <span style={{ color: t.text, flex: 1, minWidth: 0 }}>{feriado.nome}</span>
                      {feriado.tipo === 'facultativo' && (
                        <span style={{ fontSize: 10, color: t.textMuted, flexShrink: 0 }}>facultativo</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Painel lateral: eventos do dia escolhido, ou do mês inteiro */}
            <div className="ga-card" style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <CalendarDays size={15} color={t.accentTeal} />
              <span style={{ fontSize: 12.5, fontWeight: 700, color: t.text }}>
                {diaSelecionado
                  ? `Eventos de ${diaSelecionado.split('-').reverse().join('/')}`
                  : `Eventos de ${MESES[mes - 1]}`}
              </span>
            </div>

            {(diaSelecionado ? eventosDoDia : dados?.eventos || []).length === 0 && (
              <div style={{ fontSize: 12.5, color: t.textMuted, lineHeight: 1.6 }}>
                Nenhum evento registrado.
                {podeEditar && ' Use "Novo evento" ou dê duplo clique em um dia.'}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 560, overflowY: 'auto' }}>
              {(diaSelecionado ? eventosDoDia : dados?.eventos || []).map((evento) => (
                <div
                  key={evento.id}
                  style={{
                    borderLeft: `3px solid ${corDoTipo(evento.tipo)}`,
                    paddingLeft: 10,
                    paddingBottom: 8,
                    borderBottom: `1px solid ${t.border}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{evento.titulo}</div>
                      <div style={{ fontSize: 10.5, color: t.textMuted, marginTop: 2 }}>
                        {evento.dataInicio.split('-').reverse().join('/')}
                        {evento.dataFim ? ` → ${evento.dataFim.split('-').reverse().join('/')}` : ''}
                        {evento.semanaComercial ? ` · Semana ${evento.semanaComercial}` : ''}
                      </div>
                    </div>
                    {podeEditar && (
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        <button onClick={() => abrirEdicao(evento)} aria-label="Editar evento" style={botaoIcone(t)}>
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => excluir(evento.id)} aria-label="Remover evento" style={botaoIcone(t)}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>

                  {evento.descricao && (
                    <div style={{ fontSize: 11.5, color: t.textSecondary, marginTop: 5, lineHeight: 1.5 }}>
                      {evento.descricao}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 7, fontSize: 10.5 }}>
                    {[
                      evento.responsavel && `Resp.: ${evento.responsavel}`,
                      evento.equipe && `Equipe: ${evento.equipe}`,
                      evento.fabricante && `Fabricante: ${evento.fabricante}`,
                      STATUS.find((s) => s.id === evento.status)?.rotulo,
                    ]
                      .filter(Boolean)
                      .map((texto) => (
                        <span
                          key={String(texto)}
                          style={{
                            padding: '2px 7px',
                            borderRadius: 20,
                            background: t.surfaceElevated,
                            border: `1px solid ${t.border}`,
                            color: t.textSecondary,
                          }}
                        >
                          {texto}
                        </span>
                      ))}
                  </div>

                  {(evento.potencialFaturamento > 0 ||
                    evento.investimentoPrevisto > 0 ||
                    evento.faturamentoRealizado > 0 ||
                    evento.investimentoRealizado > 0) && (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                        gap: 6,
                        marginTop: 8,
                        fontSize: 10.5,
                        color: t.textMuted,
                      }}
                    >
                      <span>
                        Potencial: <strong className="num" style={{ color: t.text }}>{fmtBRL(evento.potencialFaturamento)}</strong>
                      </span>
                      <span>
                        Realizado: <strong className="num" style={{ color: t.text }}>{fmtBRL(evento.faturamentoRealizado)}</strong>
                      </span>
                      <span>
                        Invest. previsto: <strong className="num" style={{ color: t.text }}>{fmtBRL(evento.investimentoPrevisto)}</strong>
                      </span>
                      <span>
                        Invest. realizado: <strong className="num" style={{ color: t.text }}>{fmtBRL(evento.investimentoRealizado)}</strong>
                      </span>
                    </div>
                  )}
                </div>
              ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Formulário de evento */}
      {formAberto && (
        <div
          onClick={() => setFormAberto(false)}
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
              maxWidth: 620,
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
                {editando ? 'Editar evento' : 'Novo evento comercial'}
              </span>
              <button onClick={() => setFormAberto(false)} aria-label="Fechar" style={botaoIcone(t)}>
                <X size={15} />
              </button>
            </div>

            <div style={{ padding: 18, display: 'grid', gap: 12 }}>
              <div>
                <label style={rotulo}>Título *</label>
                <input
                  style={campo}
                  value={form.titulo}
                  onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                  placeholder="Ex.: Campanha de verão — Fabricante X"
                />
              </div>

              <div className="grade-responsiva" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                <div>
                  <label style={rotulo}>Tipo</label>
                  <select
                    style={campo}
                    value={form.tipo}
                    onChange={(e) => setForm({ ...form, tipo: e.target.value as EventoTipo })}
                  >
                    {TIPOS.map((tipo) => (
                      <option key={tipo.id} value={tipo.id}>
                        {tipo.rotulo}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={rotulo}>Status</label>
                  <select
                    style={campo}
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as EventoStatus })}
                  >
                    {STATUS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.rotulo}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={rotulo}>Data inicial *</label>
                  <input
                    type="date"
                    style={campo}
                    value={form.dataInicio}
                    onChange={(e) => setForm({ ...form, dataInicio: e.target.value })}
                  />
                </div>
                <div>
                  <label style={rotulo}>Data final</label>
                  <input
                    type="date"
                    style={campo}
                    value={form.dataFim}
                    onChange={(e) => setForm({ ...form, dataFim: e.target.value })}
                  />
                </div>
                <div>
                  <label style={rotulo}>Responsável</label>
                  <input
                    style={campo}
                    value={form.responsavel}
                    onChange={(e) => setForm({ ...form, responsavel: e.target.value })}
                  />
                </div>
                <div>
                  <label style={rotulo}>Equipe</label>
                  <input
                    style={campo}
                    value={form.equipe}
                    onChange={(e) => setForm({ ...form, equipe: e.target.value })}
                  />
                </div>
                <div>
                  <label style={rotulo}>Fabricante</label>
                  <input
                    style={campo}
                    value={form.fabricante}
                    onChange={(e) => setForm({ ...form, fabricante: e.target.value })}
                  />
                </div>
                <div>
                  <label style={rotulo}>Categoria</label>
                  <input
                    style={campo}
                    value={form.categoria}
                    onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                  />
                </div>
                <div>
                  <label style={rotulo}>Potencial de faturamento (R$)</label>
                  <input
                    type="number"
                    style={campo}
                    value={form.potencialFaturamento}
                    onChange={(e) => setForm({ ...form, potencialFaturamento: e.target.value })}
                  />
                </div>
                <div>
                  <label style={rotulo}>Investimento previsto (R$)</label>
                  <input
                    type="number"
                    style={campo}
                    value={form.investimentoPrevisto}
                    onChange={(e) => setForm({ ...form, investimentoPrevisto: e.target.value })}
                  />
                </div>
                <div>
                  <label style={rotulo}>Faturamento realizado (R$)</label>
                  <input
                    type="number"
                    style={campo}
                    value={form.faturamentoRealizado}
                    onChange={(e) => setForm({ ...form, faturamentoRealizado: e.target.value })}
                  />
                </div>
                <div>
                  <label style={rotulo}>Investimento realizado (R$)</label>
                  <input
                    type="number"
                    style={campo}
                    value={form.investimentoRealizado}
                    onChange={(e) => setForm({ ...form, investimentoRealizado: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label style={rotulo}>Descrição</label>
                <textarea
                  style={{ ...campo, minHeight: 80, resize: 'vertical' }}
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                />
              </div>

              {erroForm && <div style={{ fontSize: 12.5, color: t.danger }}>{erroForm}</div>}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  onClick={() => setFormAberto(false)}
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
                  disabled={salvando || !form.titulo || !form.dataInicio}
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
                    opacity: !form.titulo || !form.dataInicio ? 0.55 : 1,
                  }}
                >
                  {salvando ? 'Salvando…' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .cal-layout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 340px;
          gap: 16px;
          align-items: start;
        }
        @media (max-width: 1080px) {
          .cal-layout { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
};

function botaoIcone(t: any): React.CSSProperties {
  return {
    width: 28,
    height: 28,
    minHeight: 28,
    borderRadius: 7,
    border: `1px solid ${t.border}`,
    background: 'transparent',
    color: t.textSecondary,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    flexShrink: 0,
  };
}
