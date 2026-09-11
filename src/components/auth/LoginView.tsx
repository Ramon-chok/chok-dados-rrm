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
} from 'lucide-react';

export const LoginView: React.FC = () => {
  const { login, isLoading } = useAuth();
  const { mode, toggleTheme, t } = useTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Forgot password modal
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSubmitted, setForgotSubmitted] = useState(false);

  // Particle canvas
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ============================================
  // PARTICLE BACKGROUND — RR MIND CORE
  // ============================================
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrame: number;
    let particles: Array<{
      x: number;
      y: number;
      size: number;
      speedX: number;
      speedY: number;
      opacity: number;
      isRed: boolean;
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

      // connections
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
    window.addEventListener('resize', () => {
      resize();
      initParticles();
    });
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
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim()) {
      setErrorMessage('Por favor, informe seu e-mail corporativo.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await login(email, password, rememberMe);
      if (!res.success) {
        setErrorMessage(res.error || 'Falha ao autenticar.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  

  const handleForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    setForgotSubmitted(true);
  };

  // ============================================
  // TOKENS â€” RR MIND
  // ============================================
  const RR_RED = '#D71920';
  const RR_RED_DARK = '#8B0000';

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
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '11.5px',
              color: t.textSecondary,
              padding: '6px 12px',
              borderRadius: '20px',
              background: mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
              border: `1px solid ${t.border}`,
              letterSpacing: '0.5px',
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#3DD68C',
                animation: 'rr-pulse 2s ease-in-out infinite',
              }}
            />
            <ShieldCheck size={13} color="#3DD68C" />
            <span style={{ textTransform: 'uppercase', fontWeight: 500 }}>RBAC 25 Permissões</span>
          </div>

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
              LOGIN CARD
              ============================================ */}
          <div
            style={{
              background: mode === 'dark' ? 'rgba(15,15,15,0.75)' : 'rgba(255,255,255,0.85)',
              backdropFilter: 'blur(30px)',
              WebkitBackdropFilter: 'blur(30px)',
              border: `1px solid ${t.border}`,
              borderRadius: '18px',
              padding: '40px 36px',
              boxShadow:
                mode === 'dark'
                  ? '0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(215,25,32,0.05)'
                  : '0 14px 40px rgba(0,0,0,0.06), 0 0 0 1px rgba(215,25,32,0.03)',
              position: 'relative',
              overflow: 'hidden',
              animation: 'rr-fadeInUp 0.7s cubic-bezier(0.4,0,0.2,1)',
            }}
          >
            {/* Decorative corner */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: '80px',
                height: '80px',
                background: `radial-gradient(circle at top right, rgba(215,25,32,0.08), transparent 70%)`,
                pointerEvents: 'none',
              }}
            />

            {/* Section label */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginBottom: '18px',
              }}
            >
              <span
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: '11px',
                  color: RR_RED,
                  letterSpacing: '2px',
                  fontWeight: 600,
                }}
              >
                01
              </span>
              <div style={{ width: '32px', height: '1px', background: RR_RED, opacity: 0.5 }} />
              <span
                style={{
                  fontSize: '10.5px',
                  color: t.textMuted,
                  textTransform: 'uppercase',
                  letterSpacing: '2px',
                  fontWeight: 500,
                }}
              >
                Acesso Seguro
              </span>
            </div>

            <h1
              style={{
                margin: '0 0 8px',
                fontSize: '28px',
                fontWeight: 700,
                color: t.text,
                letterSpacing: '-0.03em',
                lineHeight: 1.15,
                fontFamily: "'Space Grotesk', 'Inter', sans-serif",
              }}
            >
              Entrar na plataforma
            </h1>
            <p
              style={{
                margin: '0 0 32px',
                fontSize: '13.5px',
                color: t.textSecondary,
                lineHeight: 1.55,
                maxWidth: '360px',
              }}
            >
              Central de inteligência de dados, negócios e gestão comercial.
            </p>

            {/* Error Alert */}
            {errorMessage && (
              <div
                style={{
                  background: 'rgba(215,25,32,0.08)',
                  border: `1px solid rgba(215,25,32,0.25)`,
                  borderRadius: '10px',
                  padding: '12px 14px',
                  marginBottom: '22px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  fontSize: '13px',
                  color: RR_RED,
                  animation: 'rr-shakeIn 0.4s ease',
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span style={{ lineHeight: 1.45 }}>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* Email */}
              <div style={{ marginBottom: '20px' }}>
                <label
                  htmlFor="email"
                  style={{
                    display: 'block',
                    fontSize: '10.5px',
                    fontWeight: 500,
                    color: emailFocused ? RR_RED : t.textMuted,
                    marginBottom: '8px',
                    textTransform: 'uppercase',
                    letterSpacing: '1.5px',
                    transition: 'color 0.2s ease',
                  }}
                >
                  E-mail Corporativo
                </label>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    border: `1px solid ${emailFocused ? RR_RED : t.border}`,
                    borderRadius: '10px',
                    padding: '13px 16px',
                    background: emailFocused
                      ? 'rgba(215,25,32,0.03)'
                      : mode === 'dark'
                      ? 'rgba(255,255,255,0.03)'
                      : 'rgba(0,0,0,0.02)',
                    transition: 'all 0.2s ease',
                    boxShadow: emailFocused ? '0 0 0 3px rgba(215,25,32,0.08)' : 'none',
                  }}
                >
                  <Mail size={16} color={emailFocused ? RR_RED : t.textMuted} style={{ transition: 'color 0.2s' }} />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
                    placeholder="seu.email@empresa.com.br"
                    required
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
                </div>
              </div>

              {/* Password */}
              <div style={{ marginBottom: '20px' }}>
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
                      fontSize: '10.5px',
                      fontWeight: 500,
                      color: passwordFocused ? RR_RED : t.textMuted,
                      textTransform: 'uppercase',
                      letterSpacing: '1.5px',
                      transition: 'color 0.2s ease',
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
                      fontWeight: 500,
                      cursor: 'pointer',
                      padding: 0,
                      transition: 'opacity 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.75')}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                  >
                    Esqueceu a senha?
                  </button>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    border: `1px solid ${passwordFocused ? RR_RED : t.border}`,
                    borderRadius: '10px',
                    padding: '13px 16px',
                    background: passwordFocused
                      ? 'rgba(215,25,32,0.03)'
                      : mode === 'dark'
                      ? 'rgba(255,255,255,0.03)'
                      : 'rgba(0,0,0,0.02)',
                    transition: 'all 0.2s ease',
                    boxShadow: passwordFocused ? '0 0 0 3px rgba(215,25,32,0.08)' : 'none',
                  }}
                >
                  <Lock size={16} color={passwordFocused ? RR_RED : t.textMuted} style={{ transition: 'color 0.2s' }} />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => setPasswordFocused(false)}
                    placeholder="••••••••••••"
                    required
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
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Remember me — Custom checkbox RR Mind */}
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  marginBottom: '28px',
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
                    width: '18px',
                    height: '18px',
                    borderRadius: '5px',
                    border: `1.5px solid ${rememberMe ? RR_RED : t.border}`,
                    background: rememberMe ? RR_RED : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease',
                    flexShrink: 0,
                  }}
                >
                  {rememberMe && (
                    <Check
                      size={11}
                      color="#fff"
                      strokeWidth={3}
                      style={{ animation: 'rr-checkIn 0.2s ease' }}
                    />
                  )}
                </div>
                <span style={{ fontSize: '13px', color: t.textSecondary }}>
                  Lembrar meu acesso neste navegador
                </span>
              </label>

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading || submitting}
                style={{
                  width: '100%',
                  padding: '14px 24px',
                  borderRadius: '10px',
                  border: 'none',
                  background: RR_RED,
                  color: '#FFFFFF',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: isLoading || submitting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 8px 24px rgba(215,25,32,0.28)',
                  opacity: isLoading || submitting ? 0.75 : 1,
                  position: 'relative',
                  overflow: 'hidden',
                  fontFamily: "'Space Grotesk', 'Inter', sans-serif",
                  letterSpacing: '0.3px',
                }}
                onMouseEnter={(e) => {
                  if (!isLoading) {
                    e.currentTarget.style.background = RR_RED_DARK;
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 12px 32px rgba(215,25,32,0.4)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = RR_RED;
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(215,25,32,0.28)';
                }}
              >
                {isLoading || submitting ? (
                  <>
                    <span
                      style={{
                        width: '16px',
                        height: '16px',
                        border: '2px solid rgba(255,255,255,0.3)',
                        borderTopColor: '#fff',
                        borderRadius: '50%',
                        animation: 'rr-spin 0.8s linear infinite',
                      }}
                    />
                    <span>Validando credenciais...</span>
                  </>
                ) : (
                  <>
                    <span>Acessar plataforma</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>

            {/* Footer */}
            <div
              style={{
                marginTop: '28px',
                paddingTop: '20px',
                borderTop: `1px solid ${t.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontSize: '11px',
                color: t.textMuted,
                textAlign: 'center',
                letterSpacing: '0.3px',
              }}
            >
              <ShieldCheck size={12} />
              <span>Autenticação com criptografia de ponta a ponta · RBAC estrito</span>
            </div>
          </div>

          {/* ============================================
              SIDE PANEL â€” QUICK LOGIN + HIERARQUIA
              ============================================ */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              animation: 'rr-fadeInUp 0.7s cubic-bezier(0.4,0,0.2,1) 0.1s both',
            }}
          >
            {/* Token JWT info */}
            <div
              style={{
                background: mode === 'dark' ? 'rgba(15,15,15,0.7)' : 'rgba(255,255,255,0.8)',
                backdropFilter: 'blur(30px)',
                WebkitBackdropFilter: 'blur(30px)',
                border: `1px solid ${t.border}`,
                borderRadius: '18px',
                padding: '28px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '11px', color: RR_RED, letterSpacing: '2px', fontWeight: 600 }}>02</span>
                <div style={{ width: '32px', height: '1px', background: RR_RED, opacity: 0.5 }} />
                <span style={{ fontSize: '10.5px', color: t.textMuted, textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 500 }}>Token JWT</span>
              </div>
              <h2 style={{ margin: '0 0 10px', fontSize: '17px', fontWeight: 700, color: t.text, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={16} color={RR_RED} />
                Acesso seguro
              </h2>
              <p style={{ margin: '0 0 14px', fontSize: '12.5px', color: t.textSecondary, lineHeight: 1.55 }}>
                O login cria um token JWT no backend. Todas as páginas enviam <strong>Authorization: Bearer</strong> nas chamadas <code>/api/*</code>.
              </p>
              <ul style={{ margin: 0, paddingLeft: 18, color: t.textSecondary, fontSize: 12.5, lineHeight: 1.7 }}>
                <li>Assinatura HS256 com expiração configurável</li>
                <li>Persistência em localStorage (lembrar) ou sessionStorage</li>
                <li>401 limpa a sessão e volta para o login</li>
                <li>Escopo RBAC aplicado no servidor por rota</li>
              </ul>
            </div>

            <div
              style={{
                background: mode === 'dark' ? 'rgba(15,15,15,0.7)' : 'rgba(255,255,255,0.8)',
                backdropFilter: 'blur(30px)',
                WebkitBackdropFilter: 'blur(30px)',
                border: `1px solid ${t.border}`,
                borderRadius: '18px',
                padding: '22px 28px',
              }}
            >
              <h3 style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: 600, color: t.text }}>Hierarquia de dados</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: t.textMuted, flexWrap: 'wrap' }}>
                {['EMPRESA', 'GERÊNCIA', 'SUPERVISÃO', 'VENDEDOR', 'CLIENTE'].map((level, idx, arr) => (
                  <React.Fragment key={level}>
                    <span style={{ color: idx === 0 ? RR_RED : t.textSecondary, fontWeight: idx === 0 ? 700 : 500, padding: '4px 8px', borderRadius: 5, background: idx === 0 ? 'rgba(215,25,32,0.08)' : 'transparent', border: idx === 0 ? '1px solid rgba(215,25,32,0.2)' : '1px solid transparent' }}>{level}</span>
                    {idx < arr.length - 1 && <span style={{ color: RR_RED, opacity: 0.5 }}>→</span>}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

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
              onMouseEnter={(e) => {
                e.currentTarget.style.background = mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
                e.currentTarget.style.color = t.text;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = t.textMuted;
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
                  InstruÃ§Ãµes enviadas
                </h3>
                <p
                  style={{
                    margin: '0 0 24px',
                    fontSize: '13.5px',
                    color: t.textSecondary,
                    lineHeight: 1.55,
                  }}
                >
                  Enviamos o link de recuperaÃ§Ã£o para{' '}
                  <strong style={{ color: t.text }}>{forgotEmail || email}</strong>. Verifique sua caixa de entrada e pasta de spam.
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
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    marginBottom: '14px',
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'Space Grotesk', sans-serif",
                      fontSize: '11px',
                      color: RR_RED,
                      letterSpacing: '2px',
                      fontWeight: 600,
                    }}
                  >
                    â†’
                  </span>
                  <span
                    style={{
                      fontSize: '10.5px',
                      color: t.textMuted,
                      textTransform: 'uppercase',
                      letterSpacing: '2px',
                      fontWeight: 500,
                    }}
                  >
                    RecuperaÃ§Ã£o
                  </span>
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
                  Informe seu e-mail cadastrado. Nossa equipe de seguranÃ§a enviarÃ¡ um token de redefiniÃ§Ã£o.
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
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = t.textSecondary;
                        e.currentTarget.style.color = t.text;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = t.border;
                        e.currentTarget.style.color = t.textSecondary;
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
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = RR_RED_DARK;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = RR_RED;
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
          STYLES & ANIMATIONS
          ============================================ */}
      <style>{`
        @keyframes rr-fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
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
        @media (max-width: 960px) {
          .rr-login-container {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
};
