import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { SingleSelectFilter } from '../../components/common/SingleSelectFilter';
import {
  clearImportHistory,
  fetchImportHistory,
  getErrorMessage,
  ImportLogEntry,
} from '../../lib/api';
import { labelForTipo } from './importTypes';
import { Clock, FileCheck, RefreshCw, Search, Trash2, XCircle } from 'lucide-react';

type StatusLabel = 'Concluído' | 'Concluído com Avisos' | 'Falha';

interface HistoryItem {
  id: string;
  tipo: string;
  arquivo: string;
  usuario: string;
  dataHora: string;
  /** ISO original, para ordenar e filtrar sem depender do texto formatado. */
  dataISO: string;
  total: number;
  validos: number;
  atualizados: number;
  novos: number;
  rejeitados: number;
  status: StatusLabel;
  mensagemErro: string | null;
}

const STATUS_MAP: Record<ImportLogEntry['status'], StatusLabel> = {
  CONCLUIDO: 'Concluído',
  CONCLUIDO_COM_AVISOS: 'Concluído com Avisos',
  FALHA: 'Falha',
};

/** Converte o registro de auditoria da API no formato exibido na tabela. */
function toHistoryItem(entry: ImportLogEntry): HistoryItem {
  return {
    id: `imp-${entry.id}`,
    // labelForTipo vem da tela de importação: ela conhece os tipos compostos
    // ("<tipo>__<aba>") e devolve "Rótulo do Tipo — Rótulo da Aba".
    tipo: labelForTipo(entry.tipo),
    arquivo: entry.arquivo || '—',
    usuario: entry.usuario_nome || '—',
    dataHora: new Date(entry.data_importacao).toLocaleString('pt-BR'),
    dataISO: entry.data_importacao,
    total: entry.total_linhas,
    validos: entry.total_linhas - entry.rejeitados,
    atualizados: entry.atualizados,
    novos: entry.novos,
    rejeitados: entry.rejeitados,
    status: STATUS_MAP[entry.status] || 'Falha',
    mensagemErro: entry.mensagem_erro || null,
  };
}

const CORES_STATUS: Record<StatusLabel, { fundo: string; texto: string }> = {
  'Concluído': { fundo: 'rgba(61, 214, 140, 0.12)', texto: '#3DD68C' },
  'Concluído com Avisos': { fundo: 'rgba(232, 179, 57, 0.12)', texto: '#E8B339' },
  Falha: { fundo: 'rgba(227, 6, 19, 0.12)', texto: '#FF5A5A' },
};

/** Quantos registros buscar — o backend aceita até 500. */
const LIMITE = 200;

/**
 * Histórico de Importações (ADMIN).
 *
 * Saiu da tela de Dados e Exportações, onde ficava embaixo do assistente: o
 * histórico é consulta e auditoria, não faz parte do fluxo de enviar uma
 * planilha, e crescia a página toda sem necessidade. Aqui ele ganha espaço,
 * filtro por tipo e por status, busca e exportação.
 */
