import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Sun,
  Moon,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  X,
  Check,
  Cookie,
  FileText,
  Shield,
  Settings,
  Info,
  Zap,
  Lock as LockIcon,
  TrendingUp,
  Target,
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

export const LoginView: React.FC = () => {
  const { login, complete2FALogin, isLoading } = useAuth();
  const { mode, toggleTheme, t } = useTheme();

  // ============================================
  // ESTADO — LOGIN
  // ============================================
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);

  // 2FA step (após senha correta)
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

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);

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
    if (consentGiven && emailInputRef.current) {
      emailInputRef.current.focus();
    }
  }, [consentGiven]);

  // ============================================
  // FORÇA DA SENHA
  // ============================================
  useEffect(() => {
    if (!password) {
      setPasswordStrength(0);
      return;
    }
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    setPasswordStrength(strength);
  }, [password]);

  // ============================================
  // PARTICLE BACKGROUND
  // ============================================
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrame: number;
    let particles: Array<{
      x: number; y: number; size: number;
      speedX: number; speedY: number;
      opacity: number; isRed: boolean;
    }> = [];
    let mouseX = 0;
    let mouseY = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const initParticles = () => {
      particles = [];
      const count = Math.min(Math.floor((canvas.width * canvas.height) / 15000), 90);
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: Math.random() * 1.8 + 0.4,
          speedX: (Math.random() - 0.5) * 0.25,
          speedY: (Math.random() - 0.5) * 0.25,
          opacity: Math.random() * 0.3 + 0.05,
          isRed: Math.random() < 0.15,
        });
      }
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.x += p.speedX;
        p.y += p.speedY;
        const dx = mouseX - p.x;
        const dy = mouseY - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 130) {
          const force = (130 - dist) / 130;
          p.x -= dx * force * 0.008;
          p.y -= dy * force * 0.008;
        }
        if (p.x < -10) p.x = canvas.width + 10;
        if (p.x > canvas.width + 10) p.x = -10;
        if (p.y < -10) p.y = canvas.height + 10;
        if (p.y > canvas.height + 10) p.y = -10;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.isRed
          ? `rgba(215, 25, 32, ${p.opacity * 1.6})`
          : mode === 'dark'
          ? `rgba(255, 255, 255, ${p.opacity})`
          : `rgba(10, 10, 10, ${p.opacity * 0.7})`;
        ctx.fill();
      });
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 110) {
            const opacity = (1 - dist / 110) * 0.05;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            const isRed = particles[i].isRed || particles[j].isRed;
            ctx.strokeStyle = isRed
              ? `rgba(215, 25, 32, ${opacity * 2})`
              : mode === 'dark'
              ? `rgba(255, 255, 255, ${opacity})`
              : `rgba(10, 10, 10, ${opacity * 0.7})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      animationFrame = requestAnimationFrame(animate);
    };

    const handleMouse = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };

    resize();
    initParticles();
    animate();
    window.addEventListener('resize', () => { resize(); initParticles(); });
    document.addEventListener('mousemove', handleMouse);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', resize);
      document.removeEventListener('mousemove', handleMouse);
    };
  }, [mode]);

  // ============================================
  // HANDLERS
  // ============================================
  const handleKeyEvent = (e: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsLockOn(e.getModifierState && e.getModifierState('CapsLock'));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!consentGiven) {
      setShowCookieBanner(true);
      setErrorMessage('Por favor, aceite os termos para continuar.');
      return;
    }
    if (!email.trim()) {
      setErrorMessage('Por favor, informe seu e-mail ou código.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await login(email, password, rememberMe);
      if ('requires2FA' in res && res.requires2FA) {
        setPending2FA({ tempToken: res.tempToken, method: res.method });
        setTwoFACode('');
        setErrorMessage(null);
        return;
      }
      if (!res.success) {
        setErrorMessage(('error' in res && res.error) || 'Falha ao autenticar.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handle2FASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pending2FA?.tempToken) return;
    if (!twoFACode.trim()) {
      setErrorMessage('Informe o código 2FA.');
      return;
    }
    setTwoFASubmitting(true);
    setErrorMessage(null);
    try {
      const res = await complete2FALogin(pending2FA.tempToken, twoFACode.trim());
      if (!res.success) {
        setErrorMessage(('error' in res && res.error) || 'Código 2FA inválido.');
      } else {
        setPending2FA(null);
        setTwoFACode('');
      }
    } finally {
      setTwoFASubmitting(false);
    }
  };

  const handleForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    setForgotSubmitted(true);
  };

  // ============================================
  // CONSENTIMENTO — HANDLERS
  // ============================================
  const persistConsent = (prefs: CookiePreferences, terms: boolean, privacy: boolean) => {
    const data: ConsentData = {
      cookies: prefs,
      termsAccepted: terms,
      privacyAccepted: privacy,
      timestamp: new Date().toISOString(),
      version: CONSENT_VERSION,
    };
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(data));
    setConsentGiven(true);
    setShowCookieBanner(false);
    setShowCookieDetails(false);
  };

  const handleAcceptAll = () => {
    const allAccepted: CookiePreferences = {
      necessary: true,
      analytics: true,
      functional: true,
      marketing: true,
    };
    setCookiePrefs(allAccepted);
    setAcceptedTerms(true);
    setAcceptedPrivacy(true);
    persistConsent(allAccepted, true, true);
  };

  const handleAcceptNecessary = () => {
    const necessary: CookiePreferences = {
      necessary: true,
      analytics: false,
      functional: false,
      marketing: false,
    };
    setCookiePrefs(necessary);
    setAcceptedTerms(true);
    setAcceptedPrivacy(true);
    persistConsent(necessary, true, true);
  };

  const handleSaveCustom = () => {
    if (!acceptedTerms || !acceptedPrivacy) {
      alert('É necessário aceitar os Termos de Uso e a Política de Privacidade para continuar.');
      return;
    }
    persistConsent(cookiePrefs, acceptedTerms, acceptedPrivacy);
  };

  // ============================================
  // TOKENS
  // ============================================
  const RR_RED = '#D71920';
  const RR_RED_DARK = '#8B0000';

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
    <div
      style={{
        minHeight: '100vh',
        background: t.bg,
        color: t.text,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflowX: 'hidden',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {/* Particle canvas */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />

      {/* Gradient orbs */}
      <div
        style={{
          position: 'fixed',
          top: '-200px',
          right: '-200px',
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          background: `radial-gradient(circle, rgba(215,25,32,0.12) 0%, transparent 70%)`,
          pointerEvents: 'none',
          zIndex: 0,
          animation: 'rr-float 20s ease-in-out infinite',
        }}
      />
      <div
        style={{
          position: 'fixed',
          bottom: '-200px',
          left: '-200px',
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          background: `radial-gradient(circle, rgba(99,102,241,0.10) 0%, transparent 70%)`,
          pointerEvents: 'none',
          zIndex: 0,
          animation: 'rr-float 25s ease-in-out infinite reverse',
        }}
      />

      {/* Grid overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: mode === 'dark' ? 0.04 : 0.025,
          backgroundImage: `linear-gradient(${t.text} 1px, transparent 1px), linear-gradient(90deg, ${t.text} 1px, transparent 1px)`,
          backgroundSize: '80px 80px',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* ============================================
          HEADER
      ============================================ */}
      <header
        style={{
          height: '68px',
          borderBottom: `1px solid ${t.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 32px',
          position: 'relative',
          zIndex: 10,
          background: mode === 'dark' ? 'rgba(10,10,10,0.6)' : 'rgba(255,255,255,0.6)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            <svg width="40" height="40" viewBox="0 0 44 44" fill="none">
              <circle cx="22" cy="22" r="20" stroke={RR_RED} strokeWidth="1.2" strokeDasharray="3 3" opacity="0.3" />
              <circle cx="22" cy="22" r="12" stroke={t.text} strokeWidth="0.8" opacity="0.15" />
              <circle cx="22" cy="14" r="1.8" fill={RR_RED} opacity="0.8" />
              <circle cx="14" cy="26" r="1.8" fill={RR_RED} opacity="0.6" />
              <circle cx="30" cy="26" r="1.8" fill={RR_RED} opacity="0.6" />
              <circle cx="22" cy="22" r="2.5" fill={RR_RED} />
              <line x1="22" y1="16" x2="22" y2="19.5" stroke={t.text} strokeWidth="0.5" opacity="0.35" />
              <line x1="16" y1="25" x2="19.5" y2="23" stroke={t.text} strokeWidth="0.5" opacity="0.35" />
              <line x1="28" y1="25" x2="24.5" y2="23" stroke={t.text} strokeWidth="0.5" opacity="0.35" />
            </svg>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span
              style={{
                fontSize: '18px',
                fontWeight: 700,
                letterSpacing: '-0.03em',
                color: t.text,
                fontFamily: "'Space Grotesk', 'Inter', sans-serif",
              }}
            >
              <span style={{ color: RR_RED }}>RR</span> Mind
            </span>
            <span
              style={{
                fontSize: '9.5px',
                color: t.textMuted,
                letterSpacing: '2px',
                textTransform: 'uppercase',
                fontWeight: 500,
              }}
            >
              A mente por trás da evolução
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          
          <button
            onClick={toggleTheme}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              border: `1px solid ${t.border}`,
              background: mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: t.textSecondary,
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = RR_RED;
              e.currentTarget.style.color = RR_RED;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = t.border;
              e.currentTarget.style.color = t.textSecondary;
            }}
            aria-label="Alternar modo claro/escuro"
          >
            {mode === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
      </header>

      {/* ============================================
          MAIN
      ============================================ */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 24px',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '1120px',
            display: 'grid',
            gridTemplateColumns: 'minmax(320px, 480px) 1fr',
            gap: '40px',
            alignItems: 'start',
          }}
          className="rr-login-container"
        >
          {/* ============================================
              LOGIN CARD — DESIGN ATUALIZADO & DINÂMICO
          ============================================ */}
          <div
            style={{
              background: mode === 'dark' ? 'rgba(15,15,15,0.75)' : 'rgba(255,255,255,0.85)',
              backdropFilter: 'blur(30px)',
              WebkitBackdropFilter: 'blur(30px)',
              border: `1px solid ${t.border}`,
              borderRadius: '24px',
              padding: '44px 40px',
              boxShadow:
                mode === 'dark'
                  ? '0 25px 70px rgba(0,0,0,0.5), inset 0 1px 0px rgba(255,255,255,0.05)'
                  : '0 20px 50px rgba(0,0,0,0.06), inset 0 1px 0px rgba(255,255,255,0.4)',
              position: 'relative',
              overflow: 'hidden',
              animation: 'rr-fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {/* Linha decorativa animada com gradiente */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '4px',
                background: `linear-gradient(90deg, transparent 0%, ${RR_RED} 50%, transparent 100%)`,
                backgroundSize: '200% 100%',
                animation: 'rr-shimmerLine 4s infinite linear',
              }}
            />

            {/* Brilho interativo no canto superior */}
            <div
              style={{
                position: 'absolute',
                top: '-50px',
                right: '-50px',
                width: '150px',
                height: '150px',
                background: `radial-gradient(circle, ${RR_RED}20 0%, transparent 75%)`,
                pointerEvents: 'none',
                filter: 'blur(10px)',
              }}
            />

            {/* Badge de Secao */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
              <span
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: '11px',
                  color: RR_RED,
                  letterSpacing: '2px',
                  fontWeight: 700,
                  background: `${RR_RED}12`,
                  padding: '3px 8px',
                  borderRadius: '6px',
                  border: `1.5px solid ${RR_RED}25`,
                }}
              >
                CHOK DADOS
              </span>
              <div style={{ flex: 1, height: '1px', background: `linear-gradient(90deg, ${t.border}, transparent)` }} />
            </div>

            <h1
              style={{
                margin: '0 0 8px',
                fontSize: '32px',
                fontWeight: 800,
                color: t.text,
                letterSpacing: '-0.04em',
                lineHeight: 1.1,
                fontFamily: "'Space Grotesk', 'Inter', sans-serif",
              }}
            >
              Login
            </h1>
            <p
              style={{
                margin: '0 0 36px',
                fontSize: '14.5px',
                color: t.textSecondary,
                lineHeight: 1.5,
              }}
            >
              Insira suas credenciais corporativas abaixo para acessar a sua plataforma.
            </p>

            {/* Aviso de Termos de Uso Pendentes */}
            {!consentGiven && (
              <div
                style={{
                  background: mode === 'dark' ? 'rgba(245, 158, 11, 0.08)' : 'rgba(245, 158, 11, 0.05)',
                  border: '1.5px solid rgba(245, 158, 11, 0.25)',
                  borderRadius: '12px',
                  padding: '14px 16px',
                  marginBottom: '26px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  fontSize: '13px',
                  color: '#D97706',
                  animation: 'rr-shakeIn 0.5s ease-out',
                }}
              >
                <Info size={18} style={{ flexShrink: 0, marginTop: '1px' }} />
                <span style={{ lineHeight: 1.5 }}>
                  É necessário aceitar os <strong>Termos de Uso</strong> e as diretrizes de privacidade nas configurações de Cookies antes de prosseguir.
                </span>
              </div>
            )}

            {/* Banner de Erro Reativo */}
            {errorMessage && (
              <div
                style={{
                  background: 'rgba(215,25,32,0.08)',
                  border: `1.5px solid rgba(215,25,32,0.25)`,
                  borderRadius: '12px',
                  padding: '14px 16px',
                  marginBottom: '26px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  fontSize: '13.5px',
                  color: RR_RED,
                  animation: 'rr-shakeIn 0.4s ease',
                  boxShadow: '0 8px 24px rgba(215,25,32,0.1)',
                }}
              >
                <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span style={{ lineHeight: 1.5, fontWeight: 500 }}>{errorMessage}</span>
              </div>
            )}

            {pending2FA ? (
              <form onSubmit={handle2FASubmit}>
                <div style={{ marginBottom: '18px', textAlign: 'center' }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: '12px',
                      background: `linear-gradient(135deg, ${RR_RED}, ${RR_RED_DARK})`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 12px',
                    }}
                  >
                    <LockIcon size={22} color="#fff" />
                  </div>
                  <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700, color: t.text }}>
                    Verificação em duas etapas
                  </h3>
                  <p style={{ margin: 0, fontSize: 13, color: t.textSecondary, lineHeight: 1.5 }}>
                    {pending2FA.method === 'email'
                      ? 'Informe o código enviado ao seu e-mail.'
                      : pending2FA.method === 'sms'
                        ? 'Informe o código enviado por SMS (ou código de backup).'
                        : 'Informe o código do app autenticador ou um código de backup.'}
                  </p>
                </div>

                <div style={{ marginBottom: '18px' }}>
                  <label
                    htmlFor="twofa-code"
                    style={{
                      display: 'block',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: t.textMuted,
                      marginBottom: '8px',
                      textTransform: 'uppercase',
                      letterSpacing: '1.5px',
                    }}
                  >
                    Código 2FA
                  </label>
                  <input
                    id="twofa-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={twoFACode}
                    onChange={(e) => setTwoFACode(e.target.value.replace(/[^\dA-Za-z-]/g, '').slice(0, 12))}
                    placeholder="000000"
                    autoFocus
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '14px 16px',
                      borderRadius: '12px',
                      border: `1.5px solid ${t.border}`,
                      background: t.surfaceElevated,
                      color: t.text,
                      fontSize: '20px',
                      fontWeight: 700,
                      letterSpacing: '6px',
                      textAlign: 'center',
                      outline: 'none',
                      fontFamily: 'monospace',
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={twoFASubmitting || isLoading || !twoFACode.trim()}
                  style={{
                    width: '100%',
                    padding: '16px 24px',
                    borderRadius: '12px',
                    border: 'none',
                    background: `linear-gradient(135deg, ${RR_RED}, ${RR_RED_DARK})`,
                    color: '#FFFFFF',
                    fontSize: '14.5px',
                    fontWeight: 700,
                    cursor: twoFASubmitting || isLoading || !twoFACode.trim() ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '12px',
                    opacity: twoFASubmitting || isLoading || !twoFACode.trim() ? 0.7 : 1,
                  }}
                >
                  {twoFASubmitting || isLoading ? 'Validando código...' : 'Confirmar e entrar'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPending2FA(null);
                    setTwoFACode('');
                    setErrorMessage(null);
                  }}
                  style={{
                    marginTop: 14,
                    width: '100%',
                    padding: '10px',
                    borderRadius: 10,
                    border: `1px solid ${t.border}`,
                    background: 'transparent',
                    color: t.textSecondary,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Voltar ao login
                </button>
              </form>
            ) : (
            <form onSubmit={handleSubmit}>
              {/* Campo E-mail */}
              <div style={{ marginBottom: '22px' }}>
                <label
                  htmlFor="text"
                  style={{
                    display: 'block',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: emailFocused ? RR_RED : t.textMuted,
                    marginBottom: '8px',
                    textTransform: 'uppercase',
                    letterSpacing: '1.5px',
                    transition: 'color 0.25s',
                  }}
                >
                  E-mail ou código
                </label>
                <div
                  className="rr-input-wrapper"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    border: `1.5px solid ${emailFocused ? RR_RED : t.border}`,
                    borderRadius: '12px',
                    padding: '14px 18px',
                    background: emailFocused
                      ? (mode === 'dark' ? 'rgba(215,25,32,0.03)' : 'rgba(215,25,32,0.02)')
                      : (mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)'),
                    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                    boxShadow: emailFocused ? `0 0 0 4px ${RR_RED}15` : 'none',
                    transform: emailFocused ? 'translateY(-1px)' : 'none',
                  }}
                >
                  <Mail
                    size={18}
                    color={emailFocused ? RR_RED : t.textMuted}
                    style={{
                      transition: 'all 0.3s',
                      transform: emailFocused ? 'scale(1.1)' : 'scale(1)',
                    }}
                  />
                  <input
                    ref={emailInputRef}
                    id="email"
                    type="text"
                    value={email}
                    maxLength={100}
                    onChange={(e) => setEmail(e.target.value.trim())}
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
                    placeholder="E-mail ou código"
                    required
                    autoComplete="email"
                    style={{
                      border: 'none',
                      outline: 'none',
                      background: 'transparent',
                      color: t.text,
                      fontSize: '14px',
                      width: '100%',
                      fontFamily: "'Inter', sans-serif",
                    }}
                  />
                  {email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && (
                    <CheckCircle2 size={16} color="#10B981" style={{ animation: 'rr-checkIn 0.3s ease' }} />
                  )}
                </div>
              </div>

              {/* Campo Senha */}
              <div style={{ marginBottom: '24px' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '8px',
                  }}
                >
                  <label
                    htmlFor="password"
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: passwordFocused ? RR_RED : t.textMuted,
                      textTransform: 'uppercase',
                      letterSpacing: '1.5px',
                      transition: 'color 0.25s',
                    }}
                  >
                    Senha de Acesso
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsForgotModalOpen(true)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: RR_RED,
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0,
                      transition: 'color 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = RR_RED_DARK)}
                    onMouseLeave={(e) => (e.currentTarget.style.color = RR_RED)}
                  >
                    Esqueceu a senha?
                  </button>
                </div>
                <div
                  className="rr-input-wrapper"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    border: `1.5px solid ${passwordFocused ? RR_RED : t.border}`,
                    borderRadius: '12px',
                    padding: '14px 18px',
                    background: passwordFocused
                      ? (mode === 'dark' ? 'rgba(215,25,32,0.03)' : 'rgba(215,25,32,0.02)')
                      : (mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)'),
                    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                    boxShadow: passwordFocused ? `0 0 0 4px ${RR_RED}15` : 'none',
                    transform: passwordFocused ? 'translateY(-1px)' : 'none',
                  }}
                >
                  <Lock
                    size={18}
                    color={passwordFocused ? RR_RED : t.textMuted}
                    style={{
                      transition: 'all 0.3s',
                      transform: passwordFocused ? 'rotate(-10deg) scale(1.1)' : 'rotate(0deg) scale(1)',
                    }}
                  />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => setPasswordFocused(false)}
                    onKeyUp={handleKeyEvent}
                    onKeyDown={handleKeyEvent}
                    placeholder="••••••••••••"
                    required
                    autoComplete="current-password"
                    style={{
                      border: 'none',
                      outline: 'none',
                      background: 'transparent',
                      color: t.text,
                      fontSize: '14px',
                      width: '100%',
                      fontFamily: "'Inter', sans-serif",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: t.textMuted,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      padding: 0,
                      transition: 'color 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = t.text)}
                    onMouseLeave={(e) => (e.currentTarget.style.color = t.textMuted)}
                    title={showPassword ? 'Ocultar senha' : 'Ver senha'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                {/* Caps lock warning */}
                {capsLockOn && passwordFocused && (
                  <div
                    style={{
                      marginTop: '10px',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: 'rgba(245, 158, 11, 0.08)',
                      border: '1px solid rgba(245, 158, 11, 0.25)',
                      fontSize: '11.5px',
                      color: '#D97706',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      animation: 'rr-shakeIn 0.4s ease',
                    }}
                  >
                    <AlertCircle size={14} />
                    Atenção: Caps Lock Ativo
                  </div>
                )}
              </div>

              {/* Checkbox Lembrar-me */}
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  marginBottom: '32px',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <input
                  id="rememberMe"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  style={{ display: 'none' }}
                />
                <div
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '6px',
                    border: `1.5px solid ${rememberMe ? RR_RED : t.border}`,
                    background: rememberMe ? RR_RED : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                    flexShrink: 0,
                    boxShadow: rememberMe ? `0 4px 10px ${RR_RED}20` : 'none',
                  }}
                >
                  {rememberMe && (
                    <Check size={12} color="#fff" strokeWidth={3} style={{ animation: 'rr-checkIn 0.2s ease' }} />
                  )}
                </div>
                <span style={{ fontSize: '13.5px', color: t.textSecondary }}>
                  Manter sessão conectada neste dispositivo
                </span>
              </label>

              {/* Botão de Envio de Login */}
              <button
                type="submit"
                disabled={isLoading || submitting || !consentGiven}
                className={`rr-submit-btn ${!consentGiven ? 'disabled' : ''}`}
                style={{
                  width: '100%',
                  padding: '16px 24px',
                  borderRadius: '12px',
                  border: 'none',
                  background: !consentGiven ? t.border : `linear-gradient(135deg, ${RR_RED}, ${RR_RED_DARK})`,
                  color: '#FFFFFF',
                  fontSize: '14.5px',
                  fontWeight: 700,
                  cursor: isLoading || submitting || !consentGiven ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                  boxShadow: consentGiven ? `0 8px 30px ${RR_RED}30` : 'none',
                  position: 'relative',
                  overflow: 'hidden',
                  fontFamily: "'Space Grotesk', 'Inter', sans-serif",
                  letterSpacing: '0.5px',
                }}
              >
                {/* Efeito de Shimmer Sweep (Brilho dinâmico metálico) */}
                {consentGiven && !isLoading && !submitting && <div className="rr-shimmer-sweep" />}

                {isLoading || submitting ? (
                  <>
                    <span
                      style={{
                        width: '20px',
                        height: '20px',
                        border: '2.5px solid rgba(255,255,255,0.3)',
                        borderTopColor: '#fff',
                        borderRadius: '50%',
                        animation: 'rr-spin 0.8s linear infinite',
                      }}
                    />
                    <span>Validando Acesso...</span>
                  </>
                ) : !consentGiven ? (
                  <>
                    <LockIcon size={16} />
                    <span>Aceite os Termos para Entrar</span>
                  </>
                ) : (
                  <>
                    <span>Entrar no Sistema</span>
                    <ArrowRight size={18} className="rr-arrow-icon" style={{ transition: 'transform 0.3s' }} />
                  </>
                )}
              </button>
            </form>
            )}

            {/* Links de Políticas Legais */}
            <div
              style={{
                marginTop: '28px',
                display: 'flex',
                justifyContent: 'center',
                gap: '16px',
                flexWrap: 'wrap',
                fontSize: '11.5px',
              }}
            >
              <button
                onClick={() => setIsTermsModalOpen(true)}
                className="rr-legal-link"
                style={{
                  background: 'none',
                  border: 'none',
                  color: t.textMuted,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: 0,
                  transition: 'color 0.2s',
                  fontWeight: 500,
                }}
              >
                <FileText size={12} />
                Termos de Uso
              </button>
              <span style={{ color: t.textMuted, opacity: 0.4 }}>•</span>
              <button
                onClick={() => setIsPrivacyModalOpen(true)}
                className="rr-legal-link"
                style={{
                  background: 'none',
                  border: 'none',
                  color: t.textMuted,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: 0,
                  transition: 'color 0.2s',
                  fontWeight: 500,
                }}
              >
                <Shield size={12} />
                Privacidade
              </button>
              <span style={{ color: t.textMuted, opacity: 0.4 }}>•</span>
              <button
                onClick={() => setShowCookieBanner(true)}
                className="rr-legal-link"
                style={{
                  background: 'none',
                  border: 'none',
                  color: t.textMuted,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: 0,
                  transition: 'color 0.2s',
                  fontWeight: 500,
                }}
              >
                <Cookie size={12} />
                Cookies
              </button>
            </div>
          </div>

          {/* ============================================
              BARRA LATERAL / NOVA VERSÃO REVOLUCIONÁRIA
          ============================================ */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              animation: 'rr-fadeInUp 0.7s cubic-bezier(0.4,0,0.2,1) 0.1s both',
            }}
          >
            {/* CARD INSTITUCIONAL HERO */}
            <div
              style={{
                background: mode === 'dark'
                  ? 'linear-gradient(135deg, rgba(215,25,32,0.15), rgba(15,15,15,0.85))'
                  : 'linear-gradient(135deg, rgba(215,25,32,0.08), rgba(255,255,255,0.9))',
                backdropFilter: 'blur(30px)',
                WebkitBackdropFilter: 'blur(30px)',
                border: `1px solid ${t.border}`,
                borderRadius: '20px',
                padding: '36px 32px',
                position: 'relative',
                overflow: 'hidden',
                minHeight: '340px',
              }}
            >
              {/* Efeitos de Órbita e Luz de Fundo */}
              <div
                style={{
                  position: 'absolute',
                  top: '-80px',
                  right: '-80px',
                  width: '260px',
                  height: '260px',
                  borderRadius: '50%',
                  background: `radial-gradient(circle, rgba(215,25,32,0.25), transparent 70%)`,
                  pointerEvents: 'none',
                  animation: 'rr-float 8s ease-in-out infinite',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  bottom: '-60px',
                  left: '-60px',
                  width: '200px',
                  height: '200px',
                  borderRadius: '50%',
                  background: `radial-gradient(circle, rgba(99,102,241,0.15), transparent 70%)`,
                  pointerEvents: 'none',
                  animation: 'rr-float 10s ease-in-out infinite reverse',
                }}
              />

              {/* Anéis orbitais SVGs decorativos */}
              <div
                style={{
                  position: 'absolute',
                  top: '20px',
                  right: '20px',
                  width: '80px',
                  height: '80px',
                  pointerEvents: 'none',
                  opacity: 0.4,
                }}
              >
                <svg width="80" height="80" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="35" fill="none" stroke={RR_RED} strokeWidth="0.5" strokeDasharray="2 4" opacity="0.6">
                    <animateTransform attributeName="transform" type="rotate" from="0 40 40" to="360 40 40" dur="20s" repeatCount="indefinite" />
                  </circle>
                  <circle cx="40" cy="40" r="25" fill="none" stroke={RR_RED} strokeWidth="0.5" opacity="0.4">
                    <animateTransform attributeName="transform" type="rotate" from="360 40 40" to="0 40 40" dur="15s" repeatCount="indefinite" />
                  </circle>
                  <circle cx="40" cy="5" r="2" fill={RR_RED}>
                    <animateTransform attributeName="transform" type="rotate" from="0 40 40" to="360 40 40" dur="20s" repeatCount="indefinite" />
                  </circle>
                </svg>
              </div>

              {/* Indicador de Seção */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', position: 'relative', zIndex: 2 }}>
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '11px', color: RR_RED, letterSpacing: '2px', fontWeight: 600 }}>02</span>
                <div style={{ width: '32px', height: '1px', background: RR_RED, opacity: 0.5 }} />
                <span style={{ fontSize: '10.5px', color: t.textMuted, textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 500 }}>
                  Bem-vindo
                </span>
              </div>

              {/* Título com preenchimento em gradiente */}
              <h2
                style={{
                  margin: '0 0 14px',
                  fontSize: '26px',
                  fontWeight: 800,
                  color: t.text,
                  letterSpacing: '-0.03em',
                  lineHeight: 1.15,
                  fontFamily: "'Space Grotesk', 'Inter', sans-serif",
                  position: 'relative',
                  zIndex: 2,
                }}
              >
                Seu acompanhamento {' '}
                <span
                  style={{
                    background: `linear-gradient(135deg, ${RR_RED}, #ff6b6b)`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  diário
                </span>
              </h2>

              <p
                style={{
                  margin: '0 0 24px',
                  fontSize: '13.5px',
                  color: t.textSecondary,
                  lineHeight: 1.6,
                  maxWidth: '380px',
                  position: 'relative',
                  zIndex: 2,
                }}
              >
                Acompanhe suas metas, positivação e performance em tempo real.
              </p>

              {/* Grid de Métricas de Sistema */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '12px',
                  position: 'relative',
                  zIndex: 2,
                }}
              >
                {[
                  { value: '99.9%', label: 'Uptime' },
                  { value: '<200ms', label: 'Resposta' },
                  { value: '24/7', label: 'Disponível' },
                ].map((metric, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '12px 10px',
                      borderRadius: '10px',
                      background: mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                      border: `1px solid ${t.border}`,
                      textAlign: 'center',
                      transition: 'all 0.25s',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '18px',
                        fontWeight: 800,
                        color: RR_RED,
                        fontFamily: "'Space Grotesk', sans-serif",
                        letterSpacing: '-0.02em',
                      }}
                    >
                      {metric.value}
                    </div>
                    <div
                      style={{
                        fontSize: '9.5px',
                        color: t.textMuted,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        marginTop: '2px',
                        fontWeight: 600,
                      }}
                    >
                      {metric.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* GRID DE CARACTERÍSTICAS VISUAIS */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '12px',
              }}
            >
              {[
                {
                  icon: TrendingUp,
                  label: 'Análises em Tempo Real',
                  desc: 'Dashboards atualizados de forma contínua',
                  color: '#10B981',
                },
                {
                  icon: Shield,
                  label: 'Segurança dos dados',
                  desc: 'Proteção e tratamento da informação',
                  color: '#3B82F6',
                },
                {
                  icon: Target,
                  label: 'Positivações',
                  desc: 'Positivações atualizadas regula',
                  color: '#F59E0B',
                },
                {
                  icon: Sparkles,
                  label: 'Metas',
                  desc: 'Ambiente ergonômico focado em performance',
                  color: RR_RED,
                },
              ].map((f, i) => {
                const Icon = f.icon;
                return (
                  <div
                    key={i}
                    style={{
                      background: mode === 'dark' ? 'rgba(15,15,15,0.7)' : 'rgba(255,255,255,0.8)',
                      backdropFilter: 'blur(30px)',
                      border: `1px solid ${t.border}`,
                      borderRadius: '14px',
                      padding: '18px',
                      transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                      cursor: 'default',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                    className="rr-feature-card"
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '10px',
                        background: `${f.color}15`,
                        border: `1px solid ${f.color}30`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '12px',
                      }}
                    >
                      <Icon size={17} color={f.color} />
                    </div>
                    <div
                      style={{
                        fontSize: '13px',
                        fontWeight: 700,
                        color: t.text,
                        marginBottom: '4px',
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {f.label}
                    </div>
                    <div
                      style={{
                        fontSize: '11px',
                        color: t.textMuted,
                        lineHeight: 1.5,
                      }}
                    >
                      {f.desc}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* QUOTE / TESTIMONIAL CARD */}
            <div
              style={{
                background: mode === 'dark' ? 'rgba(15,15,15,0.7)' : 'rgba(255,255,255,0.8)',
                backdropFilter: 'blur(30px)',
                border: `1px solid ${t.border}`,
                borderRadius: '14px',
                padding: '20px 24px',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: -10,
                  left: 16,
                  fontSize: '80px',
                  fontFamily: 'Georgia, serif',
                  color: RR_RED,
                  opacity: 0.12,
                  lineHeight: 1,
                  pointerEvents: 'none',
                }}
              >
                "
              </div>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: `linear-gradient(135deg, ${RR_RED}, ${RR_RED_DARK})`,
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '15px',
                  fontWeight: 700,
                  flexShrink: 0,
                  boxShadow: `0 4px 14px ${RR_RED}40`,
                  position: 'relative',
                  zIndex: 1,
                }}
              >
                RR
              </div>
              <div style={{ position: 'relative', zIndex: 1 }}>
                <p
                  style={{
                    margin: '0 0 6px',
                    fontSize: '12.5px',
                    color: t.textSecondary,
                    lineHeight: 1.5,
                    fontStyle: 'italic',
                  }}
                >
                  A mente por trás da evolução da sua gestão comercial.
                </p>
                <div
                  style={{
                    fontSize: '10.5px',
                    color: t.textMuted,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    fontWeight: 600,
                  }}
                >
                  RR Mind · Plataforma Chok
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ============================================
          COOKIE BANNER
      ============================================ */}
      {showCookieBanner && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 9998,
            padding: '20px',
            animation: 'rr-slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <div
            style={{
              maxWidth: '1120px',
              margin: '0 auto',
              background: mode === 'dark' ? 'rgba(15,15,15,0.98)' : 'rgba(255,255,255,0.98)',
              backdropFilter: 'blur(30px)',
              WebkitBackdropFilter: 'blur(30px)',
              border: `1px solid ${t.border}`,
              borderLeft: `4px solid ${RR_RED}`,
              borderRadius: '14px',
              padding: showCookieDetails ? '24px' : '20px 24px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            }}
          >
            {!showCookieDetails ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '20px',
                  flexWrap: 'wrap',
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '12px',
                    background: `linear-gradient(135deg, ${RR_RED}, ${RR_RED_DARK})`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: '0 4px 14px rgba(215,25,32,0.3)',
                  }}
                >
                  <Cookie size={22} color="#fff" />
                </div>
                <div style={{ flex: 1, minWidth: 250 }}>
                  <h3
                    style={{
                      margin: '0 0 4px',
                      fontSize: '14px',
                      fontWeight: 700,
                      color: t.text,
                    }}
                  >
                    Sua privacidade importa
                  </h3>
                  <p
                    style={{
                      margin: 0,
                      fontSize: '12.5px',
                      color: t.textSecondary,
                      lineHeight: 1.5,
                    }}
                  >
                    Utilizamos cookies para melhorar sua experiência, análises e conformidade com a LGPD. Você pode escolher quais aceitar.{' '}
                    <button
                      onClick={() => setIsPrivacyModalOpen(true)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: RR_RED,
                        cursor: 'pointer',
                        padding: 0,
                        fontSize: '12.5px',
                        fontWeight: 500,
                        textDecoration: 'underline',
                      }}
                    >
                      Saiba mais
                    </button>
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setShowCookieDetails(true)}
                    style={{
                      padding: '10px 16px',
                      borderRadius: '8px',
                      border: `1px solid ${t.border}`,
                      background: 'transparent',
                      color: t.textSecondary,
                      fontSize: '12.5px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = t.text)}
                    onMouseLeave={(e) => (e.currentTarget.style.color = t.textSecondary)}
                  >
                    <Settings size={13} />
                    Personalizar
                  </button>
                  <button
                    onClick={handleAcceptNecessary}
                    style={{
                      padding: '10px 16px',
                      borderRadius: '8px',
                      border: `1px solid ${t.border}`,
                      background: mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                      color: t.text,
                      fontSize: '12.5px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    Apenas necessários
                  </button>
                  <button
                    onClick={handleAcceptAll}
                    style={{
                      padding: '10px 20px',
                      borderRadius: '8px',
                      border: 'none',
                      background: RR_RED,
                      color: '#fff',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      boxShadow: '0 4px 14px rgba(215,25,32,0.3)',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = RR_RED_DARK;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = RR_RED;
                    }}
                  >
                    Aceitar todos
                  </button>
                </div>
              </div>
            ) : (
              <div>
                {/* Header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '20px',
                    paddingBottom: '16px',
                    borderBottom: `1px solid ${t.border}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: '10px',
                        background: `linear-gradient(135deg, ${RR_RED}, ${RR_RED_DARK})`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Settings size={18} color="#fff" />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: t.text }}>
                        Preferências de Privacidade
                      </h3>
                      <p style={{ margin: '2px 0 0', fontSize: '12px', color: t.textMuted }}>
                        Escolha quais dados podem ser coletados
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowCookieDetails(false)}
                    style={{
                      padding: '6px',
                      background: 'none',
                      border: 'none',
                      color: t.textMuted,
                      cursor: 'pointer',
                      borderRadius: '6px',
                    }}
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Categorias de cookies */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                  {[
                    {
                      key: 'necessary' as const,
                      title: 'Cookies Necessários',
                      desc: 'Essenciais para o funcionamento do sistema. Não podem ser desativados.',
                      required: true,
                    },
                    {
                      key: 'functional' as const,
                      title: 'Cookies Funcionais',
                      desc: 'Lembram suas preferências como tema, idioma e configurações personalizadas.',
                      required: false,
                    },
                    {
                      key: 'analytics' as const,
                      title: 'Cookies de Análise',
                      desc: 'Nos ajudam a entender como você usa a plataforma para melhorá-la continuamente.',
                      required: false,
                    },
                    {
                      key: 'marketing' as const,
                      title: 'Cookies de Marketing',
                      desc: 'Usados para exibir comunicações e ofertas relevantes ao seu perfil.',
                      required: false,
                    },
                  ].map((cookie) => (
                    <div
                      key={cookie.key}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: '16px',
                        padding: '14px 16px',
                        borderRadius: '10px',
                        background: mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                        border: `1px solid ${t.border}`,
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            marginBottom: '4px',
                          }}
                        >
                          <span
                            style={{
                              fontSize: '13px',
                              fontWeight: 600,
                              color: t.text,
                            }}
                          >
                            {cookie.title}
                          </span>
                          {cookie.required && (
                            <span
                              style={{
                                fontSize: '9.5px',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background: 'rgba(16, 185, 129, 0.1)',
                                color: '#10B981',
                                border: '1px solid rgba(16, 185, 129, 0.3)',
                              }}
                            >
                              Obrigatório
                            </span>
                          )}
                        </div>
                        <p
                          style={{
                            margin: 0,
                            fontSize: '11.5px',
                            color: t.textSecondary,
                            lineHeight: 1.5,
                          }}
                        >
                          {cookie.desc}
                        </p>
                      </div>
                      {/* Toggle switch */}
                      <label
                        style={{
                          position: 'relative',
                          display: 'inline-block',
                          width: '40px',
                          height: '22px',
                          flexShrink: 0,
                          cursor: cookie.required ? 'not-allowed' : 'pointer',
                          opacity: cookie.required ? 0.7 : 1,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={cookiePrefs[cookie.key]}
                          disabled={cookie.required}
                          onChange={(e) =>
                            setCookiePrefs((prev) => ({ ...prev, [cookie.key]: e.target.checked }))
                          }
                          style={{ opacity: 0, width: 0, height: 0 }}
                        />
                        <span
                          style={{
                            position: 'absolute',
                            cursor: cookie.required ? 'not-allowed' : 'pointer',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: cookiePrefs[cookie.key] ? RR_RED : mode === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)',
                            borderRadius: '22px',
                            transition: 'background 0.2s',
                          }}
                        />
                        <span
                          style={{
                            position: 'absolute',
                            content: '""',
                            height: '16px',
                            width: '16px',
                            left: cookiePrefs[cookie.key] ? '21px' : '3px',
                            top: '3px',
                            background: '#fff',
                            borderRadius: '50%',
                            transition: 'left 0.2s',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                          }}
                        />
                      </label>
                    </div>
                  ))}
                </div>

                {/* Aceite Termos e Privacidade */}
                <div
                  style={{
                    padding: '14px 16px',
                    borderRadius: '10px',
                    background: 'rgba(215,25,32,0.04)',
                    border: `1px solid rgba(215,25,32,0.15)`,
                    marginBottom: '16px',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={acceptedTerms}
                        onChange={(e) => setAcceptedTerms(e.target.checked)}
                        style={{ display: 'none' }}
                      />
                      <div
                        style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '4px',
                          border: `1.5px solid ${acceptedTerms ? RR_RED : t.border}`,
                          background: acceptedTerms ? RR_RED : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          marginTop: '1px',
                        }}
                      >
                        {acceptedTerms && <Check size={11} color="#fff" strokeWidth={3} />}
                      </div>
                      <span style={{ fontSize: '12.5px', color: t.textSecondary, lineHeight: 1.5 }}>
                        Li e aceito os{' '}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            setIsTermsModalOpen(true);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: RR_RED,
                            cursor: 'pointer',
                            padding: 0,
                            fontSize: '12.5px',
                            fontWeight: 600,
                            textDecoration: 'underline',
                          }}
                        >
                          Termos de Uso
                        </button>
                      </span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={acceptedPrivacy}
                        onChange={(e) => setAcceptedPrivacy(e.target.checked)}
                        style={{ display: 'none' }}
                      />
                      <div
                        style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '4px',
                          border: `1.5px solid ${acceptedPrivacy ? RR_RED : t.border}`,
                          background: acceptedPrivacy ? RR_RED : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          marginTop: '1px',
                        }}
                      >
                        {acceptedPrivacy && <Check size={11} color="#fff" strokeWidth={3} />}
                      </div>
                      <span style={{ fontSize: '12.5px', color: t.textSecondary, lineHeight: 1.5 }}>
                        Li e aceito a{' '}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            setIsPrivacyModalOpen(true);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: RR_RED,
                            cursor: 'pointer',
                            padding: 0,
                            fontSize: '12.5px',
                            fontWeight: 600,
                            textDecoration: 'underline',
                          }}
                        >
                          Política de Privacidade
                        </button>
                        {' '}(LGPD)
                      </span>
                    </label>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    onClick={handleAcceptNecessary}
                    style={{
                      padding: '10px 16px',
                      borderRadius: '8px',
                      border: `1px solid ${t.border}`,
                      background: 'transparent',
                      color: t.textSecondary,
                      fontSize: '12.5px',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    Rejeitar opcionais
                  </button>
                  <button
                    onClick={handleSaveCustom}
                    disabled={!acceptedTerms || !acceptedPrivacy}
                    style={{
                      padding: '10px 20px',
                      borderRadius: '8px',
                      border: 'none',
                      background: !acceptedTerms || !acceptedPrivacy ? t.textMuted : RR_RED,
                      color: '#fff',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      cursor: !acceptedTerms || !acceptedPrivacy ? 'not-allowed' : 'pointer',
                      boxShadow: acceptedTerms && acceptedPrivacy ? '0 4px 14px rgba(215,25,32,0.3)' : 'none',
                    }}
                  >
                    Salvar preferências
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================
          TERMS OF USE MODAL
      ============================================ */}
      {isTermsModalOpen && (
        <LegalModal
          title="Termos de Uso"
          subtitle="Última atualização: 15 de Janeiro de 2026 · Versão 1.0.0"
          icon={FileText}
          onClose={() => setIsTermsModalOpen(false)}
          theme={t}
          mode={mode}
          rrRed={RR_RED}
        >
          <LegalSection title="1. Aceitação dos Termos" theme={t}>
            Ao acessar e utilizar a plataforma RR Mind, você concorda em cumprir estes Termos de Uso.
            Se você não concorda com qualquer parte destes termos, não deve utilizar a plataforma.
            O uso continuado da plataforma após alterações constitui aceitação dos novos termos.
          </LegalSection>
          <LegalSection title="2. Descrição do Serviço" theme={t}>
            A RR Mind é uma plataforma de inteligência comercial que oferece ferramentas de análise de dados,
            gestão de vendas e insights estratégicos para empresas distribuidoras. Os serviços incluem
            dashboards interativos, relatórios em tempo real, e sistema de controle hierárquico RBAC.
          </LegalSection>
          <LegalSection title="3. Cadastro e Conta de Usuário" theme={t}>
            <p>• Você é responsável por manter a confidencialidade de suas credenciais de acesso.</p>
            <p>• Todas as atividades realizadas em sua conta são de sua responsabilidade.</p>
            <p>• Notifique imediatamente sobre qualquer uso não autorizado.</p>
            <p>• Não é permitido compartilhar credenciais ou permitir acesso de terceiros.</p>
          </LegalSection>
          <LegalSection title="4. Uso Aceitável" theme={t}>
            <p>Você concorda em NÃO:</p>
            <p>• Utilizar a plataforma para fins ilegais ou não autorizados</p>
            <p>• Tentar acessar dados de outros usuários sem permissão</p>
            <p>• Realizar engenharia reversa ou tentar burlar mecanismos de segurança</p>
            <p>• Interferir no funcionamento normal da plataforma</p>
            <p>• Copiar, distribuir ou modificar conteúdo sem autorização expressa</p>
          </LegalSection>
          <LegalSection title="5. Propriedade Intelectual" theme={t}>
            Todos os direitos, títulos e interesses relacionados à plataforma RR Mind, incluindo software,
            design, textos, gráficos e marcas registradas, são propriedade exclusiva da empresa e estão
            protegidos por leis de propriedade intelectual.
          </LegalSection>
          <LegalSection title="6. Limitação de Responsabilidade" theme={t}>
            A plataforma é fornecida "como está". Não garantimos que o serviço será ininterrupto,
            oportuno, seguro ou livre de erros. Nossa responsabilidade máxima é limitada ao valor
            pago pelo serviço nos últimos 12 meses.
          </LegalSection>
          <LegalSection title="7. Modificações" theme={t}>
            Reservamo-nos o direito de modificar estes termos a qualquer momento. Notificações sobre
            mudanças significativas serão enviadas por e-mail e exibidas na plataforma com no mínimo
            30 dias de antecedência.
          </LegalSection>
          <LegalSection title="8. Rescisão" theme={t}>
            Podemos suspender ou encerrar seu acesso à plataforma a qualquer momento por violação
            destes termos. Você pode acessar sua conta de usuário ou solicitar encerramento a qualquer momento.
          </LegalSection>
          <LegalSection title="9. Lei Aplicável" theme={t}>
            Estes termos são regidos pelas leis da República Federativa do Brasil. Qualquer disputa
            será resolvida no foro da comarca da sede da empresa.
          </LegalSection>
        </LegalModal>
      )}

      {/* ============================================
          PRIVACY POLICY MODAL
      ============================================ */}
      {isPrivacyModalOpen && (
        <LegalModal
          title="Política de Privacidade"
          subtitle="Conforme LGPD (Lei nº 13.709/2018) · Última atualização: 15/01/2026"
          icon={Shield}
          onClose={() => setIsPrivacyModalOpen(false)}
          theme={t}
          mode={mode}
          rrRed={RR_RED}
        >
          <LegalSection title="1. Dados Coletados" theme={t}>
            <p><strong>Dados de Identificação:</strong> Nome completo, e-mail corporativo, cargo, empresa.</p>
            <p><strong>Dados de Uso:</strong> Logs de acesso, IP, navegador, sistema operacional.</p>
            <p><strong>Dados de Negócio:</strong> Informações comerciais, metas, vendas, positivação.</p>
          </LegalSection>
          <LegalSection title="2. Base Legal (Art. 7º LGPD)" theme={t}>
            <p>Tratamos seus dados com base em:</p>
            <p>• <strong>Consentimento</strong> — para cookies opcionais e comunicações</p>
            <p>• <strong>Execução de contrato</strong> — para fornecer os serviços da plataforma</p>
            <p>• <strong>Legítimo interesse</strong> — para segurança e prevenção de fraudes</p>
            <p>• <strong>Obrigação legal</strong> — quando exigido por lei</p>
          </LegalSection>
          <LegalSection title="3. Finalidade do Tratamento" theme={t}>
            <p>• Autenticação e controle de acesso</p>
            <p>• Personalização da experiência do usuário</p>
            <p>• Análise de performance e melhorias contínuas</p>
            <p>• Comunicações operacionais e de suporte</p>
            <p>• Cumprimento de obrigações legais e regulatórias</p>
          </LegalSection>
          <LegalSection title="4. Compartilhamento" theme={t}>
            Seus dados NÃO são vendidos a terceiros. Podem ser compartilhados apenas com:
            <p>• Prestadores de serviços essenciais (hospedagem, e-mail) sob contrato de confidencialidade</p>
            <p>• Autoridades competentes mediante ordem judicial</p>
            <p>• Empresas do grupo, conforme necessidade operacional</p>
          </LegalSection>
          <LegalSection title="5. Segurança da Informação" theme={t}>
            Implementamos medidas técnicas e organizacionais para proteger seus dados:
            <p>• Criptografia em trânsito (TLS 1.3) e em repouso (AES-256)</p>
            <p>• Controle de acesso baseado em funções (RBAC)</p>
            <p>• Auditoria e logs de todas as operações sensíveis</p>
            <p>• Backups regulares e planos de recuperação de desastres</p>
          </LegalSection>
          <LegalSection title="6. Retenção de Dados" theme={t}>
            Seus dados são mantidos pelo tempo necessário para as finalidades descritas ou conforme
            exigido por lei. Dados de logs são mantidos por até 6 meses. Dados de conta são excluídos
            em até 90 dias após solicitação de exclusão.
          </LegalSection>
          <LegalSection title="7. Seus Direitos (Art. 18 LGPD)" theme={t}>
            Você pode a qualquer momento:
            <p>• <strong>Confirmar</strong> a existência de tratamento de seus dados</p>
            <p>• <strong>Acessar</strong> seus dados pessoais</p>
            <p>• <strong>Corrigir</strong> dados incompletos ou desatualizados</p>
            <p>• <strong>Solicitar anonimização</strong>, bloqueio ou eliminação</p>
            <p>• <strong>Solicitar portabilidade</strong> dos dados</p>
            <p>• <strong>Revogar consentimento</strong> a qualquer momento</p>
            <p>• <strong>Peticionar</strong> perante a ANPD</p>
          </LegalSection>
          <LegalSection title="8. Cookies" theme={t}>
            Utilizamos cookies necessários (essenciais), funcionais (preferências), analíticos
            (estatísticas anonimizadas) e de marketing (opcional). Você pode gerenciar suas
            preferências a qualquer momento nas configurações.
          </LegalSection>
          <LegalSection title="9. Encarregado de Dados (DPO)" theme={t}>
            <p>Em caso de dúvidas, entre em contato com nosso Encarregado de Dados:</p>
            <p style={{ marginTop: 8 }}>
              <strong>E-mail:</strong> dpo@rrmind.com.br<br />
              <strong>Endereço:</strong> Av. Paulista, 1000 - São Paulo/SP<br />
              <strong>Prazo de resposta:</strong> até 15 dias úteis
            </p>
          </LegalSection>
          <LegalSection title="10. Alterações nesta Política" theme={t}>
            Esta política pode ser atualizada periodicamente. Notificaremos sobre alterações
            significativas por e-mail e através da plataforma com pelo menos 30 dias de antecedência.
          </LegalSection>
        </LegalModal>
      )}

      {/* ============================================
          FORGOT PASSWORD MODAL
      ============================================ */}
      {isForgotModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            animation: 'rr-fadeIn 0.25s ease',
          }}
          onClick={() => setIsForgotModalOpen(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '460px',
              background: mode === 'dark' ? 'rgba(20,20,20,0.95)' : '#fff',
              border: `1px solid ${t.border}`,
              borderRadius: '16px',
              padding: '32px',
              position: 'relative',
              boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
              animation: 'rr-modalIn 0.3s cubic-bezier(0.4,0,0.2,1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                setIsForgotModalOpen(false);
                setForgotSubmitted(false);
              }}
              style={{
                position: 'absolute',
                top: '18px',
                right: '18px',
                background: 'transparent',
                border: 'none',
                color: t.textMuted,
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '8px',
                display: 'flex',
                transition: 'all 0.2s',
              }}
            >
              <X size={18} />
            </button>

            {forgotSubmitted ? (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    background: 'rgba(61,214,140,0.12)',
                    border: '1px solid rgba(61,214,140,0.3)',
                    color: '#3DD68C',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 20px',
                    animation: 'rr-checkIn 0.4s cubic-bezier(0.4,0,0.2,1)',
                  }}
                >
                  <CheckCircle2 size={28} />
                </div>
                <h3
                  style={{
                    margin: '0 0 10px',
                    fontSize: '20px',
                    fontWeight: 700,
                    color: t.text,
                    fontFamily: "'Space Grotesk', sans-serif",
                    letterSpacing: '-0.02em',
                  }}
                >
                  Instruções enviadas
                </h3>
                <p
                  style={{
                    margin: '0 0 24px',
                    fontSize: '13.5px',
                    color: t.textSecondary,
                    lineHeight: 1.55,
                  }}
                >
                  Enviamos o link de recuperação para{' '}
                  <strong style={{ color: t.text }}>{forgotEmail || email}</strong>. Verifique sua
                  caixa de entrada e pasta de spam.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotModalOpen(false);
                    setForgotSubmitted(false);
                  }}
                  style={{
                    padding: '11px 24px',
                    borderRadius: '10px',
                    border: 'none',
                    background: RR_RED,
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: '13.5px',
                    cursor: 'pointer',
                    boxShadow: '0 6px 20px rgba(215,25,32,0.3)',
                    fontFamily: "'Space Grotesk', 'Inter', sans-serif",
                  }}
                >
                  Retornar ao login
                </button>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: '10px',
                      background: `linear-gradient(135deg, ${RR_RED}, ${RR_RED_DARK})`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Mail size={17} color="#fff" />
                  </div>
                  <div>
                    <span
                      style={{
                        fontSize: '10.5px',
                        color: t.textMuted,
                        textTransform: 'uppercase',
                        letterSpacing: '2px',
                        fontWeight: 500,
                      }}
                    >
                      Recuperação
                    </span>
                  </div>
                </div>
                <h3
                  style={{
                    margin: '0 0 8px',
                    fontSize: '22px',
                    fontWeight: 700,
                    color: t.text,
                    fontFamily: "'Space Grotesk', sans-serif",
                    letterSpacing: '-0.02em',
                  }}
                >
                  Recuperar senha
                </h3>
                <p
                  style={{
                    margin: '0 0 24px',
                    fontSize: '13.5px',
                    color: t.textSecondary,
                    lineHeight: 1.55,
                  }}
                >
                  Informe seu e-mail cadastrado. Nossa equipe de segurança enviará um token de redefinição.
                </p>

                <form onSubmit={handleForgotSubmit}>
                  <div style={{ marginBottom: '22px' }}>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '10.5px',
                        color: t.textMuted,
                        marginBottom: '8px',
                        textTransform: 'uppercase',
                        letterSpacing: '1.5px',
                        fontWeight: 500,
                      }}
                    >
                      E-mail corporativo
                    </label>
                    <input
                      type="email"
                      value={forgotEmail || email}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      required
                      placeholder="seu.email@empresa.com.br"
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: '13px 16px',
                        borderRadius: '10px',
                        border: `1px solid ${t.border}`,
                        background: mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                        color: t.text,
                        fontSize: '14px',
                        fontFamily: "'Inter', sans-serif",
                        outline: 'none',
                        transition: 'border-color 0.2s',
                      }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = RR_RED)}
                      onBlur={(e) => (e.currentTarget.style.borderColor = t.border)}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={() => setIsForgotModalOpen(false)}
                      style={{
                        padding: '10px 18px',
                        borderRadius: '10px',
                        border: `1px solid ${t.border}`,
                        background: 'transparent',
                        color: t.textSecondary,
                        fontSize: '13.5px',
                        cursor: 'pointer',
                        fontWeight: 500,
                      }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      style={{
                        padding: '10px 20px',
                        borderRadius: '10px',
                        border: 'none',
                        background: RR_RED,
                        color: '#FFFFFF',
                        fontSize: '13.5px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        boxShadow: '0 6px 20px rgba(215,25,32,0.3)',
                        fontFamily: "'Space Grotesk', 'Inter', sans-serif",
                      }}
                    >
                      Enviar link
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================
          STYLES E KEYFRAMES ADICIONAIS
      ============================================ */}
      <style>{`
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
          50% { opacity: 0.5; transform: scale(1.15); }
        }
        @keyframes rr-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes rr-checkIn {
          0% { opacity: 0; transform: scale(0.5); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes rr-float {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(15px, -15px); }
        }
        @keyframes rr-shimmerLine {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes rr-shimmerSweep {
          0% { left: -150%; }
          50% { left: 150%; }
          100% { left: 150%; }
        }
        
        /* Efeitos e micro-interacoes dos inputs */
        .rr-input-wrapper:focus-within {
          border-color: ${RR_RED} !important;
          background: ${mode === 'dark' ? 'rgba(215,25,32,0.04)' : 'rgba(215,25,32,0.02)'} !important;
        }

        /* Efeito Shimmer Sweep no Botao */
        .rr-shimmer-sweep {
          position: absolute;
          top: 0;
          width: 50%;
          height: 100%;
          background: linear-gradient(
            to right,
            rgba(255, 255, 255, 0) 0%,
            rgba(255, 255, 255, 0.25) 50%,
            rgba(255, 255, 255, 0) 100%
          );
          transform: skewX(-25deg);
          animation: rr-shimmerSweep 6s infinite ease-in-out;
          pointer-events: none;
        }

        .rr-submit-btn:not(.disabled):hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 35px ${RR_RED}50 !important;
          filter: brightness(1.1);
        }

        .rr-submit-btn:not(.disabled):hover .rr-arrow-icon {
          transform: translateX(4px);
        }

        .rr-submit-btn:not(.disabled):active {
          transform: translateY(0);
          filter: brightness(0.95);
        }

        /* Hover dinâmico nas features laterais */
        .rr-feature-card:hover {
          transform: translateY(-4px);
          box-shadow: ${mode === 'dark' ? '0 12px 30px rgba(0,0,0,0.4)' : '0 12px 25px rgba(0,0,0,0.06)'};
        }

        .rr-legal-link:hover {
          color: ${RR_RED} !important;
          text-decoration: underline;
        }

        @media (max-width: 960px) {
          .rr-login-container {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
};

// ============================================
// COMPONENTES AUXILIARES
// ============================================
const LegalModal: React.FC<{
  title: string;
  subtitle: string;
  icon: any;
  onClose: () => void;
  children: React.ReactNode;
  theme: any;
  mode: string;
  rrRed: string;
}> = ({ title, subtitle, icon: Icon, onClose, children, theme: t, mode, rrRed }) => {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'rr-fadeIn 0.25s ease',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '640px',
          maxHeight: '85vh',
          background: mode === 'dark' ? 'rgba(20,20,20,0.98)' : '#fff',
          border: `1px solid ${t.border}`,
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
          animation: 'rr-modalIn 0.3s cubic-bezier(0.4,0,0.2,1)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '24px 28px',
            borderBottom: `1px solid ${t.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: mode === 'dark' ? 'rgba(15,15,15,0.6)' : 'rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '12px',
                background: `linear-gradient(135deg, ${rrRed}, #8B0000)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: `0 4px 14px ${rrRed}40`,
              }}
            >
              <Icon size={20} color="#fff" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: t.text, letterSpacing: '-0.01em' }}>
                {title}
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: t.textMuted }}>
                {subtitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '8px',
              background: 'none',
              border: `1px solid ${t.border}`,
              color: t.textMuted,
              cursor: 'pointer',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = rrRed;
              e.currentTarget.style.color = rrRed;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = t.border;
              e.currentTarget.style.color = t.textMuted;
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px 28px',
            fontSize: '13px',
            color: t.textSecondary,
            lineHeight: 1.7,
          }}
        >
          {children}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 28px',
            borderTop: `1px solid ${t.border}`,
            display: 'flex',
            justifyContent: 'flex-end',
            background: mode === 'dark' ? 'rgba(15,15,15,0.6)' : 'rgba(0,0,0,0.02)',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '10px 22px',
              borderRadius: '8px',
              border: 'none',
              background: rrRed,
              color: '#fff',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: `0 4px 14px ${rrRed}40`,
            }}
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
};

const LegalSection: React.FC<{
  title: string;
  children: React.ReactNode;
  theme: any;
}> = ({ title, children, theme: t }) => (
  <div style={{ marginBottom: '20px' }}>
    <h3
      style={{
        margin: '0 0 8px',
        fontSize: '14px',
        fontWeight: 700,
        color: t.text,
        letterSpacing: '-0.01em',
      }}
    >
      {title}
    </h3>
    <div style={{ fontSize: '12.5px', lineHeight: 1.65 }}>{children}</div>
  </div>
);