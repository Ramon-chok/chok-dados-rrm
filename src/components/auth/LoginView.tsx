import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Sun,
  Moon,
  CheckCircle2,
  AlertCircle,
  X,
  Check,
  Cookie,
  FileText,
  Shield,
  Settings,
  Info,
  Lock as LockIcon,
  Fingerprint,
  Wifi,
} from 'lucide-react';

// ============================================
// TIPOS
// ============================================
interface CookiePreferences {
  necessary: boolean;
  analytics: boolean;
  functional: boolean;
  marketing: boolean;
}

interface ConsentData {
  cookies: CookiePreferences;
  termsAccepted: boolean;
  privacyAccepted: boolean;
  timestamp: string;
  version: string;
}

const CONSENT_STORAGE_KEY = 'rr_mind_consent_v1';
const CONSENT_VERSION = '1.0.0';

// "Manter sessão conectada": guarda SÓ o identificador (e-mail/código) para
// pré-preencher o login e a tela de 2FA. Nunca a senha nem o código 2FA.
const REMEMBER_USER_KEY = 'rr_mind_remembered_user_v1';

// Remove caracteres de controle e os que só servem para injeção (<>"'`\) — e-mails
// e códigos de usuário legítimos nunca os contêm. A validação real é do backend.
const sanitizeIdentifier = (value: string): string =>
  value.replace(/[\u0000-\u001f\u007f<>"'`\\\s]/g, '').slice(0, 100);

const loadRememberedUser = (): string => {
  try {
    const raw = localStorage.getItem(REMEMBER_USER_KEY);
    if (!raw) return '';
    const data = JSON.parse(raw) as { identifier?: unknown };
    return typeof data.identifier === 'string' ? sanitizeIdentifier(data.identifier) : '';
  } catch {
    return '';
  }
};

const saveRememberedUser = (identifier: string, remember: boolean) => {
  try {
    const clean = sanitizeIdentifier(identifier);
    if (remember && clean) {
      localStorage.setItem(REMEMBER_USER_KEY, JSON.stringify({ identifier: clean, savedAt: new Date().toISOString() }));
    } else {
      localStorage.removeItem(REMEMBER_USER_KEY);
    }
  } catch {
    /* storage indisponível (modo privado etc.) */
  }
};

// Mostra "jo***@empresa.com" na tela de 2FA sem expor o identificador completo.
const maskIdentifier = (value: string): string => {
  const at = value.indexOf('@');
  if (at > 0) return `${value.slice(0, Math.min(2, at))}***${value.slice(at)}`;
  return value.length > 3 ? `${value.slice(0, 2)}***` : value;
};

export const LoginView: React.FC = () => {
  const { login, complete2FALogin, isLoading, sessionNotice, clearSessionNotice } = useAuth();
  const { mode, toggleTheme, t } = useTheme();

  // ============================================
  // ESTADO — LOGIN
  // ============================================
  // Pré-preenche com o usuário lembrado (se "manter sessão conectada" foi usado antes).
  const [rememberedUser, setRememberedUser] = useState<string>(() => loadRememberedUser());
  const [email, setEmail] = useState(() => loadRememberedUser());
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [loginSuccess, setLoginSuccess] = useState(false);

  // 2FA
  const [pending2FA, setPending2FA] = useState<{ tempToken: string; method?: string } | null>(null);
  const [twoFACode, setTwoFACode] = useState('');
  const [twoFASubmitting, setTwoFASubmitting] = useState(false);

  // ============================================
  // ESTADO — FORGOT
  // ============================================
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSubmitted, setForgotSubmitted] = useState(false);

  // ============================================
  // ESTADO — CONSENTIMENTO LGPD
  // ============================================
  const [consentGiven, setConsentGiven] = useState(false);
  const [showCookieBanner, setShowCookieBanner] = useState(false);
  const [showCookieDetails, setShowCookieDetails] = useState(false);
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [cookiePrefs, setCookiePrefs] = useState<CookiePreferences>({
    necessary: true,
    analytics: false,
    functional: false,
    marketing: false,
  });

  // Ripple
  const [ripple, setRipple] = useState<{ x: number; y: number; show: boolean }>({ x: 0, y: 0, show: false });

  // Refs
  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // ============================================
  // CARREGA CONSENTIMENTO SALVO
  // ============================================
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CONSENT_STORAGE_KEY);
      if (saved) {
        const data: ConsentData = JSON.parse(saved);
        if (data.version === CONSENT_VERSION) {
          setConsentGiven(true);
          setCookiePrefs(data.cookies);
          setAcceptedTerms(data.termsAccepted);
          setAcceptedPrivacy(data.privacyAccepted);
          return;
        }
      }
      setTimeout(() => setShowCookieBanner(true), 800);
    } catch {
      setTimeout(() => setShowCookieBanner(true), 800);
    }
  }, []);

  // ============================================
  // AUTO FOCUS
  // ============================================
  useEffect(() => {
    if (!consentGiven) return;
    if (rememberedUser && passwordInputRef.current) passwordInputRef.current.focus();
    else if (emailInputRef.current) emailInputRef.current.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consentGiven]);

  // ============================================
  // HANDLERS
  // ============================================
  const handleKeyEvent = (e: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsLockOn(e.getModifierState && e.getModifierState('CapsLock'));
  };

  const handleRipple = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setRipple({ x: e.clientX - rect.left, y: e.clientY - rect.top, show: true });
    setTimeout(() => setRipple((r) => ({ ...r, show: false })), 600);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!consentGiven) { setShowCookieBanner(true); setErrorMessage('Por favor, aceite os termos para continuar.'); return; }
    const identifier = sanitizeIdentifier(email);
    if (!identifier) { setErrorMessage('Por favor, informe seu e-mail ou código.'); return; }
    if (!password) { setErrorMessage('Por favor, informe sua senha.'); return; }
    setSubmitting(true);
    try {
      const res = await login(identifier, password, rememberMe);
      if ('requires2FA' in res && res.requires2FA) {
        // O checkbox "manter sessão" já foi enviado ao servidor e viaja no tempToken:
        // o 2FA conclui a sessão com a MESMA escolha. A senha não fica no estado.
        setPending2FA({ tempToken: res.tempToken, method: res.method });
        setPassword('');
        setTwoFACode('');
        setErrorMessage(null);
        return;
      }
      if (!res.success) {
        setErrorMessage(('error' in res && res.error) || 'Falha ao autenticar.');
      } else {
        saveRememberedUser(identifier, rememberMe);
        setLoginSuccess(true);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handle2FASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pending2FA?.tempToken) return;
    if (!twoFACode.trim()) { setErrorMessage('Informe o código 2FA.'); return; }
    if (twoFACode.trim().length < 6) { setErrorMessage('O código deve ter ao menos 6 caracteres.'); return; }
    setTwoFASubmitting(true);
    setErrorMessage(null);
    try {
      const res = await complete2FALogin(pending2FA.tempToken, twoFACode.trim());
      if (!res.success) { setErrorMessage(('error' in res && res.error) || 'Código 2FA inválido.'); }
      else {
        // Só grava o usuário depois do 2FA concluído (login completo).
        saveRememberedUser(email, rememberMe);
        setPending2FA(null);
        setTwoFACode('');
      }
    } finally { setTwoFASubmitting(false); }
  };

  const handleForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    setForgotSubmitted(true);
  };

  // ============================================
  // CONSENTIMENTO HANDLERS
  // ============================================
  const persistConsent = (prefs: CookiePreferences, terms: boolean, privacy: boolean) => {
    const data: ConsentData = { cookies: prefs, termsAccepted: terms, privacyAccepted: privacy, timestamp: new Date().toISOString(), version: CONSENT_VERSION };
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(data));
    setConsentGiven(true);
    setShowCookieBanner(false);
    setShowCookieDetails(false);
  };

  const handleAcceptAll = () => {
    const all: CookiePreferences = { necessary: true, analytics: true, functional: true, marketing: true };
    setCookiePrefs(all); setAcceptedTerms(true); setAcceptedPrivacy(true); persistConsent(all, true, true);
  };

  const handleAcceptNecessary = () => {
    const nec: CookiePreferences = { necessary: true, analytics: false, functional: false, marketing: false };
    setCookiePrefs(nec); setAcceptedTerms(true); setAcceptedPrivacy(true); persistConsent(nec, true, true);
  };

  const handleSaveCustom = () => {
    if (!acceptedTerms || !acceptedPrivacy) { alert('É necessário aceitar os Termos de Uso e a Política de Privacidade.'); return; }
    persistConsent(cookiePrefs, acceptedTerms, acceptedPrivacy);
  };

  // ============================================
  // TOKENS
  // ============================================
  // Cor da marca nesta tela. Sai do tema, então acompanha claro/escuro
  // sozinha: no claro é o azul Arantes #2A4C7F, no escuro o azul clareado
  // que mantém contraste sobre o fundo "Noite Arantes".
  const MARCA = t.primary;
  const MARCA_ESCURA = t.primaryHover;
  // Texto sobre a cor da marca: branco no claro, quase preto no escuro.
  const SOBRE_MARCA = t.primaryForeground;

  const getStrengthColor = () => {
    if (passwordStrength <= 1) return '#EF4444';
    if (passwordStrength === 2) return '#F59E0B';
    if (passwordStrength === 3) return '#3B82F6';
    return '#10B981';
  };

  const getStrengthLabel = () => {
    if (passwordStrength === 0) return '';
    if (passwordStrength === 1) return 'Fraca';
    if (passwordStrength === 2) return 'Média';
    if (passwordStrength === 3) return 'Segura';
    return 'Excelente';
  };

  return (
    <div className="login-grade" style={{ minHeight: '100vh', background: t.bg, color: t.text, fontFamily: 'var(--ga-sans)' }}>
      {/* ============================================
          PAINEL DA MARCA (esquerda)

          É aqui que o degradê oficial aparece — e é um dos quatro lugares
          onde ele pode aparecer (marca, login, ícone de app e faixa do topo).
          Nunca em fundo de card ou de seção.

          O endosso do grupo vem pelo logo oficial em SVG, usado como imagem:
          colar o SVG do Illustrator dentro do HTML faz as classes internas
          (.cls-1, .cls-2…) colidirem quando há dois logos na mesma página.
      ============================================ */}
      <aside className="login-marca" style={{ background: t.gradient, color: '#fff' }}>
        {/* Símbolo em contorno bem apagado, como marca d'água. */}
        <img
          src="/img/marca/simbolo-branco.svg"
          alt=""
          aria-hidden="true"
          className="login-marca__simbolo"
        />
        {/* Trama de pontos: textura discreta, sem concorrer com o texto. */}
        <div className="login-marca__trama" aria-hidden="true" />

        <img
          src="/img/marca/logo-horizontal-branco.svg"
          alt="Grupo Arantes"
          className="login-marca__logo"
        />

        <div className="login-marca__centro">
          <span
            style={{
              fontFamily: 'var(--ga-display)',
              fontSize: '11.5px',
              fontWeight: 600,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.72)',
            }}
          >
            Chok Dados · Inteligência Comercial
          </span>

          <h1
            style={{
              fontFamily: 'var(--ga-display)',
              fontSize: 'clamp(1.9rem, 3.4vw, 2.6rem)',
              fontWeight: 700,
              lineHeight: 1.12,
              letterSpacing: '-0.025em',
              margin: '14px 0 0',
              maxWidth: '16ch',
              textWrap: 'balance',
            }}
          >
            O comercial do grupo, organizado numa só tela.
          </h1>

          <p
            style={{
              margin: '16px 0 0',
              fontSize: '14px',
              lineHeight: 1.6,
              color: 'rgba(255,255,255,0.82)',
              maxWidth: '44ch',
            }}
          >
            Metas, fabricantes, clientes, sortimento e margens — do pedido ao fechamento,
            cada perfil enxergando exatamente o seu escopo.
          </p>

          <div className="login-marca__fatos">
            <div>
              <strong style={{ fontFamily: 'var(--ga-display)' }}>ao vivo</strong>
              <span>do pedido ao fechamento</span>
            </div>
            <div className="login-marca__risco" aria-hidden="true" />
            <div>
              <strong style={{ fontFamily: 'var(--ga-display)' }}>por perfil</strong>
              <span>cada um vê o seu escopo</span>
            </div>
          </div>
        </div>

        <span className="login-marca__rodape">Uso interno · Grupo Arantes</span>
      </aside>

      {/* ============================================
          PAINEL DO ACESSO (direita)
      ============================================ */}
      <main className="login-acesso">
        <button
          onClick={(e) =>
            toggleTheme({
              x: e.currentTarget.getBoundingClientRect().left + e.currentTarget.offsetWidth / 2,
              y: e.currentTarget.getBoundingClientRect().top + e.currentTarget.offsetHeight / 2,
            })
          }
          className="login-tema"
          style={{
            border: `1px solid ${t.border}`,
            background: t.surface,
            color: t.textSecondary,
          }}
          aria-label={mode === 'dark' ? 'Mudar para o tema claro' : 'Mudar para o tema escuro'}
        >
          {mode === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        <div
          ref={cardRef}
          style={{
            width: '100%',
            maxWidth: '380px',
            background: t.surface,
            border: `1px solid ${t.border}`,
            borderRadius: 'var(--ga-radius)',
            padding: '32px 30px',
            boxShadow: t.shadow,
            position: 'relative',
          }}
        >
          {/* ============ CABEÇALHO DO CARD ============ */}
          <div style={{ marginBottom: '22px' }}>
            <h2
              style={{
                margin: '0 0 6px',
                fontFamily: 'var(--ga-display)',
                fontSize: '26px',
                fontWeight: 700,
                letterSpacing: '-0.025em',
                color: t.text,
              }}
            >
              Entrar
            </h2>
            <p style={{ margin: 0, fontSize: '13px', color: t.textSecondary, lineHeight: 1.5 }}>
              Use seu e-mail corporativo do Grupo Arantes.
            </p>
          </div>

          {/* Aviso de Termos */}
          {!consentGiven && (
            <div style={{
              background: mode === 'dark' ? 'rgba(245,158,11,0.08)' : 'rgba(245,158,11,0.05)',
              border: '1.5px solid rgba(245,158,11,0.25)', borderRadius: '12px',
              padding: '12px 14px', marginBottom: '24px',
              display: 'flex', alignItems: 'flex-start', gap: '10px',
              fontSize: '12.5px', color: '#D97706', animation: 'rr-shakeIn 0.5s ease-out',
            }}>
              <Info size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
              <span style={{ lineHeight: 1.5 }}>
                Aceite os <strong>Termos de Uso</strong> e a Política de Privacidade para prosseguir.
              </span>
            </div>
          )}

          {/* Aviso de sessão encerrada automaticamente (tempo total atingido / token revogado) */}
          {sessionNotice && !errorMessage && (
            <div
              role="status"
              style={{
                background: 'rgba(250,178,25,0.10)', border: '1.5px solid rgba(250,178,25,0.35)',
                borderRadius: '12px', padding: '12px 14px', marginBottom: '24px',
                display: 'flex', alignItems: 'flex-start', gap: '10px',
                fontSize: '13px', color: 'inherit',
              }}
            >
              <Info size={16} style={{ flexShrink: 0, marginTop: '2px', color: '#D99A0B' }} />
              <span style={{ lineHeight: 1.5, fontWeight: 500, flex: 1 }}>{sessionNotice}</span>
              <button
                type="button"
                onClick={clearSessionNotice}
                aria-label="Fechar aviso"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', opacity: 0.6, padding: 0, fontSize: 16, lineHeight: 1 }}
              >
                ×
              </button>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div style={{
              background: `${t.danger}14`, border: `1.5px solid ${t.danger}40`,
              borderRadius: '12px', padding: '12px 14px', marginBottom: '24px',
              display: 'flex', alignItems: 'flex-start', gap: '10px',
              fontSize: '13px', color: t.danger, animation: 'rr-shakeIn 0.4s ease',
              boxShadow: `0 6px 20px ${t.danger}14`,
            }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span style={{ lineHeight: 1.5, fontWeight: 500 }}>{errorMessage}</span>
            </div>
          )}

          {/* ============ FORMULÁRIOS ============ */}
          {pending2FA ? (
            <form onSubmit={handle2FASubmit}>
              <div style={{ marginBottom: '18px', textAlign: 'center' }}>
                <div style={{ width: 48, height: 48, borderRadius: '12px', background: `linear-gradient(135deg, ${MARCA}, ${MARCA_ESCURA})`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                  <LockIcon size={22} color={SOBRE_MARCA} />
                </div>
                <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700, color: t.text }}>Verificação 2FA</h3>
                <p style={{ margin: '0 0 6px', fontSize: 12.5, color: t.textMuted, wordBreak: 'break-all' }}>
                  Usuário: <strong style={{ color: t.text }}>{maskIdentifier(email)}</strong>
                </p>
                <p style={{ margin: 0, fontSize: 13, color: t.textSecondary, lineHeight: 1.5 }}>
                  {pending2FA.method === 'email' ? 'Código enviado ao seu e-mail.' : 'Informe o código do app autenticador.'}
                </p>
              </div>
              <div style={{ marginBottom: '18px' }}>
                <label htmlFor="twofa-code" style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: t.textMuted, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
                  Código 2FA
                </label>
                <input id="twofa-code" type="text" inputMode="numeric" autoComplete="one-time-code" value={twoFACode}
                  onChange={(e) => setTwoFACode(e.target.value.replace(/[^\dA-Za-z-]/g, '').slice(0, 12).toUpperCase())}
                  placeholder="000000" autoFocus
                  style={{ width: '100%', boxSizing: 'border-box', padding: '14px 16px', borderRadius: '12px', border: `1.5px solid ${t.border}`, background: t.surfaceElevated, color: t.text, fontSize: '22px', fontWeight: 700, letterSpacing: '8px', textAlign: 'center', outline: 'none', fontFamily: 'monospace', transition: 'border-color 0.2s' }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = MARCA)}
                  onBlur={(e) => (e.currentTarget.style.borderColor = t.border)}
                />
              </div>
              <p style={{ margin: '0 0 14px', fontSize: 12, color: t.textMuted, textAlign: 'center' }}>
                {rememberMe
                  ? 'Sessão será mantida conectada neste dispositivo.'
                  : 'Sessão termina ao fechar o navegador.'}
              </p>
              <button type="submit" disabled={twoFASubmitting || isLoading || !twoFACode.trim()}
                style={{ width: '100%', padding: '16px 24px', borderRadius: '14px', border: 'none', background: `linear-gradient(135deg, ${MARCA}, ${MARCA_ESCURA})`, color: SOBRE_MARCA, fontSize: '14.5px', fontWeight: 700, cursor: twoFASubmitting || isLoading || !twoFACode.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', opacity: twoFASubmitting || isLoading || !twoFACode.trim() ? 0.7 : 1 }}>
                {twoFASubmitting || isLoading ? 'Validando...' : 'Confirmar'}
              </button>
              <button type="button" onClick={() => { setPending2FA(null); setTwoFACode(''); setErrorMessage(null); }}
                style={{ marginTop: 12, width: '100%', padding: '10px', borderRadius: 10, border: `1px solid ${t.border}`, background: 'transparent', color: t.textSecondary, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Voltar ao login
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit}>
              {/* E-mail */}
              <div style={{ marginBottom: '20px' }}>
                <label htmlFor="email" style={{
                  display: 'block', fontSize: '11px', fontWeight: 600,
                  color: emailFocused ? MARCA : t.textMuted, marginBottom: '8px',
                  textTransform: 'uppercase', letterSpacing: '1.5px', transition: 'color 0.3s',
                }}>
                  E-mail ou código
                </label>
                <div className="rr-input-wrapper" style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  border: `1.5px solid ${emailFocused ? MARCA : t.border}`,
                  borderRadius: '14px', padding: '14px 18px',
                  background: emailFocused
                    ? (mode === 'dark' ? '${MARCA}0A' : '${MARCA}05')
                    : (mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)'),
                  transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
                  boxShadow: emailFocused ? `0 0 0 4px ${MARCA}12, 0 8px 24px ${MARCA}08` : 'none',
                  transform: emailFocused ? 'translateY(-2px)' : 'none',
                }}>
                  <Mail size={18} color={emailFocused ? MARCA : t.textMuted} style={{ transition: 'all 0.3s', transform: emailFocused ? 'scale(1.15) rotate(-5deg)' : 'scale(1)' }} />
                  <input ref={emailInputRef} id="email" type="text" value={email} maxLength={100}
                    onChange={(e) => setEmail(sanitizeIdentifier(e.target.value))}
                    onFocus={() => setEmailFocused(true)} onBlur={() => setEmailFocused(false)}
                    placeholder="Seu email ou código" required autoComplete="email"
                    style={{ border: 'none', outline: 'none', background: 'transparent', color: t.text, fontSize: '14px', width: '100%', fontFamily: 'var(--ga-sans)' }}
                  />
                  {email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && (
                    <CheckCircle2 size={16} color="#10B981" style={{ animation: 'rr-checkIn 0.3s ease' }} />
                  )}
                </div>
              </div>

              {/* Senha */}
              <div style={{ marginBottom: '22px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label htmlFor="password" style={{
                    fontSize: '11px', fontWeight: 600,
                    color: passwordFocused ? MARCA : t.textMuted,
                    textTransform: 'uppercase', letterSpacing: '1.5px', transition: 'color 0.3s',
                  }}>
                    Senha de Acesso
                  </label>
                  <button type="button" onClick={() => setIsForgotModalOpen(true)}
                    className="rr-forgot-link"
                    style={{ background: 'transparent', border: 'none', color: MARCA, fontSize: '11.5px', fontWeight: 600, cursor: 'pointer', padding: 0, transition: 'all 0.2s' }}>
                    Esqueceu?
                  </button>
                </div>
                <div className="rr-input-wrapper" style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  border: `1.5px solid ${passwordFocused ? MARCA : t.border}`,
                  borderRadius: '14px', padding: '14px 18px',
                  background: passwordFocused
                    ? (mode === 'dark' ? '${MARCA}0A' : '${MARCA}05')
                    : (mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)'),
                  transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
                  boxShadow: passwordFocused ? `0 0 0 4px ${MARCA}12, 0 8px 24px ${MARCA}08` : 'none',
                  transform: passwordFocused ? 'translateY(-2px)' : 'none',
                }}>
                  <Lock size={18} color={passwordFocused ? MARCA : t.textMuted}
                    style={{ transition: 'all 0.3s', transform: passwordFocused ? 'rotate(-12deg) scale(1.15)' : 'rotate(0deg) scale(1)' }} />
                  <input ref={passwordInputRef} id="password" type={showPassword ? 'text' : 'password'} value={password} maxLength={128}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setPasswordFocused(true)} onBlur={() => setPasswordFocused(false)}
                    onKeyUp={handleKeyEvent} onKeyDown={handleKeyEvent}
                    placeholder="••••••••••••" required autoComplete="current-password"
                    style={{ border: 'none', outline: 'none', background: 'transparent', color: t.text, fontSize: '14px', width: '100%', fontFamily: 'var(--ga-sans)' }}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="rr-eye-btn"
                    style={{ background: 'transparent', border: 'none', color: t.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0, transition: 'all 0.2s' }}
                    title={showPassword ? 'Ocultar' : 'Ver senha'}>
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                {/* Caps lock */}
                {capsLockOn && passwordFocused && (
                  <div style={{
                    marginTop: '8px', padding: '7px 10px', borderRadius: '8px',
                    background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
                    fontSize: '11px', color: '#D97706', display: 'flex', alignItems: 'center', gap: '6px',
                    animation: 'rr-shakeIn 0.4s ease',
                  }}>
                    <AlertCircle size={13} /> Caps Lock Ativo
                  </div>
                )}
              </div>

              {/* Remember me */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '28px', cursor: 'pointer', userSelect: 'none' }}>
                <input id="rememberMe" type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} style={{ display: 'none' }} />
                <div style={{
                  width: '20px', height: '20px', borderRadius: '6px',
                  border: `1.5px solid ${rememberMe ? MARCA : t.border}`,
                  background: rememberMe ? MARCA : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.25s cubic-bezier(0.16,1,0.3,1)', flexShrink: 0,
                  boxShadow: rememberMe ? `0 4px 12px ${MARCA}25` : 'none',
                }}>
                  {rememberMe && <Check size={12} color="#fff" strokeWidth={3} style={{ animation: 'rr-checkIn 0.2s ease' }} />}
                </div>
                <span style={{ fontSize: '13px', color: t.textSecondary }}>Manter sessão conectada</span>
              </label>

              {rememberedUser && (
                <button
                  type="button"
                  onClick={() => { saveRememberedUser('', false); setRememberedUser(''); setEmail(''); emailInputRef.current?.focus(); }}
                  style={{ background: 'transparent', border: 'none', color: t.textMuted, fontSize: '11.5px', cursor: 'pointer', padding: 0, margin: '-14px 0 20px', textDecoration: 'underline' }}
                >
                  Não sou eu — esquecer este usuário
                </button>
              )}

              {/* Submit */}
              <button type="submit" disabled={isLoading || submitting || !consentGiven}
                className={`rr-submit-btn ${!consentGiven ? 'disabled' : ''}`}
                onClick={(e) => consentGiven && handleRipple(e)}
                style={{
                  width: '100%', padding: '16px 24px', borderRadius: '14px', border: 'none',
                  background: !consentGiven ? t.border : `linear-gradient(135deg, ${MARCA}, ${MARCA_ESCURA})`,
                  color: '#FFFFFF', fontSize: '14.5px', fontWeight: 700,
                  cursor: isLoading || submitting || !consentGiven ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
                  transition: 'all 0.3s cubic-bezier(0.16,1,0.3,1)',
                  boxShadow: consentGiven ? `0 8px 30px ${MARCA}30` : 'none',
                  position: 'relative', overflow: 'hidden',
                  fontFamily: 'var(--ga-display)', letterSpacing: '0.5px',
                }}>
                {/* Ripple */}
                {ripple.show && (
                  <span style={{
                    position: 'absolute', left: ripple.x, top: ripple.y,
                    width: '300px', height: '300px', marginLeft: '-150px', marginTop: '-150px',
                    borderRadius: '50%', background: 'rgba(255,255,255,0.25)',
                    animation: 'rr-ripple 0.6s ease-out', pointerEvents: 'none',
                  }} />
                )}
                {/* Shimmer */}
                {consentGiven && !isLoading && !submitting && <div className="rr-shimmer-sweep" />}

                {isLoading || submitting ? (
                  <>
                    <span style={{ width: '20px', height: '20px', border: '2.5px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'rr-spin 0.8s linear infinite' }} />
                    <span>Autenticando...</span>
                  </>
                ) : !consentGiven ? (
                  <>
                    <LockIcon size={16} />
                    <span>Aceite os Termos</span>
                  </>
                ) : (
                  <>
                    <span>Entrar</span>
                    <ArrowRight size={18} className="rr-arrow-icon" style={{ transition: 'transform 0.3s' }} />
                  </>
                )}
              </button>
            </form>
          )}

          {/* ============ RODAPÉ DO CARD ============ */}
          <div
            style={{
              marginTop: '22px',
              paddingTop: '16px',
              borderTop: `1px solid ${t.border}`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', flexWrap: 'wrap', fontSize: '11.5px' }}>
              <button
                onClick={() => setIsTermsModalOpen(true)}
                className="rr-legal-link"
                style={{ background: 'none', border: 'none', color: t.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', padding: 0, transition: 'color 0.2s', fontWeight: 500 }}
              >
                <FileText size={11} /> Termos
              </button>
              <span style={{ color: t.textMuted, opacity: 0.35 }}>·</span>
              <button
                onClick={() => setIsPrivacyModalOpen(true)}
                className="rr-legal-link"
                style={{ background: 'none', border: 'none', color: t.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', padding: 0, transition: 'color 0.2s', fontWeight: 500 }}
              >
                <Shield size={11} /> Privacidade
              </button>
              <span style={{ color: t.textMuted, opacity: 0.35 }}>·</span>
              <button
                onClick={() => setShowCookieBanner(true)}
                className="rr-legal-link"
                style={{ background: 'none', border: 'none', color: t.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', padding: 0, transition: 'color 0.2s', fontWeight: 500 }}
              >
                <Cookie size={11} /> Cookies
              </button>
            </div>
            {/* Endosso do grupo: o produto tem nome próprio, a casa é a mesma. */}
            <span style={{ fontSize: '11px', color: t.textMuted, textAlign: 'center', lineHeight: 1.5 }}>
              Grupo Arantes · Chok Dados · uso interno
            </span>
          </div>
        </div>
      </main>

      {/* ============================================
          COOKIE BANNER
      ============================================ */}
      {showCookieBanner && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9998, padding: '20px', animation: 'rr-slideUp 0.4s cubic-bezier(0.16,1,0.3,1)' }}>
          <div style={{
            maxWidth: '680px', margin: '0 auto',
            background: mode === 'dark' ? 'rgba(15,15,15,0.98)' : 'rgba(255,255,255,0.98)',
            backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)',
            border: `1px solid ${t.border}`, borderLeft: `4px solid ${MARCA}`,
            borderRadius: '14px', padding: showCookieDetails ? '24px' : '20px 24px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}>
            {!showCookieDetails ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ width: 40, height: 40, borderRadius: '10px', background: `linear-gradient(135deg, ${MARCA}, ${MARCA_ESCURA})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 4px 14px ${MARCA}4D` }}>
                  <Cookie size={20} color="#fff" />
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <h3 style={{ margin: '0 0 4px', fontSize: '13.5px', fontWeight: 700, color: t.text }}>Sua privacidade importa</h3>
                  <p style={{ margin: 0, fontSize: '12px', color: t.textSecondary, lineHeight: 1.5 }}>
                    Utilizamos cookies conforme a LGPD.{' '}
                    <button onClick={() => setIsPrivacyModalOpen(true)} style={{ background: 'none', border: 'none', color: MARCA, cursor: 'pointer', padding: 0, fontSize: '12px', fontWeight: 500, textDecoration: 'underline' }}>Saiba mais</button>
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button onClick={() => setShowCookieDetails(true)} style={{ padding: '9px 14px', borderRadius: '8px', border: `1px solid ${t.border}`, background: 'transparent', color: t.textSecondary, fontSize: '12px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', transition: 'all 0.2s' }}>
                    <Settings size={12} /> Personalizar
                  </button>
                  <button onClick={handleAcceptNecessary} style={{ padding: '9px 14px', borderRadius: '8px', border: `1px solid ${t.border}`, background: mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', color: t.text, fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}>
                    Necessários
                  </button>
                  <button onClick={handleAcceptAll} className="rr-accept-all-btn" style={{ padding: '9px 18px', borderRadius: '8px', border: 'none', background: MARCA, color: SOBRE_MARCA, fontSize: '12px', fontWeight: 600, cursor: 'pointer', boxShadow: `0 4px 14px ${MARCA}4D`, transition: 'all 0.2s' }}>
                    Aceitar todos
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', paddingBottom: '14px', borderBottom: `1px solid ${t.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: 36, height: 36, borderRadius: '8px', background: `linear-gradient(135deg, ${MARCA}, ${MARCA_ESCURA})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Settings size={16} color="#fff" />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: t.text }}>Preferências de Privacidade</h3>
                      <p style={{ margin: '2px 0 0', fontSize: '11px', color: t.textMuted }}>Escolha quais dados podem ser coletados</p>
                    </div>
                  </div>
                  <button onClick={() => setShowCookieDetails(false)} style={{ padding: '6px', background: 'none', border: 'none', color: t.textMuted, cursor: 'pointer', borderRadius: '6px' }}>
                    <X size={16} />
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                  {([
                    { key: 'necessary' as const, title: 'Necessários', desc: 'Essenciais para o funcionamento.', required: true },
                    { key: 'functional' as const, title: 'Funcionais', desc: 'Lembram suas preferências.', required: false },
                    { key: 'analytics' as const, title: 'Análise', desc: 'Melhorias de experiência.', required: false },
                    { key: 'marketing' as const, title: 'Marketing', desc: 'Ofertas e comunicações.', required: false },
                  ]).map((c) => (
                    <div key={c.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: '10px', background: mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', border: `1px solid ${t.border}` }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                          <span style={{ fontSize: '12.5px', fontWeight: 600, color: t.text }}>{c.title}</span>
                          {c.required && <span style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', padding: '1px 5px', borderRadius: '3px', background: 'rgba(16,185,129,0.1)', color: '#10B981', border: '1px solid rgba(16,185,129,0.3)' }}>Obrigatório</span>}
                        </div>
                        <p style={{ margin: 0, fontSize: '11px', color: t.textSecondary }}>{c.desc}</p>
                      </div>
                      <label style={{ position: 'relative', display: 'inline-block', width: '38px', height: '20px', flexShrink: 0, cursor: c.required ? 'not-allowed' : 'pointer', opacity: c.required ? 0.7 : 1 }}>
                        <input type="checkbox" checked={cookiePrefs[c.key]} disabled={c.required}
                          onChange={(e) => setCookiePrefs((prev) => ({ ...prev, [c.key]: e.target.checked }))} style={{ opacity: 0, width: 0, height: 0 }} />
                        <span style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: cookiePrefs[c.key] ? MARCA : mode === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)', borderRadius: '20px', transition: 'background 0.2s' }} />
                        <span style={{ position: 'absolute', height: '14px', width: '14px', left: cookiePrefs[c.key] ? '21px' : '3px', top: '3px', background: '#fff', borderRadius: '50%', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
                      </label>
                    </div>
                  ))}
                </div>

                <div style={{ padding: '12px 14px', borderRadius: '10px', background: '${MARCA}0A', border: `1px solid ${MARCA}26`, marginBottom: '14px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} style={{ display: 'none' }} />
                      <div style={{ width: '16px', height: '16px', borderRadius: '4px', border: `1.5px solid ${acceptedTerms ? MARCA : t.border}`, background: acceptedTerms ? MARCA : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {acceptedTerms && <Check size={10} color="#fff" strokeWidth={3} />}
                      </div>
                      <span style={{ fontSize: '12px', color: t.textSecondary }}>
                        Aceito os <button type="button" onClick={(e) => { e.preventDefault(); setIsTermsModalOpen(true); }} style={{ background: 'none', border: 'none', color: MARCA, cursor: 'pointer', padding: 0, fontSize: '12px', fontWeight: 600, textDecoration: 'underline' }}>Termos de Uso</button>
                      </span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={acceptedPrivacy} onChange={(e) => setAcceptedPrivacy(e.target.checked)} style={{ display: 'none' }} />
                      <div style={{ width: '16px', height: '16px', borderRadius: '4px', border: `1.5px solid ${acceptedPrivacy ? MARCA : t.border}`, background: acceptedPrivacy ? MARCA : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {acceptedPrivacy && <Check size={10} color="#fff" strokeWidth={3} />}
                      </div>
                      <span style={{ fontSize: '12px', color: t.textSecondary }}>
                        Aceito a <button type="button" onClick={(e) => { e.preventDefault(); setIsPrivacyModalOpen(true); }} style={{ background: 'none', border: 'none', color: MARCA, cursor: 'pointer', padding: 0, fontSize: '12px', fontWeight: 600, textDecoration: 'underline' }}>Política de Privacidade</button> (LGPD)
                      </span>
                    </label>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button onClick={handleAcceptNecessary} style={{ padding: '9px 14px', borderRadius: '8px', border: `1px solid ${t.border}`, background: 'transparent', color: t.textSecondary, fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}>
                    Rejeitar opcionais
                  </button>
                  <button onClick={handleSaveCustom} disabled={!acceptedTerms || !acceptedPrivacy}
                    style={{ padding: '9px 18px', borderRadius: '8px', border: 'none', background: !acceptedTerms || !acceptedPrivacy ? t.textMuted : MARCA, color: SOBRE_MARCA, fontSize: '12px', fontWeight: 600, cursor: !acceptedTerms || !acceptedPrivacy ? 'not-allowed' : 'pointer', boxShadow: acceptedTerms && acceptedPrivacy ? `0 4px 14px ${MARCA}4D` : 'none' }}>
                    Salvar preferências
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================
          MODALS
      ============================================ */}
      {isTermsModalOpen && (
        <LegalModal title="Termos de Uso" subtitle="Última atualização: 15/01/2026 · v1.0.0" icon={FileText} onClose={() => setIsTermsModalOpen(false)} theme={t} mode={mode} rrRed={MARCA}>
          <LS t="1. Aceitação dos Termos" th={t}>Ao acessar e utilizar a plataforma RR Mind, você concorda em cumprir estes Termos de Uso. Se você não concorda com qualquer parte destes termos, não deve utilizar a plataforma.</LS>
          <LS t="2. Descrição do Serviço" th={t}>A RR Mind é uma plataforma de inteligência comercial que oferece ferramentas de análise de dados, gestão de vendas e insights estratégicos para empresas distribuidoras.</LS>
          <LS t="3. Cadastro e Conta" th={t}><p>• Você é responsável por manter a confidencialidade de suas credenciais.</p><p>• Todas as atividades em sua conta são de sua responsabilidade.</p><p>• Notifique imediatamente sobre uso não autorizado.</p></LS>
          <LS t="4. Uso Aceitável" th={t}><p>Você concorda em NÃO:</p><p>• Utilizar a plataforma para fins ilegais</p><p>• Tentar acessar dados de outros usuários</p><p>• Realizar engenharia reversa</p><p>• Interferir no funcionamento da plataforma</p></LS>
          <LS t="5. Propriedade Intelectual" th={t}>Todos os direitos relacionados à plataforma RR Mind são propriedade exclusiva da empresa e estão protegidos por leis de propriedade intelectual.</LS>
          <LS t="6. Limitação de Responsabilidade" th={t}>A plataforma é fornecida "como está". Nossa responsabilidade máxima é limitada ao valor pago pelo serviço nos últimos 12 meses.</LS>
          <LS t="7. Modificações" th={t}>Reservamo-nos o direito de modificar estes termos. Notificações serão enviadas com no mínimo 30 dias de antecedência.</LS>
          <LS t="8. Lei Aplicável" th={t}>Estes termos são regidos pelas leis da República Federativa do Brasil.</LS>
        </LegalModal>
      )}

      {isPrivacyModalOpen && (
        <LegalModal title="Política de Privacidade" subtitle="LGPD (Lei nº 13.709/2018) · 15/01/2026" icon={Shield} onClose={() => setIsPrivacyModalOpen(false)} theme={t} mode={mode} rrRed={MARCA}>
          <LS t="1. Dados Coletados" th={t}><p><strong>Identificação:</strong> Nome, e-mail, cargo, empresa.</p><p><strong>Uso:</strong> Logs, IP, navegador, SO.</p><p><strong>Negócio:</strong> Dados comerciais, metas, vendas.</p></LS>
          <LS t="2. Base Legal (Art. 7º)" th={t}><p>• <strong>Consentimento</strong> — cookies opcionais</p><p>• <strong>Execução de contrato</strong> — serviços</p><p>• <strong>Legítimo interesse</strong> — segurança</p><p>• <strong>Obrigação legal</strong></p></LS>
          <LS t="3. Finalidade" th={t}><p>• Autenticação e controle de acesso</p><p>• Personalização da experiência</p><p>• Análise de performance</p><p>• Cumprimento de obrigações legais</p></LS>
          <LS t="4. Compartilhamento" th={t}>Seus dados NÃO são vendidos. Podem ser compartilhados com prestadores essenciais sob contrato de confidencialidade e autoridades mediante ordem judicial.</LS>
          <LS t="5. Segurança" th={t}><p>• Criptografia TLS 1.3 e AES-256</p><p>• Controle RBAC</p><p>• Auditoria completa</p><p>• Backups regulares</p></LS>
          <LS t="6. Seus Direitos (Art. 18)" th={t}><p>• Confirmar, acessar, corrigir dados</p><p>• Solicitar anonimização ou eliminação</p><p>• Revogar consentimento</p><p>• Peticionar perante a ANPD</p></LS>
          <LS t="7. DPO" th={t}><p><strong>E-mail:</strong> dpo@rrmind.com.br</p><p><strong>Prazo:</strong> até 15 dias úteis</p></LS>
        </LegalModal>
      )}

      {/* FORGOT PASSWORD MODAL */}
      {isForgotModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', animation: 'rr-fadeIn 0.25s ease' }} onClick={() => setIsForgotModalOpen(false)}>
          <div style={{ width: '100%', maxWidth: '440px', background: mode === 'dark' ? 'rgba(20,20,20,0.95)' : '#fff', border: `1px solid ${t.border}`, borderRadius: '20px', padding: '32px', position: 'relative', boxShadow: '0 25px 60px rgba(0,0,0,0.5)', animation: 'rr-modalIn 0.3s cubic-bezier(0.4,0,0.2,1)' }} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => { setIsForgotModalOpen(false); setForgotSubmitted(false); }} style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', color: t.textMuted, cursor: 'pointer', padding: '6px', borderRadius: '8px', display: 'flex' }}>
              <X size={18} />
            </button>

            {forgotSubmitted ? (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(61,214,140,0.12)', border: '1px solid rgba(61,214,140,0.3)', color: '#3DD68C', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', animation: 'rr-checkIn 0.4s' }}>
                  <CheckCircle2 size={28} />
                </div>
                <h3 style={{ margin: '0 0 10px', fontSize: '20px', fontWeight: 700, color: t.text, fontFamily: 'var(--ga-display)' }}>Instruções enviadas</h3>
                <p style={{ margin: '0 0 24px', fontSize: '13.5px', color: t.textSecondary, lineHeight: 1.55 }}>
                  Link enviado para <strong style={{ color: t.text }}>{forgotEmail || email}</strong>. Verifique sua caixa de entrada.
                </p>
                <button type="button" onClick={() => { setIsForgotModalOpen(false); setForgotSubmitted(false); }}
                  style={{ padding: '11px 24px', borderRadius: '10px', border: 'none', background: MARCA, color: SOBRE_MARCA, fontWeight: 600, fontSize: '13.5px', cursor: 'pointer', boxShadow: `0 6px 20px ${MARCA}4D` }}>
                  Retornar ao login
                </button>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '10px', background: `linear-gradient(135deg, ${MARCA}, ${MARCA_ESCURA})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Mail size={17} color="#fff" />
                  </div>
                  <span style={{ fontSize: '10.5px', color: t.textMuted, textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 500 }}>Recuperação</span>
                </div>
                <h3 style={{ margin: '0 0 8px', fontSize: '22px', fontWeight: 700, color: t.text, fontFamily: 'var(--ga-display)' }}>Recuperar senha</h3>
                <p style={{ margin: '0 0 24px', fontSize: '13.5px', color: t.textSecondary, lineHeight: 1.55 }}>
                  Informe seu e-mail cadastrado para receber o token de redefinição.
                </p>
                <form onSubmit={handleForgotSubmit}>
                  <div style={{ marginBottom: '22px' }}>
                    <label style={{ display: 'block', fontSize: '10.5px', color: t.textMuted, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 500 }}>E-mail corporativo</label>
                    <input type="email" value={forgotEmail || email} onChange={(e) => setForgotEmail(sanitizeIdentifier(e.target.value))} maxLength={100} required placeholder="Seu email ou código"
                      style={{ width: '100%', boxSizing: 'border-box', padding: '13px 16px', borderRadius: '12px', border: `1px solid ${t.border}`, background: mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', color: t.text, fontSize: '14px', fontFamily: 'var(--ga-sans)', outline: 'none', transition: 'border-color 0.2s' }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = MARCA)} onBlur={(e) => (e.currentTarget.style.borderColor = t.border)}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button type="button" onClick={() => setIsForgotModalOpen(false)} style={{ padding: '10px 18px', borderRadius: '10px', border: `1px solid ${t.border}`, background: 'transparent', color: t.textSecondary, fontSize: '13.5px', cursor: 'pointer', fontWeight: 500 }}>Cancelar</button>
                    <button type="submit" style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', background: MARCA, color: SOBRE_MARCA, fontSize: '13.5px', fontWeight: 600, cursor: 'pointer', boxShadow: `0 6px 20px ${MARCA}4D` }}>Enviar link</button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================
          KEYFRAMES & STYLES
      ============================================ */}
      <style>{`
        @keyframes rr-cardEntrance {
          0% { opacity: 0; transform: perspective(1000px) translateY(40px) rotateX(4deg) scale(0.96); }
          100% { opacity: 1; transform: perspective(1000px) translateY(0) rotateX(0deg) scale(1); }
        }
        @keyframes rr-fadeInUp {
          from { opacity: 0; transform: translateY(25px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes rr-fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes rr-modalIn {
          from { opacity: 0; transform: translateY(20px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes rr-slideUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes rr-shakeIn {
          0% { transform: translateX(-8px); opacity: 0; }
          25% { transform: translateX(6px); }
          50% { transform: translateX(-4px); }
          75% { transform: translateX(3px); }
          100% { transform: translateX(0); opacity: 1; }
        }
        @keyframes rr-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.2); }
        }
        @keyframes rr-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes rr-spin-slow {
          to { transform: rotate(360deg); }
        }
        @keyframes rr-orbital {
          0% { transform: translateX(-50%) rotate(0deg) translateY(-32px) rotate(0deg); }
          100% { transform: translateX(-50%) rotate(360deg) translateY(-32px) rotate(-360deg); }
        }
        @keyframes rr-checkIn {
          0% { opacity: 0; transform: scale(0.5); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes rr-float {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(20px, -20px); }
        }
        @keyframes rr-shimmerLine {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes rr-shimmerSweep {
          0% { left: -160%; }
          45% { left: 160%; }
          100% { left: 160%; }
        }
        @keyframes rr-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes rr-ripple {
          0% { transform: scale(0); opacity: 0.5; }
          100% { transform: scale(1); opacity: 0; }
        }

        .rr-shimmer-sweep {
          position: absolute;
          top: 0;
          width: 60%;
          height: 100%;
          background: linear-gradient(to right, rgba(255,255,255,0) 0%, rgba(255,255,255,0.25) 50%, rgba(255,255,255,0) 100%);
          transform: skewX(-25deg);
          animation: rr-shimmerSweep 5s infinite ease-in-out;
          pointer-events: none;
        }

        .rr-submit-btn:not(.disabled):hover {
          transform: translateY(-2px) !important;
          box-shadow: 0 14px 40px ${MARCA}45 !important;
          filter: brightness(1.08);
        }
        .rr-submit-btn:not(.disabled):hover .rr-arrow-icon {
          transform: translateX(5px);
        }
        .rr-submit-btn:not(.disabled):active {
          transform: translateY(0) !important;
          filter: brightness(0.96);
        }

        .rr-theme-toggle:hover {
          border-color: ${MARCA}50 !important;
          color: ${MARCA} !important;
          background: ${mode === 'dark' ? '${MARCA}0F' : '${MARCA}07'} !important;
          transform: scale(1.08);
        }

        .rr-forgot-link:hover {
          color: ${MARCA_ESCURA} !important;
          text-decoration: underline;
        }

        .rr-eye-btn:hover {
          color: ${t.text} !important;
        }

        .rr-legal-link:hover {
          color: ${MARCA} !important;
          text-decoration: underline;
        }

        .rr-accept-all-btn:hover {
          background: ${MARCA_ESCURA} !important;
          transform: translateY(-1px);
        }

        @media (max-width: 520px) {
          .rr-login-container { padding: 0 4px !important; }
        }
      `}</style>
    </div>
  );
};

// ============================================
// COMPONENTES AUXILIARES
// ============================================
const LegalModal: React.FC<{
  title: string; subtitle: string; icon: any;
  onClose: () => void; children: React.ReactNode;
  theme: any; mode: string; rrRed: string;
}> = ({ title, subtitle, icon: Icon, onClose, children, theme: t, mode, rrRed }) => {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', h); document.body.style.overflow = ''; };
  }, [onClose]);

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', animation: 'rr-fadeIn 0.25s ease' }} onClick={onClose}>
      <div style={{ width: '100%', maxWidth: '640px', maxHeight: '85vh', background: mode === 'dark' ? 'rgba(20,20,20,0.98)' : '#fff', border: `1px solid ${t.border}`, borderRadius: '16px', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 60px rgba(0,0,0,0.5)', animation: 'rr-modalIn 0.3s cubic-bezier(0.4,0,0.2,1)', overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: '24px 28px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: mode === 'dark' ? 'rgba(15,15,15,0.6)' : 'rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: 44, height: 44, borderRadius: '12px', background: `linear-gradient(135deg, ${rrRed}, #8B0000)`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 14px ${rrRed}40` }}>
              <Icon size={20} color="#fff" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: t.text }}>{title}</h2>
              <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: t.textMuted }}>{subtitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="rr-legal-link" style={{ padding: '8px', background: 'none', border: `1px solid ${t.border}`, color: t.textMuted, cursor: 'pointer', borderRadius: '8px', display: 'flex', alignItems: 'center', transition: 'all 0.2s' }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', fontSize: '13px', color: t.textSecondary, lineHeight: 1.7 }}>{children}</div>
        <div style={{ padding: '16px 28px', borderTop: `1px solid ${t.border}`, display: 'flex', justifyContent: 'flex-end', background: mode === 'dark' ? 'rgba(15,15,15,0.6)' : 'rgba(0,0,0,0.02)' }}>
          <button onClick={onClose} style={{ padding: '10px 22px', borderRadius: '8px', border: 'none', background: rrRed, color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', boxShadow: `0 4px 14px ${rrRed}40` }}>Entendi</button>
        </div>
      </div>
    </div>
  );
};

const LS: React.FC<{ t: string; children: React.ReactNode; th: any }> = ({ t: title, children, th }) => (
  <div style={{ marginBottom: '20px' }}>
    <h3 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 700, color: th.text }}>{title}</h3>
    <div style={{ fontSize: '12.5px', lineHeight: 1.65 }}>{children}</div>
  </div>
);