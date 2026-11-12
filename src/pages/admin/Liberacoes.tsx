/**
 * Liberações de alteração.
 *
 * Comprador, Analista e SAR enxergam tudo, mas só alteram dados **enquanto
 * houver uma liberação ativa** concedida aqui. É esta tela que o
 * administrador usa para abrir e fechar esse portão.
 *
 * Por que a liberação tem prazo
 * -----------------------------
 * Ela expira sozinha de propósito. Uma permissão de escrita concedida para
 * resolver uma pendência, se não expirasse, ficaria aberta por esquecimento —
 * e o portão viraria enfeite. Passado o prazo, o perfil volta a ser de
 * leitura sem ninguém precisar lembrar de revogar.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Clock, KeyRound, ShieldOff, Timer, UserCheck } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/common/DataState';
import { RoleBadge } from '../../components/auth/RoleBadge';
import { getErrorMessage } from '../../lib/api';
import {
  LiberacoesResponse,
  concederLiberacao,
  fetchLiberacoes,
  revogarLiberacao,
} from '../../lib/liberacoes';

/** dd/mm/aaaa hh:mm a partir de um ISO. */
const quando = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

/** "faltam 3 h 20 min" — o que o administrador realmente quer saber. */
function restante(iso: string | null): string {
  if (!iso) return '—';
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'expirada';
  const horas = Math.floor(ms / 3_600_000);
  const minutos = Math.floor((ms % 3_600_000) / 60_000);
  return horas > 0 ? `faltam ${horas} h ${minutos} min` : `faltam ${minutos} min`;
}

