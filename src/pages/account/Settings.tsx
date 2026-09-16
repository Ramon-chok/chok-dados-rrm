import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { APP_CONFIG } from '../../config/appConfig';
import {
  apiTwoFADisable,
  apiTwoFAInit,
  apiTwoFAResend,
  apiTwoFAStatus,
  apiTwoFAVerify,
  ApiError,
} from '../../lib/api';
import {
  Shield,
  Check,
  Save,
  X,
  Smartphone,
  Mail,
  MessageSquare,
  KeyRound,
  ShieldCheck,
  ShieldOff,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Copy,
  RefreshCw,
  Eye,
  EyeOff,
  Info,
  Fingerprint,
  Lock,
  Sparkles,
  ChevronRight,
  Bell,
  Globe,
  Palette,
  Settings,
} from 'lucide-react';

// ============================================
// TIPOS & CONSTANTES
// ============================================
type TwoFAMethod = 'authenticator' | 'sms' | 'email';
type TwoFAStage = 'choose' | 'configure' | 'verify' | 'backup' | 'done';

interface TwoFAConfig {
  enabled: boolean;
  method: TwoFAMethod | null;
  requireNextLogin: boolean;
  timestamp: string;
}

const METHOD_INFO: Record<TwoFAMethod, { icon: any; label: string; desc: string; color: string }> = {
  authenticator: {
    icon: Smartphone,
    label: 'App Autenticador',
    desc: 'Google Authenticator, Authy ou similar (TOTP)',
    color: '#8B5CF6',
  },
  sms: {
    icon: MessageSquare,
    label: 'SMS / Telefone',
    desc: 'Código de verificação via mensagem de texto',
    color: '#3B82F6',
  },
  email: {
    icon: Mail,
    label: 'E-mail',
    desc: 'Código enviado para seu e-mail corporativo',
    color: '#10B981',
  },
};

