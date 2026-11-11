import React, { useEffect, useMemo, useState } from 'react';
import { Trophy, Network } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { getErrorMessage } from '../../lib/api';
import { TopClienteItem, fetchTopClientesInsight } from '../../lib/insights';

/**
 * Seção 5 — TOP clientes com alternância entre **dia**, **mês** e **período
 * personalizado**, como pedido.
 *
 * O "mês" usa o período já escolhido no filtro global da aplicação, para não
 * criar um segundo conceito de período dentro da mesma tela.
 */

type Escopo = 'dia' | 'mes' | 'personalizado';

const fmtBRL = (v: number) => `R$ ${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;

export interface TopClientesCardProps {
  /** Período vindo do filtro global. */
  ano?: number;
  mes?: number;
  start?: string;
  end?: string;
  /** Dia de referência sugerido pelos KPIs (última data com carga). */
  diaSugerido?: string | null;
  equipe?: string;
  vendedor?: string;
  limite?: number;
}

export const TopClientesCard: React.FC<TopClientesCardProps> = ({
  ano,
  mes,
  start,
  end,
  diaSugerido,
  equipe,
  vendedor,
  limite = 5,
}) => {
  const { t } = useTheme();
  const [escopo, setEscopo] = useState<Escopo>('mes');
  const [dia, setDia] = useState<string>('');
  const [intervalo, setIntervalo] = useState<{ de: string; ate: string }>({
    de: start || '',
    ate: end || '',
  });
  const [itens, setItens] = useState<TopClienteItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // O dia sugerido pelos KPIs vira o padrão da aba "Dia" (mas o usuário troca).
  useEffect(() => {
    if (diaSugerido && !dia) setDia(diaSugerido);
  }, [diaSugerido, dia]);

  useEffect(() => {
    setIntervalo((atual) => (atual.de || atual.ate ? atual : { de: start || '', ate: end || '' }));
  }, [start, end]);

  const consulta = useMemo(() => {
    if (escopo === 'dia') return { dia: dia || diaSugerido || undefined, equipe, vendedor, limit: limite };
    if (escopo === 'personalizado') {
      return { start: intervalo.de || undefined, end: intervalo.ate || undefined, equipe, vendedor, limit: limite };
    }
    return { ano, mes, start, end, equipe, vendedor, limit: limite };
  }, [escopo, dia, diaSugerido, intervalo, ano, mes, start, end, equipe, vendedor, limite]);

  useEffect(() => {
    let ativo = true;
    (async () => {
      setCarregando(true);
      setErro(null);
      try {
        const resposta = await fetchTopClientesInsight(consulta);
        if (ativo) setItens(resposta.clientes);
      } catch (e) {
        if (ativo) setErro(getErrorMessage(e, 'Falha ao carregar o TOP de clientes.'));
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [consulta]);

  const maior = itens[0]?.valor || 1;

  const botaoEscopo = (id: Escopo, rotulo: string) => {
    const selecionado = escopo === id;
    return (
      <button
        key={id}
        onClick={() => setEscopo(id)}
        className="ga-tap"
        style={{
          padding: '5px 12px',
          borderRadius: 7,
          border: 'none',
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: selecionado ? 700 : 500,
          color: selecionado ? '#fff' : t.textSecondary,
          background: selecionado ? t.primary : 'transparent',
          transition: 'background 0.18s ease, color 0.18s ease',
        }}
      >
        {rotulo}
      </button>
    );
  };

  const estiloData: React.CSSProperties = {
    background: t.surfaceElevated,
    border: `1px solid ${t.border}`,
    color: t.text,
    borderRadius: 7,
    padding: '5px 8px',
    fontSize: 12,
    colorScheme: 'inherit',
  };

  return (
    <div className="ga-card" style={{ padding: '16px 18px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          flexWrap: 'wrap',
          marginBottom: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Trophy size={16} color={t.accentTeal} />
          <span style={{ fontSize: 13.5, fontWeight: 700, color: t.text }}>TOP {limite} Clientes</span>
        </div>
        <div
          style={{
            display: 'inline-flex',
            gap: 2,
            padding: 2,
            borderRadius: 9,
            background: t.surfaceElevated,
            border: `1px solid ${t.border}`,
          }}
        >
          {botaoEscopo('dia', 'Dia')}
          {botaoEscopo('mes', 'Mês')}
          {botaoEscopo('personalizado', 'Período')}
        </div>
      </div>

      {escopo === 'dia' && (
        <div style={{ marginBottom: 12 }}>
          <input
            type="date"
            value={dia}
            onChange={(e) => setDia(e.target.value)}
            style={estiloData}
            aria-label="Dia de referência"
          />
        </div>
      )}

      {escopo === 'personalizado' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <input
            type="date"
            value={intervalo.de}
            onChange={(e) => setIntervalo((a) => ({ ...a, de: e.target.value }))}
            style={estiloData}
            aria-label="Data inicial"
          />
          <input
            type="date"
            value={intervalo.ate}
            onChange={(e) => setIntervalo((a) => ({ ...a, ate: e.target.value }))}
            style={estiloData}
            aria-label="Data final"
          />
        </div>
      )}

      {carregando && <div style={{ fontSize: 12.5, color: t.textMuted, padding: '12px 0' }}>Carregando…</div>}
      {erro && <div style={{ fontSize: 12.5, color: t.danger, padding: '12px 0' }}>{erro}</div>}
      {!carregando && !erro && itens.length === 0 && (
        <div style={{ fontSize: 12.5, color: t.textMuted, padding: '12px 0' }}>
          Nenhum cliente com venda registrada neste recorte.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {itens.map((cliente, posicao) => (
          <div key={`${cliente.codigo || cliente.nome}-${posicao}`} className="ga-fade-in">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
              <span
                className="num"
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  background: posicao === 0 ? `${t.accentTeal}26` : t.surfaceElevated,
                  color: posicao === 0 ? t.accentTeal : t.textMuted,
                  fontSize: 11,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {posicao + 1}
              </span>
              <span
                style={{
                  fontSize: 13,
                  color: t.text,
                  fontWeight: 600,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 1,
                  minWidth: 0,
                }}
                title={cliente.nome}
              >
                {cliente.nome}
              </span>
              {cliente.eRede && (
                <span title="Rede (vários códigos sob o mesmo nome)" style={{ color: t.textMuted, display: 'flex' }}>
                  <Network size={13} />
                </span>
              )}
              <span className="num" style={{ fontSize: 13, fontWeight: 700, color: t.text, flexShrink: 0 }}>
                {fmtBRL(cliente.valor)}
              </span>
            </div>
            <div style={{ height: 4, borderRadius: 2, background: t.surfaceElevated, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.max(2, (cliente.valor / maior) * 100)}%`,
                  height: '100%',
                  background: `linear-gradient(90deg, ${t.gradientFrom}, ${t.gradientTo})`,
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
