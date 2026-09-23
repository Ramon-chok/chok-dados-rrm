import React, { useEffect, useRef, useState } from 'react';
import { Clock, LogOut, AlertTriangle, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

/** A partir daqui o contador fica em alerta (âmbar). */
const WARN_MS = 15 * 60_000;
/** A partir daqui aparece o aviso flutuante e o contador fica crítico (vermelho). */
const CRITICAL_MS = 5 * 60_000;

const STATUS_WARNING = '#D99A0B';
const STATUS_CRITICAL = '#D03B3B';

function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "02:14:09" até 24h; acima disso "3d 04h". */
function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86_400);
  const h = Math.floor((total % 86_400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (d > 0) return `${d}d ${pad(h)}h`;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/** "1h 23min", "3d 4h", "12min", "40s". */
function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86_400);
  const h = Math.floor((total % 86_400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${pad(m)}min`;
  if (m > 0) return `${m}min`;
  return `${total}s`;
}

function formatClock(epoch: number): string {
  const date = new Date(epoch);
  const sameDay = date.toDateString() === new Date().toDateString();
  return sameDay
    ? date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/**
 * Pílula do cabeçalho com o tempo restante da sessão. Clicar abre o detalhe
 * (conectado desde, tempo conectado, horário do encerramento automático).
 * A desconexão em si é feita pelo AuthContext; aqui é só a interface.
 */
export const SessionTimer: React.FC = () => {
  const { session, setIsLogoutModalOpen } = useAuth();
  const { t } = useTheme();
  const now = useNow();
  const [open, setOpen] = useState(false);
  const [warningDismissed, setWarningDismissed] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Nova sessão → o aviso volta a poder aparecer.
  useEffect(() => setWarningDismissed(false), [session?.expiresAt]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!session) return null;

  const remaining = session.expiresAt - now;
  const elapsed = now - session.startedAt;
  const totalMs = Math.max(1, session.expiresAt - session.startedAt);
  const usedPct = Math.min(100, Math.max(0, (elapsed / totalMs) * 100));
  const level: 'ok' | 'warning' | 'critical' = remaining <= CRITICAL_MS ? 'critical' : remaining <= WARN_MS ? 'warning' : 'ok';
  const accent = level === 'critical' ? STATUS_CRITICAL : level === 'warning' ? STATUS_WARNING : t.textSecondary;
  const levelLabel = level === 'critical' ? 'Expirando' : level === 'warning' ? 'Expira em breve' : null;

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 16,
    fontSize: 12.5,
    padding: '6px 0',
    borderBottom: `1px solid ${t.border}`,
  };

  return (
    <>
      <div ref={rootRef} style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={`Tempo restante da sessão: ${formatDuration(remaining)}`}
          title="Tempo restante da sessão"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            height: 34,
            padding: '0 10px',
            borderRadius: 8,
            border: `1px solid ${level === 'ok' ? t.border : accent}`,
            background: level === 'ok' ? 'transparent' : `${accent}14`,
            color: level === 'ok' ? t.text : accent,
            cursor: 'pointer',
            fontSize: 12.5,
            fontWeight: 600,
          }}
        >
          {level === 'ok' ? <Clock size={14} color={t.textSecondary} /> : <AlertTriangle size={14} />}
          <span className="num session-timer-value" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {formatCountdown(remaining)}
          </span>
        </button>

        {open && (
          <div
            role="dialog"
            aria-label="Detalhes da sessão"
            style={{
              position: 'absolute',
              right: 0,
              top: 'calc(100% + 8px)',
              width: 'min(300px, calc(100vw - 32px))',
              background: t.surface,
              border: `1px solid ${t.border}`,
              borderRadius: 12,
              padding: 16,
              boxShadow: '0 12px 32px rgba(0,0,0,0.25)',
              zIndex: 60,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <strong style={{ fontSize: 13.5, color: t.text }}>Sua sessão</strong>
              {levelLabel && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: accent }}>
                  <AlertTriangle size={12} /> {levelLabel}
                </span>
              )}
            </div>

            <div style={rowStyle}>
              <span style={{ color: t.textMuted }}>Conectado desde</span>
              <span style={{ color: t.text, fontWeight: 600 }}>{formatClock(session.startedAt)}</span>
            </div>
            <div style={rowStyle}>
              <span style={{ color: t.textMuted }}>Tempo conectado</span>
              <span style={{ color: t.text, fontWeight: 600 }}>{formatDuration(elapsed)}</span>
            </div>
            <div style={rowStyle}>
              <span style={{ color: t.textMuted }}>Tempo restante</span>
              <span className="num" style={{ color: level === 'ok' ? t.text : accent, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                {formatCountdown(remaining)}
              </span>
            </div>
            <div style={{ ...rowStyle, borderBottom: 'none' }}>
              <span style={{ color: t.textMuted }}>Encerramento automático</span>
              <span style={{ color: t.text, fontWeight: 600 }}>{formatClock(session.expiresAt)}</span>
            </div>

            {/* Quanto do tempo total da sessão já foi usado */}
            <div
              role="progressbar"
              aria-label="Tempo de sessão utilizado"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(usedPct)}
              style={{ height: 6, borderRadius: 3, background: t.border, overflow: 'hidden', margin: '8px 0 6px' }}
            >
              <div style={{ width: `${usedPct}%`, height: '100%', borderRadius: 3, background: level === 'ok' ? t.primary : accent }} />
            </div>
            <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 12, lineHeight: 1.45 }}>
              {Math.round(usedPct)}% do tempo total de {formatDuration(totalMs)} usado.
              {session.rememberMe ? ' "Manter sessão conectada" ativo.' : ''} Ao final, você será desconectado automaticamente.
            </div>

            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setIsLogoutModalOpen(true);
              }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '8px 12px',
                borderRadius: 8,
                border: `1px solid ${t.border}`,
                background: 'transparent',
                color: t.text,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <LogOut size={14} /> Encerrar sessão agora
            </button>
          </div>
        )}
      </div>

      {/* Aviso flutuante nos últimos minutos */}
      {level === 'critical' && !warningDismissed && remaining > 0 && (
        <div
          role="alert"
          style={{
            position: 'fixed',
            right: 16,
            bottom: 16,
            left: 'auto',
            maxWidth: 'calc(100vw - 32px)',
            width: 340,
            background: t.surface,
            border: `1px solid ${STATUS_CRITICAL}`,
            borderLeft: `4px solid ${STATUS_CRITICAL}`,
            borderRadius: 12,
            padding: '14px 16px',
            boxShadow: '0 12px 32px rgba(0,0,0,0.3)',
            zIndex: 80,
            boxSizing: 'border-box',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <AlertTriangle size={18} color={STATUS_CRITICAL} style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: t.text, marginBottom: 4 }}>
                Sessão expira em <span className="num" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCountdown(remaining).slice(3)}</span>
              </div>
              <div style={{ fontSize: 12.5, color: t.textSecondary, lineHeight: 1.45 }}>
                Ao final do tempo você será desconectado automaticamente. Conclua o que estiver fazendo.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setWarningDismissed(true)}
              aria-label="Dispensar aviso"
              style={{ background: 'transparent', border: 'none', color: t.textMuted, cursor: 'pointer', padding: 2 }}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
};