export const LiberacoesPage: React.FC = () => {
  const { t } = useTheme();
  const { refreshEstadoEscrita } = useAuth();

  const [dados, setDados] = useState<LiberacoesResponse | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [incluirEncerradas, setIncluirEncerradas] = useState(false);

  const [usuarioId, setUsuarioId] = useState('');
  const [horas, setHoras] = useState('8');
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const r = await fetchLiberacoes(incluirEncerradas);
      setDados(r);
      if (!usuarioId && r.candidatos.length) setUsuarioId(r.candidatos[0].id);
    } catch (err) {
      setErro(getErrorMessage(err, 'Falha ao carregar as liberações.'));
    } finally {
      setCarregando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incluirEncerradas]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const conceder = async () => {
    if (!usuarioId) {
      setErroForm('Escolha o usuário que receberá a liberação.');
      return;
    }
    setSalvando(true);
    setErroForm(null);
    setAviso(null);
    try {
      const r = await concederLiberacao({
        usuarioId,
        horas: Number(horas) || 8,
        motivo: motivo.trim() || undefined,
      });
      setAviso(`${r.usuario} pode alterar dados pelas próximas ${r.horas} h.`);
      setMotivo('');
      await carregar();
      // O próprio administrador pode estar olhando o estado dele na faixa.
      await refreshEstadoEscrita();
    } catch (err) {
      setErroForm(getErrorMessage(err, 'Falha ao conceder a liberação.'));
    } finally {
      setSalvando(false);
    }
  };

  const revogar = async (id: number) => {
    try {
      await revogarLiberacao(id);
      await carregar();
    } catch (err) {
      setErro(getErrorMessage(err, 'Falha ao encerrar a liberação.'));
    }
  };

  const rotulo = { fontSize: 10.5, color: t.textMuted, fontWeight: 600 } as const;
  const campo = {
    padding: '8px 10px',
    borderRadius: 8,
    border: `1px solid ${t.border}`,
    background: t.surface,
    color: t.text,
    fontSize: 13,
  } as const;

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <KeyRound size={21} color={t.primary} />
          <h1
            style={{
              margin: 0,
              fontFamily: 'var(--ga-display)',
              fontSize: 24,
              fontWeight: 700,
              color: t.text,
              letterSpacing: '-0.025em',
            }}
          >
            Liberações de alteração
          </h1>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: t.textSecondary, lineHeight: 1.6, maxWidth: 820 }}>
          Comprador, Analista e SAR enxergam todos os dados, mas só alteram enquanto houver uma liberação
          ativa. A liberação tem prazo e expira sozinha — para acesso permanente de escrita, mude o perfil
          do usuário no cadastro, em vez de liberar por tempo.
        </p>
      </div>

      {/* ── Conceder ─────────────────────────────────────────────────── */}
      <section
        style={{
          background: t.surface,
          border: `1px solid ${t.border}`,
          borderRadius: 'var(--ga-radius)',
          padding: '16px 18px',
          marginBottom: 16,
        }}
      >
        <h2
          style={{
            margin: '0 0 12px',
            fontFamily: 'var(--ga-display)',
            fontSize: 14.5,
            fontWeight: 700,
            color: t.text,
          }}
        >
          Conceder liberação
        </h2>

        {!dados?.candidatos.length && !carregando ? (
          <p style={{ margin: 0, fontSize: 12.5, color: t.textMuted, lineHeight: 1.6 }}>
            Nenhum usuário ativo com perfil que dependa de liberação (Comprador, Analista ou SAR). Perfis
            de visualização não aparecem aqui: liberar não mudaria nada para eles.
          </p>
        ) : (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 220 }}>
              <span style={rotulo}>Usuário</span>
              <select value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)} style={campo}>
                {dados?.candidatos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome} · {c.papel}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 130 }}>
              <span style={rotulo}>Prazo (horas)</span>
              <input
                type="number"
                min={1}
                max={dados?.maxHoras ?? 72}
                value={horas}
                onChange={(e) => setHoras(e.target.value)}
                style={campo}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 240px', minWidth: 200 }}>
              <span style={rotulo}>Motivo (fica registrado)</span>
              <input
                value={motivo}
                onChange={(e) => setMotivo(e.target.value.slice(0, 300))}
                placeholder="Ex.: corrigir metas de novembro do fabricante X"
                style={campo}
              />
            </label>

            <button
              type="button"
              onClick={conceder}
              disabled={salvando}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '9px 16px',
                borderRadius: 8,
                border: 'none',
                background: t.primary,
                color: t.primaryForeground,
                fontSize: 13,
                fontWeight: 700,
                cursor: salvando ? 'not-allowed' : 'pointer',
                opacity: salvando ? 0.6 : 1,
              }}
            >
              <UserCheck size={15} />
              {salvando ? 'Concedendo...' : 'Conceder'}
            </button>
          </div>
        )}

        {erroForm && <div style={{ marginTop: 12 }}><ErrorBlock message={erroForm} /></div>}
        {aviso && (
          <div
            style={{
              marginTop: 12,
              padding: '10px 12px',
              borderRadius: 8,
              background: `${t.success}14`,
              border: `1px solid ${t.success}40`,
              color: t.success,
              fontSize: 12.5,
              fontWeight: 600,
            }}
          >
            {aviso}
          </div>
        )}
      </section>

      {/* ── Lista ────────────────────────────────────────────────────── */}
      <section
        style={{
          background: t.surface,
          border: `1px solid ${t.border}`,
          borderRadius: 'var(--ga-radius)',
          padding: '16px 18px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
            marginBottom: 12,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontFamily: 'var(--ga-display)',
              fontSize: 14.5,
              fontWeight: 700,
              color: t.text,
            }}
          >
            {incluirEncerradas ? 'Todas as liberações' : 'Liberações em vigor'}
          </h2>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              fontSize: 12.5,
              color: t.textSecondary,
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={incluirEncerradas}
              onChange={(e) => setIncluirEncerradas(e.target.checked)}
            />
            Mostrar encerradas e expiradas
          </label>
        </div>

        {carregando ? (
          <LoadingBlock label="Carregando liberações..." />
        ) : erro ? (
          <ErrorBlock message={erro} />
        ) : !dados?.liberacoes.length ? (
          <EmptyBlock
            title="Nenhuma liberação em vigor"
            description="Enquanto não houver liberação ativa, Comprador, Analista e SAR acessam os dados em modo de visualização."
          />
        ) : (
          <div style={{ overflowX: 'auto', border: `1px solid ${t.border}`, borderRadius: 10 }}>
            <table style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr>
                  {['Usuário', 'Perfil', 'Concedida por', 'Em', 'Expira', 'Situação', 'Motivo', ''].map(
                    (h, i) => (
                      <th
                        key={h || i}
                        scope="col"
                        style={{
                          textAlign: 'left',
                          padding: '10px 12px',
                          background: t.surfaceElevated,
                          color: t.textSecondary,
                          fontWeight: 600,
                          fontSize: 11.5,
                          borderBottom: `1px solid ${t.border}`,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {dados.liberacoes.map((l) => (
                  <tr key={l.id}>
                    <td style={{ padding: '9px 12px', borderBottom: `1px solid ${t.border}`, color: t.text, fontWeight: 600 }}>
                      {l.usuario || '—'}
                    </td>
                    <td style={{ padding: '9px 12px', borderBottom: `1px solid ${t.border}` }}>
                      {l.papel ? <RoleBadge role={l.papel} size="sm" /> : '—'}
                    </td>
                    <td style={{ padding: '9px 12px', borderBottom: `1px solid ${t.border}`, color: t.textSecondary }}>
                      {l.concedidoPor || '—'}
                    </td>
                    <td className="num" style={{ padding: '9px 12px', borderBottom: `1px solid ${t.border}`, color: t.textSecondary }}>
                      {quando(l.concedidoEm)}
                    </td>
                    <td className="num" style={{ padding: '9px 12px', borderBottom: `1px solid ${t.border}`, color: t.textSecondary }}>
                      {quando(l.expiraEm)}
                    </td>
                    <td style={{ padding: '9px 12px', borderBottom: `1px solid ${t.border}` }}>
                      {l.ativa ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: t.success, fontWeight: 700 }}>
                          <Timer size={13} /> {restante(l.expiraEm)}
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: t.textMuted }}>
                          <Clock size={13} /> {l.revogadoEm ? 'encerrada' : 'expirada'}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '9px 12px', borderBottom: `1px solid ${t.border}`, color: t.textSecondary }}>
                      {l.motivo || '—'}
                    </td>
                    <td style={{ padding: '9px 12px', borderBottom: `1px solid ${t.border}`, textAlign: 'right' }}>
                      {l.ativa && (
                        <button
                          type="button"
                          onClick={() => revogar(l.id)}
                          title="Encerrar agora"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '6px 10px',
                            borderRadius: 8,
                            border: `1px solid ${t.danger}55`,
                            background: `${t.danger}14`,
                            color: t.danger,
                            fontSize: 11.5,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          <ShieldOff size={13} /> Encerrar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