export const HistoricoImportacoesPage: React.FC = () => {
  const { t } = useTheme();

  const [itens, setItens] = useState<HistoryItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [limpando, setLimpando] = useState(false);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  const [busca, setBusca] = useState('');
  const [tipoSel, setTipoSel] = useState('');
  const [statusSel, setStatusSel] = useState('');

  const carregar = async () => {
    setCarregando(true);
    setErro(null);
    try {
      const entradas = await fetchImportHistory(LIMITE);
      setItens(entradas.map(toHistoryItem));
    } catch (e) {
      setErro(getErrorMessage(e, 'Falha ao carregar o histórico de importações.'));
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLimpar = async () => {
    if (itens.length === 0) return;
    if (
      !window.confirm(
        'Limpar todo o histórico de importações? Esta ação não remove os dados já importados nas tabelas de negócio, apenas os registros de auditoria do histórico.'
      )
    ) {
      return;
    }
    setLimpando(true);
    setErroAcao(null);
    try {
      await clearImportHistory();
      setItens([]);
    } catch (e) {
      setErroAcao(getErrorMessage(e, 'Falha ao limpar o histórico de importações.'));
    } finally {
      setLimpando(false);
    }
  };

  const tipoOptions = useMemo(() => {
    const tipos = new Set<string>();
    itens.forEach((i) => tipos.add(i.tipo));
    return Array.from(tipos).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [itens]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return itens.filter((i) => {
      if (tipoSel && i.tipo !== tipoSel) return false;
      if (statusSel && i.status !== statusSel) return false;
      if (!q) return true;
      return (
        i.tipo.toLowerCase().includes(q) ||
        i.arquivo.toLowerCase().includes(q) ||
        i.usuario.toLowerCase().includes(q)
      );
    });
  }, [itens, busca, tipoSel, statusSel]);

  const resumo = useMemo(
    () =>
      filtrados.reduce(
        (acc, i) => ({
          importacoes: acc.importacoes + 1,
          linhas: acc.linhas + i.total,
          novos: acc.novos + i.novos,
          atualizados: acc.atualizados + i.atualizados,
          rejeitados: acc.rejeitados + i.rejeitados,
          falhas: acc.falhas + (i.status === 'Falha' ? 1 : 0),
        }),
        { importacoes: 0, linhas: 0, novos: 0, atualizados: 0, rejeitados: 0, falhas: 0 }
      ),
    [filtrados]
  );

  const th: React.CSSProperties = {
    textAlign: 'left',
    padding: '11px 14px',
    borderBottom: `1px solid ${t.border}`,
    fontWeight: 600,
    fontSize: 11.5,
    color: t.textMuted,
    whiteSpace: 'nowrap',
    position: 'sticky',
    top: 0,
    zIndex: 1,
    background: t.bgSecondary,
  };
  const td: React.CSSProperties = { padding: '11px 14px', whiteSpace: 'nowrap' };

  const kpis: [string, string][] = [
    ['Importações', resumo.importacoes.toLocaleString('pt-BR')],
    ['Linhas processadas', resumo.linhas.toLocaleString('pt-BR')],
    ['Novos', resumo.novos.toLocaleString('pt-BR')],
    ['Atualizados', resumo.atualizados.toLocaleString('pt-BR')],
    ['Rejeitados', resumo.rejeitados.toLocaleString('pt-BR')],
    ['Falhas', resumo.falhas.toLocaleString('pt-BR')],
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h1 className="num" style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: t.text }}>
            Histórico de Importações
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: t.textSecondary }}>
            Auditoria de todas as cargas — as feitas em Dados e Exportações e as da automação. Mostra as{' '}
            {LIMITE} mais recentes.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <button
            type="button"
            onClick={carregar}
            disabled={carregando}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              padding: '9px 14px',
              borderRadius: 8,
              border: `1px solid ${t.border}`,
              background: t.surface,
              color: t.textSecondary,
              fontSize: 13,
              fontWeight: 600,
              cursor: carregando ? 'not-allowed' : 'pointer',
              opacity: carregando ? 0.6 : 1,
            }}
          >
            <RefreshCw size={15} />
            Atualizar
          </button>
        </div>
      </div>

      {/* FILTROS */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          alignItems: 'flex-end',
          flexWrap: 'wrap',
          marginBottom: 16,
          background: t.surface,
          border: `1px solid ${t.border}`,
          borderRadius: 12,
          padding: 12,
        }}
      >
        <SingleSelectFilter
          label="Tipo de dado"
          options={tipoOptions.map((x) => ({ value: x, label: x }))}
          value={tipoSel}
          onChange={setTipoSel}
          placeholder="Todos os tipos"
          allLabel="Todos os tipos"
        />
        <SingleSelectFilter
          label="Status"
          options={(Object.keys(CORES_STATUS) as StatusLabel[]).map((x) => ({ value: x, label: x }))}
          value={statusSel}
          onChange={setStatusSel}
          placeholder="Todos os status"
          allLabel="Todos os status"
        />
        <div style={{ flex: 1, minWidth: 200 }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              fontWeight: 600,
              color: t.textMuted,
              marginBottom: 4,
            }}
          >
            <Search size={12} /> Buscar
          </label>
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Tipo, arquivo ou usuário"
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: 8,
              border: `1px solid ${t.border}`,
              background: t.surfaceElevated,
              color: t.text,
              fontSize: 13,
            }}
          />
        </div>
        <button
          type="button"
          onClick={handleLimpar}
          disabled={limpando || carregando || itens.length === 0}
          title="Remove os registros de auditoria; não apaga os dados já importados"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            padding: '9px 14px',
            borderRadius: 8,
            border: `1px solid ${t.border}`,
            background: t.surfaceElevated,
            color: t.textSecondary,
            fontSize: 12.5,
            fontWeight: 600,
            cursor: limpando || carregando || itens.length === 0 ? 'not-allowed' : 'pointer',
            opacity: limpando || carregando || itens.length === 0 ? 0.55 : 1,
          }}
        >
          <Trash2 size={15} />
          {limpando ? 'Limpando…' : 'Limpar histórico'}
        </button>
      </div>

      {erroAcao && (
        <div
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'flex-start',
            background: 'rgba(227, 6, 19, 0.08)',
            border: '1px solid rgba(227, 6, 19, 0.25)',
            borderRadius: 8,
            padding: '12px 14px',
            marginBottom: 16,
            fontSize: 12.5,
            color: t.text,
          }}
        >
          <XCircle size={16} color={t.primary} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{erroAcao}</span>
        </div>
      )}

      {/* KPIs do recorte atual */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 12,
          marginBottom: 16,
        }}
      >
        {kpis.map(([rotulo, valor]) => (
          <div
            key={rotulo}
            style={{
              background: t.surface,
              border: `1px solid ${t.border}`,
              borderRadius: 12,
              padding: '12px 14px',
            }}
          >
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 600,
                color: t.textMuted,
                marginBottom: 5,
                textTransform: 'uppercase',
                letterSpacing: 0.4,
              }}
            >
              {rotulo}
            </div>
            <div className="num" style={{ fontSize: 18, fontWeight: 700, color: t.text }}>
              {valor}
            </div>
          </div>
        ))}
      </div>

      {/* TABELA — altura fixa, rolagem só aqui dentro, cabeçalho preso */}
      <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, overflow: 'hidden' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 16px',
            borderBottom: `1px solid ${t.border}`,
          }}
        >
          <Clock size={16} color={t.primary} />
          <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>
            Cargas registradas
            <span style={{ fontSize: 11.5, fontWeight: 500, color: t.textMuted }}>
              {' '}
              — {filtrados.length.toLocaleString('pt-BR')} no filtro
            </span>
          </div>
        </div>

        <div style={{ maxHeight: 520, overflowY: 'auto', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, color: t.text }}>
            <thead>
              <tr>
                <th style={th}>Tipo de Dado</th>
                <th style={th}>Arquivo</th>
                <th style={th}>Usuário</th>
                <th style={th}>Data e Hora</th>
                <th style={{ ...th, textAlign: 'right' }}>Linhas</th>
                <th style={{ ...th, textAlign: 'right' }}>Novos</th>
                <th style={{ ...th, textAlign: 'right' }}>Atualizados</th>
                <th style={{ ...th, textAlign: 'right' }}>Rejeitados</th>
                <th style={th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {carregando && (
                <tr>
                  <td colSpan={9} style={{ padding: '30px 16px', textAlign: 'center', color: t.textMuted }}>
                    Carregando histórico de importações...
                  </td>
                </tr>
              )}
              {!carregando && erro && (
                <tr>
                  <td colSpan={9} style={{ padding: '30px 16px', textAlign: 'center', color: t.textMuted }}>
                    {erro}
                  </td>
                </tr>
              )}
              {!carregando && !erro && filtrados.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ padding: '30px 16px', textAlign: 'center', color: t.textMuted }}>
                    {itens.length === 0
                      ? 'Nenhuma importação registrada ainda. As cargas feitas em Dados e Exportações ou pela automação aparecerão aqui.'
                      : 'Nenhuma importação encontrada com os filtros atuais.'}
                  </td>
                </tr>
              )}
              {!carregando &&
                !erro &&
                filtrados.map((i) => {
                  const cor = CORES_STATUS[i.status];
                  return (
                    <tr key={i.id} style={{ borderTop: `1px solid ${t.border}` }}>
                      <td style={{ ...td, fontWeight: 600, whiteSpace: 'normal', minWidth: 190 }}>{i.tipo}</td>
                      <td style={{ ...td, color: t.textSecondary, whiteSpace: 'normal', minWidth: 170 }}>
                        {i.arquivo}
                      </td>
                      <td style={{ ...td, color: t.textSecondary }}>{i.usuario}</td>
                      <td className="num" style={{ ...td, color: t.textMuted, fontSize: 12 }}>
                        {i.dataHora}
                      </td>
                      <td className="num" style={{ ...td, textAlign: 'right' }}>
                        {i.validos.toLocaleString('pt-BR')} / {i.total.toLocaleString('pt-BR')}
                      </td>
                      <td className="num" style={{ ...td, textAlign: 'right' }}>
                        {i.novos.toLocaleString('pt-BR')}
                      </td>
                      <td className="num" style={{ ...td, textAlign: 'right' }}>
                        {i.atualizados.toLocaleString('pt-BR')}
                      </td>
                      <td
                        className="num"
                        style={{
                          ...td,
                          textAlign: 'right',
                          color: i.rejeitados > 0 ? t.primary : t.textMuted,
                          fontWeight: i.rejeitados > 0 ? 700 : 400,
                        }}
                      >
                        {i.rejeitados.toLocaleString('pt-BR')}
                      </td>
                      <td style={td}>
                        <span
                          title={i.mensagemErro || undefined}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            fontSize: 11.5,
                            fontWeight: 600,
                            padding: '3px 8px',
                            borderRadius: 6,
                            background: cor.fundo,
                            color: cor.texto,
                          }}
                        >
                          <FileCheck size={12} />
                          {i.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