// ============================================
// COMPONENTE PRINCIPAL
// ============================================
export const SettingsPage: React.FC = () => {
  const { t, mode, setMode } = useTheme();
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'ADMIN';

  // ─── Estado Geral ─────────────────────────────────────────────
  const [catalogUrl, setCatalogUrl] = useState(APP_CONFIG.catalogUrl);
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);

  // ─── Estado 2FA (fonte de verdade: backend/PostgreSQL) ─────────
  const [twoFAConfig, setTwoFAConfig] = useState<TwoFAConfig>({
    enabled: false,
    method: null,
    requireNextLogin: true,
    timestamp: '',
  });

  const [show2FAModal, setShow2FAModal] = useState(false);
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  const [twoFAMethod, setTwoFAMethod] = useState<TwoFAMethod | null>(null);
  const [twoFAStage, setTwoFAStage] = useState<TwoFAStage>('choose');
  const [twoFAInput, setTwoFAInput] = useState('');
  const [codeDigits, setCodeDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [require2FAOnNextLogin, setRequire2FAOnNextLogin] = useState(true);
  const [showSecret, setShowSecret] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedBackup, setCopiedBackup] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isInitLoading, setIsInitLoading] = useState(false);
  const [codeTimer, setCodeTimer] = useState(0);
  const [codeSent, setCodeSent] = useState(false);
  const [secret, setSecret] = useState('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [devHintCode, setDevHintCode] = useState('');
  const [actionError, setActionError] = useState('');
  const [disabling, setDisabling] = useState(false);

  const codeInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const verifyingRef = useRef(false);

  const loadStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const st = await apiTwoFAStatus();
      setTwoFAConfig({
        enabled: !!st.enabled,
        method: (st.method as TwoFAMethod) || null,
        requireNextLogin: st.requireNextLogin !== false,
        timestamp: st.activatedAt || '',
      });
      setRequire2FAOnNextLogin(st.requireNextLogin !== false);
    } catch {
      /* ignore */
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  // ─── Countdown Timer ─────────────────────────────────────────
  useEffect(() => {
    if (codeTimer > 0) {
      timerRef.current = setTimeout(() => setCodeTimer((prev) => prev - 1), 1000);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [codeTimer]);

  // ─── ESC to close modals ─────────────────────────────────────
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (show2FAModal) handleClose2FA();
        if (showDisableConfirm) setShowDisableConfirm(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [show2FAModal, showDisableConfirm]);

  // ─── Lock body scroll when modal open ────────────────────────
  useEffect(() => {
    if (show2FAModal || showDisableConfirm) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [show2FAModal, showDisableConfirm]);

  // ─── Handlers 2FA ─────────────────────────────────────────────
  const handleToggle2FA = (checked: boolean) => {
    if (checked) {
      handleOpen2FA();
    } else {
      setShowDisableConfirm(true);
    }
  };

  const handleOpen2FA = () => {
    setTwoFAMethod(null);
    setTwoFAStage('choose');
    setTwoFAInput('');
    setCodeDigits(['', '', '', '', '', '']);
    setVerifyError('');
    setActionError('');
    setCodeSent(false);
    setCodeTimer(0);
    setSecret('');
    setQrCodeDataUrl('');
    setBackupCodes([]);
    setDevHintCode('');
    setShow2FAModal(true);
  };

  const handleClose2FA = () => {
    setShow2FAModal(false);
    setTwoFAStage('choose');
    setTwoFAMethod(null);
    setTwoFAInput('');
    setCodeDigits(['', '', '', '', '', '']);
    setVerifyError('');
    setActionError('');
    setCodeSent(false);
    setSecret('');
    setQrCodeDataUrl('');
    setBackupCodes([]);
    setDevHintCode('');
    void loadStatus();
  };

  const handleSelectMethod = async (method: TwoFAMethod) => {
    setTwoFAMethod(method);
    setTwoFAStage('configure');
    setTwoFAInput(method === 'email' ? currentUser?.email || '' : '');
    setCodeDigits(['', '', '', '', '', '']);
    setVerifyError('');
    setActionError('');
    setCodeSent(false);
    setSecret('');
    setQrCodeDataUrl('');
    setDevHintCode('');

    if (method === 'authenticator') {
      setIsInitLoading(true);
      try {
        const res = await apiTwoFAInit({ method: 'authenticator' });
        setSecret(res.secret || '');
        setQrCodeDataUrl(res.qrCodeDataUrl || '');
      } catch (err) {
        setActionError(err instanceof ApiError ? err.message : 'Falha ao iniciar 2FA.');
        setTwoFAStage('choose');
        setTwoFAMethod(null);
      } finally {
        setIsInitLoading(false);
      }
    }
  };

  const handleSendCode = async () => {
    if (!twoFAMethod || twoFAMethod === 'authenticator') return;
    if (!twoFAInput.trim()) return;
    setIsInitLoading(true);
    setActionError('');
    try {
      const res = await apiTwoFAInit({
        method: twoFAMethod,
        phone: twoFAMethod === 'sms' ? twoFAInput.trim() : undefined,
        email: twoFAMethod === 'email' ? twoFAInput.trim() : undefined,
      });
      setCodeSent(true);
      setCodeTimer(60);
      setTwoFAStage('verify');
      if (res.devCode) setDevHintCode(res.devCode);
      setTimeout(() => codeInputRefs.current[0]?.focus(), 150);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Falha ao enviar código.');
    } finally {
      setIsInitLoading(false);
    }
  };

  const handleCodeDigitChange = (index: number, value: string) => {
    // Aceita colar vários dígitos no mesmo campo
    const cleaned = value.replace(/\D/g, '');
    if (!cleaned) {
      const newDigits = [...codeDigits];
      newDigits[index] = '';
      setCodeDigits(newDigits);
      setVerifyError('');
      return;
    }

    if (cleaned.length > 1) {
      const newDigits = [...codeDigits];
      for (let i = 0; i < cleaned.length && index + i < 6; i++) {
        newDigits[index + i] = cleaned[i];
      }
      setCodeDigits(newDigits);
      setVerifyError('');
      const nextEmpty = newDigits.findIndex((d) => !d);
      codeInputRefs.current[nextEmpty === -1 ? 5 : nextEmpty]?.focus();
      return;
    }

    const newDigits = [...codeDigits];
    newDigits[index] = cleaned.slice(-1);
    setCodeDigits(newDigits);
    setVerifyError('');

    if (cleaned && index < 5) {
      codeInputRefs.current[index + 1]?.focus();
    }
  };

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !codeDigits[index] && index > 0) {
      codeInputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && index > 0) {
      codeInputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowRight' && index < 5) {
      codeInputRefs.current[index + 1]?.focus();
    }
  };

  const handleCodePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const newDigits = [...codeDigits];
    for (let i = 0; i < pasted.length && i < 6; i++) {
      newDigits[i] = pasted[i];
    }
    setCodeDigits(newDigits);
    if (pasted.length === 6) {
      setTimeout(() => handleVerifyCode(pasted), 200);
    } else {
      codeInputRefs.current[Math.min(pasted.length, 5)]?.focus();
    }
  };

  const handleVerifyCode = async (code?: string) => {
    if (verifyingRef.current) return;
    const normalized = (code ?? codeDigits.join('')).replace(/\D/g, '').slice(0, 6);
    if (normalized.length !== 6) {
      setVerifyError('Informe os 6 dígitos do aplicativo autenticador.');
      return;
    }
    verifyingRef.current = true;
    setIsVerifying(true);
    setVerifyError('');
    try {
      const res = await apiTwoFAVerify({
        code: normalized,
        requireNextLogin: require2FAOnNextLogin,
      });
      setBackupCodes(res.backupCodes || []);
      setTwoFAConfig({
        enabled: true,
        method: (res.method as TwoFAMethod) || twoFAMethod,
        requireNextLogin: require2FAOnNextLogin,
        timestamp: res.activatedAt || new Date().toISOString(),
      });
      setTwoFAStage('backup');
    } catch (err) {
      setVerifyError(err instanceof ApiError ? err.message : 'Código inválido. Tente novamente.');
      setCodeDigits(['', '', '', '', '', '']);
      setTimeout(() => codeInputRefs.current[0]?.focus(), 100);
    } finally {
      setIsVerifying(false);
      verifyingRef.current = false;
    }
  };

  const handleFinish2FA = () => {
    setTwoFAStage('done');
  };

  const handleDisable2FA = async () => {
    setDisabling(true);
    setActionError('');
    try {
      await apiTwoFADisable();
      setTwoFAConfig({ enabled: false, method: null, requireNextLogin: true, timestamp: '' });
      setShowDisableConfirm(false);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Falha ao desativar 2FA.');
    } finally {
      setDisabling(false);
    }
  };

  const handleCopySecret = async () => {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    } catch { /* ignore */ }
  };

  const handleCopyBackup = async () => {
    try {
      await navigator.clipboard.writeText(backupCodes.join('\n'));
      setCopiedBackup(true);
      setTimeout(() => setCopiedBackup(false), 2000);
    } catch { /* ignore */ }
  };

  const handleResendCode = async () => {
    if (codeTimer > 0) return;
    setActionError('');
    try {
      const res = await apiTwoFAResend();
      setCodeTimer(60);
      setCodeDigits(['', '', '', '', '', '']);
      setVerifyError('');
      if (res.devCode) setDevHintCode(res.devCode);
      setTimeout(() => codeInputRefs.current[0]?.focus(), 100);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Falha ao reenviar código.');
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const methodInfo = twoFAMethod ? METHOD_INFO[twoFAMethod] : null;

  // ─── Stepper ──────────────────────────────────────────────────
  const STEPS: { key: TwoFAStage; label: string }[] = [
    { key: 'choose', label: 'Método' },
    { key: 'configure', label: 'Configurar' },
    { key: 'verify', label: 'Verificar' },
    { key: 'backup', label: 'Backup' },
    { key: 'done', label: 'Concluído' },
  ];

  const currentStepIndex = STEPS.findIndex((s) => s.key === twoFAStage);

  return (
    <div style={{ maxWidth: '800px' }}>
      {/* ════════════════════════════════════════════
          HEADER
      ════════════════════════════════════════════ */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: '12px',
              background: `linear-gradient(135deg, ${t.primary}, #cc0011)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 4px 14px ${t.primary}40`,
            }}
          >
            <Settings size={20} color="#fff" />
          </div>
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: '24px',
                fontWeight: 800,
                color: t.text,
                letterSpacing: '-0.02em',
              }}
            >
              Configurações
            </h1>
            <p style={{ margin: 0, fontSize: '13px', color: t.textSecondary }}>
              Preferências do sistema, segurança e integrações
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* ════════════════════════════════════════════
            APARÊNCIA & TEMA
        ════════════════════════════════════════════ */}
        <SettingsCard
          icon={Palette}
          title="Aparência & Tema"
          description="Alterne entre o tema escuro industrial ou o tema claro de alta visibilidade."
          theme={t}
        >
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {[
              { key: 'dark' as const, label: 'Tema Origin (Padrão)', bg: '#0D0F12', fg: '#fff' },
              { key: 'light' as const, label: 'Tema RR Mind', bg: '#FFFFFF', fg: '#111827' },
            ].map((theme) => (
              <button
                key={theme.key}
                type="button"
                onClick={() => setMode(theme.key)}
                style={{
                  flex: '1 1 140px',
                  padding: '14px 16px',
                  borderRadius: '10px',
                  border: `2px solid ${mode === theme.key ? t.primary : t.border}`,
                  background: theme.bg,
                  color: theme.fg,
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: mode === theme.key ? `0 0 0 3px ${t.primary}20` : 'none',
                }}
              >
                {mode === theme.key && <Check size={14} />}
                {theme.label}
              </button>
            ))}
          </div>
        </SettingsCard>

        {/* ════════════════════════════════════════════
            CATÁLOGO
        ════════════════════════════════════════════ */}
        <SettingsCard
          icon={Globe}
          title="Link do Catálogo Externo"
          description="Endereço web oficial do catálogo aberto pelos vendedores no menu lateral."
          theme={t}
        >
          <input
            type="url"
            value={catalogUrl}
            onChange={(e) => setCatalogUrl(e.target.value)}
            disabled={!isAdmin}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '11px 14px',
              borderRadius: '8px',
              border: `1px solid ${t.border}`,
              background: t.surfaceElevated,
              color: t.text,
              fontSize: '13px',
              outline: 'none',
              transition: 'border-color 0.2s',
              opacity: isAdmin ? 1 : 0.6,
            }}
            onFocus={(e) => isAdmin && (e.currentTarget.style.borderColor = t.primary)}
            onBlur={(e) => (e.currentTarget.style.borderColor = t.border)}
          />
          {!isAdmin && (
            <div style={{ fontSize: '11.5px', color: t.textMuted, marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Lock size={11} />
              Somente administradores podem alterar a URL do catálogo.
            </div>
          )}
        </SettingsCard>

        {/* ════════════════════════════════════════════
            NOTIFICAÇÕES
        ════════════════════════════════════════════ */}
        <SettingsCard
          icon={Bell}
          title="Alertas & Auditoria"
          description="Notificações operacionais sobre importações e fechamentos mensais."
          theme={t}
        >
          <ToggleSwitch
            checked={emailAlerts}
            onChange={setEmailAlerts}
            label="Receber alertas de divergência e importações críticas"
            theme={t}
          />
        </SettingsCard>

        {/* ════════════════════════════════════════════
            SEGURANÇA — 2FA COM MECHANISMO SWITCH
        ════════════════════════════════════════════ */}
        <div
          style={{
            background: t.surface,
            border: `1px solid ${t.border}`,
            borderRadius: '14px',
            overflow: 'hidden',
          }}
        >
          {/* Header com o Switch Principal de Ativação */}
          <div
            style={{
              padding: '24px',
              borderBottom: `1px solid ${t.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '20px',
              background: mode === 'dark' ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.005)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', flex: 1 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '10px',
                  background: twoFAConfig.enabled
                    ? 'linear-gradient(135deg, #10B981, #059669)'
                    : `linear-gradient(135deg, ${t.primary}, #cc0011)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: twoFAConfig.enabled
                    ? '0 4px 14px rgba(16, 185, 129, 0.3)'
                    : `0 4px 14px ${t.primary}30`,
                  transition: 'all 0.3s',
                }}
              >
                {twoFAConfig.enabled ? (
                  <ShieldCheck size={20} color="#fff" />
                ) : (
                  <Shield size={20} color="#fff" />
                )}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '15px', fontWeight: 700, color: t.text }}>
                    Autenticação de Dois Fatores (2FA)
                  </span>
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      padding: '2px 8px',
                      borderRadius: '20px',
                      background: twoFAConfig.enabled
                        ? 'rgba(16, 185, 129, 0.12)'
                        : 'rgba(156, 163, 175, 0.12)',
                      color: twoFAConfig.enabled ? '#10B981' : t.textMuted,
                      border: `1px solid ${twoFAConfig.enabled ? 'rgba(16, 185, 129, 0.3)' : 'rgba(156, 163, 175, 0.2)'}`,
                    }}
                  >
                    {statusLoading ? '...' : twoFAConfig.enabled ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '12.5px', color: t.textMuted, lineHeight: 1.5 }}>
                  Camada extra de segurança.
                </p>
              </div>
            </div>

            {/* O BOTÃO SWITCH SOLICITADO */}
            <ToggleSwitch
              checked={twoFAConfig.enabled}
              onChange={handleToggle2FA}
              label=""
              theme={t}
            />
          </div>

          {/* Área de Informações Expandida */}
          <div style={{ padding: '24px', background: t.surface }}>
            {twoFAConfig.enabled ? (
              <div
                style={{
                  background: mode === 'dark' ? 'rgba(16, 185, 129, 0.04)' : 'rgba(16, 185, 129, 0.02)',
                  border: '1px solid rgba(16, 185, 129, 0.15)',
                  borderRadius: '12px',
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      background: 'rgba(16, 185, 129, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Fingerprint size={20} color="#10B981" />
                  </div>
                  <div>
                    <div style={{ fontSize: '13.5px', fontWeight: 700, color: t.text }}>
                      Proteção ativa via {twoFAConfig.method ? METHOD_INFO[twoFAConfig.method].label : ''}
                    </div>
                    {twoFAConfig.timestamp && (
                      <div style={{ fontSize: '11px', color: t.textMuted, marginTop: '2px' }}>
                        Configurado em: {new Date(twoFAConfig.timestamp).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleOpen2FA}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: `1px solid ${t.border}`,
                    background: t.surfaceElevated,
                    color: t.text,
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s',
                  }}
                >
                  <RefreshCw size={12} />
                  Alterar Método
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div
                  style={{
                    background: mode === 'dark' ? 'rgba(245, 158, 11, 0.04)' : 'rgba(245, 158, 11, 0.02)',
                    border: '1px solid rgba(245, 158, 11, 0.15)',
                    borderRadius: '12px',
                    padding: '16px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                  }}
                >
                  <Info size={18} color="#F59E0B" style={{ flexShrink: 0, marginTop: '1px' }} />
                  <div style={{ fontSize: '12.5px', color: mode === 'dark' ? '#FBBF24' : '#D97706', lineHeight: 1.5 }}>
                    <strong>Atenção:</strong> Ative o switch acima para configurar 2FA no servidor
                    (QR code real + códigos de backup no banco).
                  </div>
                </div>

                {/* Grid Visual de Métodos Disponíveis */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                  {(Object.keys(METHOD_INFO) as TwoFAMethod[]).map((key) => {
                    const info = METHOD_INFO[key];
                    const Icon = info.icon;
                    return (
                      <div
                        key={key}
                        style={{
                          padding: '14px',
                          borderRadius: '10px',
                          border: `1px solid ${t.border}`,
                          background: t.surfaceElevated,
                          textAlign: 'center',
                          opacity: 0.85,
                        }}
                      >
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: '8px',
                            background: `${info.color}12`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 8px',
                          }}
                        >
                          <Icon size={16} color={info.color} />
                        </div>
                        <div style={{ fontSize: '11.5px', fontWeight: 600, color: t.text }}>{info.label}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ════════════════════════════════════════════
            SALVAR ALTERAÇÕES
        ════════════════════════════════════════════ */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px' }}>
          {savedSuccess && (
            <span
              style={{
                fontSize: '13px',
                color: '#10B981',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                animation: 'rr-fadeIn 0.3s ease',
              }}
            >
              <CheckCircle2 size={16} /> Preferências salvas com sucesso!
            </span>
          )}
          <button
            type="submit"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '11px 24px',
              borderRadius: '10px',
              border: 'none',
              background: `linear-gradient(135deg, ${t.primary}, #cc0011)`,
              color: '#fff',
              fontSize: '13.5px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: `0 4px 14px ${t.primary}30`,
              transition: 'all 0.2s',
            }}
          >
            <Save size={16} />
            <span>Salvar Alterações</span>
          </button>
        </div>
      </form>

      {/* ════════════════════════════════════════════════════════════
          MODAL 2FA — ETAPAS E SELEÇÃO
      ════════════════════════════════════════════════════════════ */}
      {show2FAModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
            animation: 'rr-fadeIn 0.2s ease',
          }}
          onClick={(e) => e.target === e.currentTarget && handleClose2FA()}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '560px',
              maxHeight: '90vh',
              background: t.surface,
              border: `1px solid ${t.border}`,
              borderRadius: '20px',
              overflow: 'hidden',
              boxShadow: '0 25px 60px rgba(0,0,0,0.4)',
              display: 'flex',
              flexDirection: 'column',
              animation: 'rr-modalIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '20px 24px',
                borderBottom: `1px solid ${t.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '12px',
                    background: `linear-gradient(135deg, ${t.primary}, #cc0011)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: `0 4px 14px ${t.primary}30`,
                  }}
                >
                  <KeyRound size={20} color="#fff" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: t.text }}>
                    Configurar 2FA
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: t.textMuted }}>
                    {methodInfo ? methodInfo.label : 'Escolha o método de verificação'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleClose2FA}
                style={{
                  padding: '8px',
                  background: 'none',
                  border: `1px solid ${t.border}`,
                  color: t.textMuted,
                  cursor: 'pointer',
                  borderRadius: '8px',
                  display: 'flex',
                  transition: 'all 0.2s',
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Stepper */}
            <div
              style={{
                padding: '16px 24px',
                borderBottom: `1px solid ${t.border}`,
                background: mode === 'dark' ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.01)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
                {STEPS.map((step, idx) => {
                  const isActive = idx === currentStepIndex;
                  const isComplete = idx < currentStepIndex;
                  return (
                    <React.Fragment key={step.key}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            background: isComplete
                              ? '#10B981'
                              : isActive
                              ? t.primary
                              : mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.3s',
                            boxShadow: isActive ? `0 2px 8px ${t.primary}40` : 'none',
                          }}
                        >
                          {isComplete ? (
                            <Check size={12} color="#fff" strokeWidth={3} />
                          ) : (
                            <span style={{ fontSize: '10px', fontWeight: 700, color: isActive ? '#fff' : t.textMuted }}>
                              {idx + 1}
                            </span>
                          )}
                        </div>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: isActive ? 700 : 500,
                            color: isActive ? t.text : isComplete ? '#10B981' : t.textMuted,
                            transition: 'color 0.3s',
                          }}
                        >
                          {step.label}
                        </span>
                      </div>
                      {idx < STEPS.length - 1 && (
                        <div
                          style={{
                            flex: 1,
                            height: '2px',
                            margin: '0 8px',
                            borderRadius: '1px',
                            background: isComplete ? '#10B981' : t.border,
                            transition: 'background 0.3s',
                          }}
                        />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            {/* Modal Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
              {actionError && (
                <div
                  style={{
                    marginBottom: 16,
                    padding: '10px 12px',
                    borderRadius: 8,
                    background: 'rgba(239,68,68,0.08)',
                    border: '1px solid rgba(239,68,68,0.25)',
                    color: '#EF4444',
                    fontSize: 12.5,
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                  }}
                >
                  <AlertCircle size={14} />
                  {actionError}
                </div>
              )}

              {/* ─── STEP 1: ESCOLHA DO MÉTODO ─── */}
              {twoFAStage === 'choose' && (
                <div style={{ animation: 'rr-fadeIn 0.3s ease' }}>
                  <p style={{ margin: '0 0 20px', fontSize: '13.5px', color: t.textSecondary, lineHeight: 1.6 }}>
                    Escolha o método OTP. A configuração será gravada no banco de dados.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {(Object.keys(METHOD_INFO) as TwoFAMethod[]).map((key) => {
                      const info = METHOD_INFO[key];
                      const Icon = info.icon;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => void handleSelectMethod(key)}
                          disabled={isInitLoading}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '16px',
                            padding: '18px 20px',
                            borderRadius: '12px',
                            border: `1.5px solid ${t.border}`,
                            background: t.surfaceElevated,
                            cursor: isInitLoading ? 'wait' : 'pointer',
                            textAlign: 'left',
                            transition: 'all 0.25s',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = info.color + '60';
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = `0 6px 20px ${info.color}15`;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = t.border;
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = 'none';
                          }}
                        >
                          <div
                            style={{
                              width: 48,
                              height: 48,
                              borderRadius: '12px',
                              background: `${info.color}15`,
                              border: `1px solid ${info.color}30`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <Icon size={22} color={info.color} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '14px', fontWeight: 700, color: t.text, marginBottom: '2px' }}>
                              {info.label}
                            </div>
                            <div style={{ fontSize: '12px', color: t.textMuted }}>{info.desc}</div>
                          </div>
                          <ChevronRight size={18} color={t.textMuted} />
                        </button>
                      );
                    })}
                  </div>

                  <div
                    style={{
                      marginTop: '20px',
                      padding: '14px',
                      borderRadius: '10px',
                      background: 'rgba(139, 92, 246, 0.05)',
                      border: '1px solid rgba(139, 92, 246, 0.15)',
                      fontSize: '12px',
                      color: '#8B5CF6',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                    }}
                  >
                    <Sparkles size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
                    <span>
                      <strong>Recomendado:</strong> App autenticador — QR code real gerado no backend (TOTP).
                    </span>
                  </div>
                </div>
              )}

              {/* ─── STEP 2: CONFIGURAÇÃO ─── */}
              {twoFAStage === 'configure' && methodInfo && (
                <div style={{ animation: 'rr-fadeIn 0.3s ease' }}>
                  {twoFAMethod === 'authenticator' && (
                    <>
                      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                        <p style={{ margin: '0 0 16px', fontSize: '13.5px', color: t.textSecondary, lineHeight: 1.6 }}>
                          Escaneie o QR code com Google Authenticator / Authy ou use a chave manual.
                        </p>
                        {/* QR Code real (data URL do backend) */}
                        <div
                          style={{
                            width: 220,
                            height: 220,
                            margin: '0 auto 16px',
                            background: '#fff',
                            borderRadius: '14px',
                            border: `1px solid ${t.border}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                            position: 'relative',
                            overflow: 'hidden',
                          }}
                        >
                          {isInitLoading ? (
                            <span style={{ color: '#666', fontSize: 13 }}>Gerando QR...</span>
                          ) : qrCodeDataUrl ? (
                            <img src={qrCodeDataUrl} alt="QR Code 2FA" style={{ width: 200, height: 200 }} />
                          ) : (
                            <span style={{ color: '#999', fontSize: 12 }}>QR indisponível</span>
                          )}
                        </div>

                        {/* Chave secreta */}
                        <div style={{ marginBottom: '8px' }}>
                          <span style={{ fontSize: '11px', color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
                            Chave manual
                          </span>
                        </div>
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 14px',
                            borderRadius: '8px',
                            background: t.surfaceElevated,
                            border: `1px solid ${t.border}`,
                          }}
                        >
                          <code
                            style={{
                              fontSize: '13px',
                              fontWeight: 700,
                              color: t.text,
                              letterSpacing: '1px',
                              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                            }}
                          >
                            {showSecret ? secret || '—' : '••••••••••••••••'}
                          </code>
                          <button
                            type="button"
                            onClick={() => setShowSecret(!showSecret)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: t.textMuted,
                              cursor: 'pointer',
                              padding: '4px',
                              display: 'flex',
                            }}
                            title={showSecret ? 'Ocultar' : 'Mostrar'}
                          >
                            {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleCopySecret()}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: copiedSecret ? '#10B981' : t.textMuted,
                              cursor: 'pointer',
                              padding: '4px',
                              display: 'flex',
                            }}
                            title="Copiar"
                          >
                            {copiedSecret ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                          </button>
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                        <button
                          type="button"
                          onClick={() => setTwoFAStage('choose')}
                          style={secondaryBtnStyle(t)}
                        >
                          <ArrowLeft size={14} />
                          Voltar
                        </button>
                        <button
                          type="button"
                          disabled={!secret || isInitLoading}
                          onClick={() => {
                            setTwoFAStage('verify');
                            setTimeout(() => codeInputRefs.current[0]?.focus(), 150);
                          }}
                          style={{
                            ...primaryBtnStyle(t),
                            opacity: secret && !isInitLoading ? 1 : 0.5,
                            cursor: secret && !isInitLoading ? 'pointer' : 'not-allowed',
                          }}
                        >
                          Próximo
                          <ArrowRight size={14} />
                        </button>
                      </div>
                    </>
                  )}

                  {(twoFAMethod === 'sms' || twoFAMethod === 'email') && (
                    <>
                      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                        <div
                          style={{
                            width: 64,
                            height: 64,
                            borderRadius: '50%',
                            background: `${methodInfo.color}15`,
                            border: `1px solid ${methodInfo.color}30`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 16px',
                          }}
                        >
                          <methodInfo.icon size={28} color={methodInfo.color} />
                        </div>
                        <p style={{ margin: '0 0 20px', fontSize: '13.5px', color: t.textSecondary, lineHeight: 1.6 }}>
                          {twoFAMethod === 'sms'
                            ? 'Informe o telefone. O código é salvo no banco (SMS real depende de provedor).'
                            : 'Confirme o e-mail que receberá os códigos de verificação.'}
                        </p>
                      </div>

                      <div style={{ marginBottom: '20px' }}>
                        <label
                          style={{
                            display: 'block',
                            fontSize: '11px',
                            fontWeight: 600,
                            color: t.textMuted,
                            marginBottom: '6px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em',
                          }}
                        >
                          {twoFAMethod === 'sms' ? 'Número de Telefone' : 'E-mail de Verificação'}
                        </label>
                        <input
                          type={twoFAMethod === 'sms' ? 'tel' : 'email'}
                          value={twoFAInput}
                          onChange={(e) => setTwoFAInput(e.target.value)}
                          placeholder={twoFAMethod === 'sms' ? '+55 11 99999-9999' : currentUser?.email || 'seu@email.com'}
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            padding: '12px 16px',
                            borderRadius: '10px',
                            border: `1.5px solid ${t.border}`,
                            background: t.surfaceElevated,
                            color: t.text,
                            fontSize: '14px',
                            outline: 'none',
                            transition: 'border-color 0.2s, box-shadow 0.2s',
                          }}
                          onFocus={(e) => {
                            e.currentTarget.style.borderColor = methodInfo.color;
                            e.currentTarget.style.boxShadow = `0 0 0 3px ${methodInfo.color}15`;
                          }}
                          onBlur={(e) => {
                            e.currentTarget.style.borderColor = t.border;
                            e.currentTarget.style.boxShadow = 'none';
                          }}
                        />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                        <button
                          type="button"
                          onClick={() => setTwoFAStage('choose')}
                          style={secondaryBtnStyle(t)}
                        >
                          <ArrowLeft size={14} />
                          Voltar
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleSendCode()}
                          disabled={!twoFAInput.trim() || isInitLoading}
                          style={{
                            ...primaryBtnStyle(t),
                            opacity: twoFAInput.trim() && !isInitLoading ? 1 : 0.5,
                            cursor: twoFAInput.trim() && !isInitLoading ? 'pointer' : 'not-allowed',
                          }}
                        >
                          {isInitLoading ? 'Enviando...' : 'Enviar Código'}
                          <ArrowRight size={14} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ─── STEP 3: VERIFICAÇÃO ─── */}
              {twoFAStage === 'verify' && (
                <div style={{ animation: 'rr-fadeIn 0.3s ease', textAlign: 'center' }}>
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: '50%',
                      background: methodInfo ? `${methodInfo.color}15` : `${t.primary}15`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 16px',
                    }}
                  >
                    <KeyRound size={26} color={methodInfo?.color || t.primary} />
                  </div>

                  <h3 style={{ margin: '0 0 6px', fontSize: '18px', fontWeight: 700, color: t.text }}>
                    Digite o código de verificação
                  </h3>
                  <p style={{ margin: '0 0 16px', fontSize: '13px', color: t.textSecondary, lineHeight: 1.5 }}>
                    {twoFAMethod === 'authenticator'
                      ? 'Insira o código de 6 dígitos exibido no seu app autenticador.'
                      : `Enviamos um código de 6 dígitos para ${twoFAInput || 'seu destino configurado'}.`}
                  </p>
                  {devHintCode && twoFAMethod === 'sms' && (
                    <p style={{ margin: '0 0 12px', fontSize: 12, color: '#F59E0B' }}>
                      Modo dev (sem SMS): código <strong>{devHintCode}</strong>
                    </p>
                  )}

                  {/* Campos de Código (OTP Input) */}
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '16px' }}>
                    {codeDigits.map((digit, idx) => (
                      <React.Fragment key={idx}>
                        {idx === 3 && (
                          <div style={{ display: 'flex', alignItems: 'center', color: t.textMuted, fontSize: '20px', fontWeight: 300, margin: '0 2px' }}>
                            —
                          </div>
                        )}
                        <input
                          ref={(el) => (codeInputRefs.current[idx] = el)}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleCodeDigitChange(idx, e.target.value)}
                          onKeyDown={(e) => handleCodeKeyDown(idx, e)}
                          onPaste={idx === 0 ? handleCodePaste : undefined}
                          disabled={isVerifying}
                          style={{
                            width: '52px',
                            height: '60px',
                            borderRadius: '12px',
                            border: `2px solid ${
                              verifyError
                                ? '#EF4444'
                                : digit
                                ? (methodInfo?.color || t.primary)
                                : t.border
                            }`,
                            background: digit
                              ? (mode === 'dark'
                                ? `${(methodInfo?.color || t.primary)}08`
                                : `${(methodInfo?.color || t.primary)}05`)
                              : t.surfaceElevated,
                            color: t.text,
                            fontSize: '24px',
                            fontWeight: 800,
                            textAlign: 'center',
                            outline: 'none',
                            fontFamily: "'Space Grotesk', 'JetBrains Mono', monospace",
                            transition: 'all 0.2s',
                            boxShadow: digit ? `0 4px 12px ${(methodInfo?.color || t.primary)}15` : 'none',
                            caretColor: methodInfo?.color || t.primary,
                          }}
                          onFocus={(e) => {
                            if (!verifyError) {
                              e.currentTarget.style.borderColor = methodInfo?.color || t.primary;
                              e.currentTarget.style.boxShadow = `0 0 0 4px ${(methodInfo?.color || t.primary)}15`;
                            }
                          }}
                          onBlur={(e) => {
                            if (!digit && !verifyError) {
                              e.currentTarget.style.borderColor = t.border;
                              e.currentTarget.style.boxShadow = 'none';
                            }
                          }}
                        />
                      </React.Fragment>
                    ))}
                  </div>

                  {/* Erro de código */}
                  {verifyError && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        fontSize: '12.5px',
                        color: '#EF4444',
                        marginBottom: '12px',
                        animation: 'rr-shakeIn 0.4s ease',
                      }}
                    >
                      <AlertCircle size={14} />
                      {verifyError}
                    </div>
                  )}

                  {/* Loader */}
                  {isVerifying && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        fontSize: '13px',
                        color: methodInfo?.color || t.primary,
                        marginBottom: '12px',
                      }}
                    >
                      <span
                        style={{
                          width: 16,
                          height: 16,
                          border: `2px solid ${(methodInfo?.color || t.primary)}30`,
                          borderTopColor: methodInfo?.color || t.primary,
                          borderRadius: '50%',
                          animation: 'rr-spin 0.8s linear infinite',
                          display: 'inline-block',
                        }}
                      />
                      Verificando no servidor...
                    </div>
                  )}

                  {/* Timer */}
                  {twoFAMethod !== 'authenticator' && (
                    <div style={{ marginBottom: '16px' }}>
                      {codeTimer > 0 ? (
                        <span style={{ fontSize: '12px', color: t.textMuted }}>
                          Reenviar em <strong style={{ color: t.text }}>{codeTimer}s</strong>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handleResendCode()}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: methodInfo?.color || t.primary,
                            fontSize: '12.5px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            margin: '0 auto',
                          }}
                        >
                          <RefreshCw size={13} />
                          Reenviar código
                        </button>
                      )}
                    </div>
                  )}

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '10px',
                      marginBottom: '20px',
                      padding: '12px 16px',
                      borderRadius: '10px',
                      background: t.surfaceElevated,
                      border: `1px solid ${t.border}`,
                    }}
                  >
                    <ToggleSwitch
                      checked={require2FAOnNextLogin}
                      onChange={setRequire2FAOnNextLogin}
                      label="Exigir 2FA a cada login"
                      theme={t}
                      small
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setTwoFAStage('configure');
                        setCodeDigits(['', '', '', '', '', '']);
                        setVerifyError('');
                      }}
                      style={secondaryBtnStyle(t)}
                    >
                      <ArrowLeft size={14} />
                      Voltar
                    </button>
                    <button
                      type="button"
                      disabled={isVerifying || codeDigits.join('').replace(/\D/g, '').length !== 6}
                      onClick={() => void handleVerifyCode()}
                      style={{
                        ...primaryBtnStyle(t),
                        opacity:
                          isVerifying || codeDigits.join('').replace(/\D/g, '').length !== 6 ? 0.5 : 1,
                        cursor:
                          isVerifying || codeDigits.join('').replace(/\D/g, '').length !== 6
                            ? 'not-allowed'
                            : 'pointer',
                      }}
                    >
                      {isVerifying ? 'Verificando...' : 'Confirmar código'}
                      <Check size={14} />
                    </button>
                  </div>
                  {twoFAMethod === 'authenticator' && (
                    <p style={{ margin: '14px 0 0', fontSize: 11.5, color: t.textMuted, lineHeight: 1.5 }}>
                      Se o código não for aceito: confira o horário automático do celular, use o código
                      atual (muda a cada 30s) e, se necessário, volte e escaneie o QR novamente (um QR
                      antigo fica inválido).
                    </p>
                  )}
                </div>
              )}

              {/* ─── STEP 4: BACKUP ─── */}
              {twoFAStage === 'backup' && (
                <div style={{ animation: 'rr-fadeIn 0.3s ease', textAlign: 'center' }}>
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: '50%',
                      background: 'rgba(245, 158, 11, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 16px',
                    }}
                  >
                    <KeyRound size={26} color="#F59E0B" />
                  </div>

                  <h3 style={{ margin: '0 0 6px', fontSize: '18px', fontWeight: 700, color: t.text }}>
                    Códigos de Recuperação
                  </h3>
                  <p style={{ margin: '0 0 20px', fontSize: '13px', color: t.textSecondary, lineHeight: 1.5 }}>
                    Guarde estes códigos em um local seguro. Cada código pode ser usado <strong>uma única vez</strong> caso
                    perca acesso ao seu celular. Já estão salvos no banco.
                  </p>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: '8px',
                      marginBottom: '16px',
                      padding: '16px',
                      borderRadius: '12px',
                      background: t.surfaceElevated,
                      border: `1px solid ${t.border}`,
                    }}
                  >
                    {backupCodes.map((code, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '6px',
                          background: mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                          fontSize: '13px',
                          fontWeight: 600,
                          color: t.text,
                          letterSpacing: '1px',
                        }}
                      >
                        {code}
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleCopyBackup()}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      margin: '0 auto 20px',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: `1px solid ${t.border}`,
                      background: t.surfaceElevated,
                      color: copiedBackup ? '#10B981' : t.text,
                      fontSize: '12.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {copiedBackup ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                    {copiedBackup ? 'Copiados!' : 'Copiar todos os códigos'}
                  </button>

                  <div
                    style={{
                      padding: '12px 14px',
                      borderRadius: '8px',
                      background: 'rgba(239, 68, 68, 0.06)',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      fontSize: '11.5px',
                      color: '#EF4444',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                      textAlign: 'left',
                      marginBottom: '20px',
                    }}
                  >
                    <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
                    <span>
                      <strong>Atenção:</strong> Esses códigos de emergência não serão exibidos novamente no painel. Guarde-os com carinho.
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleFinish2FA}
                    style={{
                      ...primaryBtnStyle(t),
                      width: '100%',
                      justifyContent: 'center',
                    }}
                  >
                    <ShieldCheck size={16} />
                    Concluir Ativação
                  </button>
                </div>
              )}

              {/* ─── STEP 5: SUCESSO FINAL ─── */}
              {twoFAStage === 'done' && (
                <div style={{ animation: 'rr-fadeIn 0.3s ease', textAlign: 'center', padding: '16px 0' }}>
                  <div
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: '50%',
                      background: 'rgba(16, 185, 129, 0.12)',
                      border: '2px solid rgba(16, 185, 129, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 20px',
                      animation: 'rr-checkIn 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                  >
                    <CheckCircle2 size={36} color="#10B981" />
                  </div>

                  <h3 style={{ margin: '0 0 8px', fontSize: '22px', fontWeight: 800, color: t.text }}>
                    2FA Ativado com Sucesso!
                  </h3>
                  <p style={{ margin: '0 0 8px', fontSize: '14px', color: t.textSecondary, lineHeight: 1.6 }}>
                    Conta protegida via{' '}
                    <strong style={{ color: methodInfo?.color }}>{methodInfo?.label}</strong> no PostgreSQL.
                  </p>
                  <p style={{ margin: '0 0 24px', fontSize: '12.5px', color: t.textMuted }}>
                    O próximo login pedirá o código 2FA após a senha.
                  </p>

                  <button
                    type="button"
                    onClick={handleClose2FA}
                    style={{
                      ...primaryBtnStyle(t),
                      width: '100%',
                      justifyContent: 'center',
                      background: '#10B981',
                      boxShadow: '0 6px 20px rgba(16, 185, 129, 0.3)',
                    }}
                  >
                    <Check size={16} />
                    Entendi, fechar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          MODAL DE CONFIRMAÇÃO — DESATIVAR 2FA
      ════════════════════════════════════════════════════════════ */}
      {showDisableConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px',
            animation: 'rr-fadeIn 0.2s ease',
          }}
          onClick={(e) => e.target === e.currentTarget && setShowDisableConfirm(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '420px',
              background: t.surface,
              border: `1px solid ${t.border}`,
              borderRadius: '16px',
              padding: '28px',
              boxShadow: '0 25px 60px rgba(0,0,0,0.4)',
              animation: 'rr-modalIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}
            >
              <ShieldOff size={28} color="#EF4444" />
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 700, color: t.text, textAlign: 'center' }}>
              Desativar Proteção 2FA?
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: '13px', color: t.textSecondary, lineHeight: 1.6, textAlign: 'center' }}>
              Isso remove o 2FA no banco de dados. Tem certeza?
            </p>
            {actionError && (
              <p style={{ color: '#EF4444', fontSize: 12, textAlign: 'center', marginBottom: 12 }}>{actionError}</p>
            )}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowDisableConfirm(false)}
                style={{
                  flex: 1,
                  padding: '11px',
                  borderRadius: '10px',
                  border: `1px solid ${t.border}`,
                  background: t.surfaceElevated,
                  color: t.text,
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Voltar protegido
              </button>
              <button
                type="button"
                disabled={disabling}
                onClick={() => void handleDisable2FA()}
                style={{
                  flex: 1,
                  padding: '11px',
                  borderRadius: '10px',
                  border: 'none',
                  background: '#EF4444',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(239, 68, 68, 0.3)',
                  opacity: disabling ? 0.7 : 1,
                }}
              >
                {disabling ? 'Desativando...' : 'Sim, desativar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          ANIMATIONS CSS
      ════════════════════════════════════════════ */}
      <style>{`
        @keyframes rr-fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes rr-modalIn {
          from { opacity: 0; transform: translateY(24px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes rr-checkIn {
          0% { opacity: 0; transform: scale(0.3); }
          50% { transform: scale(1.1); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes rr-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes rr-shakeIn {
          0% { transform: translateX(-6px); opacity: 0; }
          25% { transform: translateX(5px); }
          50% { transform: translateX(-3px); }
          75% { transform: translateX(2px); }
          100% { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

// ============================================
// COMPONENTES AUXILIARES / REUTILIZÁVEIS
// ============================================

const SettingsCard: React.FC<{
  icon: any;
  title: string;
  description: string;
  theme: any;
  children: React.ReactNode;
}> = ({ icon: Icon, title, description, theme: t, children }) => (
  <div
    style={{
      background: t.surface,
      border: `1px solid ${t.border}`,
      borderRadius: '14px',
      padding: '22px 24px',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '16px' }}>
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: '8px',
          background: `${t.primary}12`,
          border: `1px solid ${t.primary}25`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon size={16} color={t.primary} />
      </div>
      <div>
        <div style={{ fontSize: '15px', fontWeight: 700, color: t.text, marginBottom: '2px' }}>{title}</div>
        <div style={{ fontSize: '12.5px', color: t.textMuted, lineHeight: 1.45 }}>{description}</div>
      </div>
    </div>
    {children}
  </div>
);

const ToggleSwitch: React.FC<{
  checked: boolean;
  onChange: (val: boolean) => void;
  label: string;
  theme: any;
  small?: boolean;
}> = ({ checked, onChange, label, theme: t, small = false }) => (
  <label
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '10px',
      cursor: 'pointer',
      fontSize: small ? '12.5px' : '13px',
      color: t.text,
      userSelect: 'none',
    }}
  >
    <div
      onClick={(e) => {
        e.preventDefault();
        onChange(!checked);
      }}
      style={{
        position: 'relative',
        width: small ? '36px' : '44px',
        height: small ? '20px' : '24px',
        borderRadius: '999px',
        background: checked ? '#10B981' : t.border,
        transition: 'background 0.25s ease',
        cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: small ? '2px' : '3px',
          left: checked ? (small ? '18px' : '23px') : '3px',
          width: small ? '16px' : '18px',
          height: small ? '16px' : '18px',
          borderRadius: '50%',
          background: '#fff',
          transition: 'left 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        }}
      />
    </div>
    {label && <span>{label}</span>}
  </label>
);

// ─── Estilos de Botão Reutilizáveis ─────────────────────────
const primaryBtnStyle = (t: any): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '11px 22px',
  borderRadius: '10px',
  border: 'none',
  background: `linear-gradient(135deg, ${t.primary}, #cc0011)`,
  color: '#fff',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
  boxShadow: `0 4px 14px ${t.primary}30`,
  transition: 'all 0.2s',
});

const secondaryBtnStyle = (t: any): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '10px 16px',
  borderRadius: '10px',
  border: `1px solid ${t.border}`,
  background: t.surfaceElevated,
  color: t.textSecondary,
  fontSize: '13px',
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'all 0.2s',
});