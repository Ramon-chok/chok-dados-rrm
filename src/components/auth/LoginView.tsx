import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { RoleBadge } from './RoleBadge';
import { Mail, Lock, Eye, EyeOff, ArrowRight, ShieldCheck, Sun, Moon, CheckCircle2, AlertCircle, Sparkles, X } from 'lucide-react';
import { Role } from '../../types';

export const LoginView: React.FC = () => {
  const { login, isLoading, availableUsers, switchUser } = useAuth();
  const { mode, toggleTheme, t } = useTheme();

  const [email, setEmail] = useState('ramon21.empresa@gmail.com');
  const [password, setPassword] = useState('••••••••••••');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Forgot password modal state
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSubmitted, setForgotSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim()) {
      setErrorMessage('Por favor, informe seu e-mail corporativo.');
      return;
    }

    const res = await login(email, password, rememberMe);
    if (!res.success) {
      setErrorMessage(res.error || 'Falha ao autenticar.');
    }
  };

  const handleQuickLogin = async (userEmail: string, userId: string) => {
    setEmail(userEmail);
    setPassword('••••••••••••');
    setErrorMessage(null);
    switchUser(userId);
  };

  const handleForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    setForgotSubmitted(true);
    setTimeout(() => {
      // keep message shown
    }, 500);
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
      }}
    >
      {/* Subtle geometric background grid lines */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: mode === 'dark' ? 0.05 : 0.03,
          backgroundImage: `linear-gradient(${t.text} 1px, transparent 1px), linear-gradient(90deg, ${t.text} 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
          pointerEvents: 'none',
        }}
      />

      {/* Top Header bar with Theme toggle and system status */}
      <header
        style={{
          height: '64px',
          borderBottom: `1px solid ${t.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 28px',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <svg width="26" height="26" viewBox="0 0 26 26">
            <path d="M13 1 L25 7 L25 19 L13 25 L1 19 L1 7 Z" fill="none" stroke={t.primary} strokeWidth="1.8" />
            <path d="M13 1 V25 M1 7 L25 19 M25 7 L1 19" stroke={t.primary} strokeWidth="1.1" opacity="0.4" />
          </svg>
          <span className="num" style={{ fontSize: '19px', fontWeight: 700, letterSpacing: '-0.02em', color: t.text }}>
            Chok
          </span>
          <span
            style={{
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: '4px',
              background: t.surfaceElevated,
              border: `1px solid ${t.border}`,
              color: t.textMuted,
              fontWeight: 500,
              marginLeft: '6px',
            }}
          >
            v2.0 Enterprise
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12.5px',
              color: t.textSecondary,
              padding: '4px 10px',
              borderRadius: '6px',
              background: t.surface,
              border: `1px solid ${t.border}`,
            }}
          >
            <ShieldCheck size={14} color="#3DD68C" />
            <span>RBAC 25 Permissões</span>
          </div>

          <button
            onClick={toggleTheme}
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              border: `1px solid ${t.border}`,
              background: t.surface,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: t.textSecondary,
              transition: 'border-color 0.15s ease',
            }}
            aria-label="Alternar modo claro/escuro"
            title={mode === 'dark' ? 'Alternar para Modo Claro' : 'Alternar para Modo Escuro'}
          >
            {mode === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
      </header>

      {/* Main Login Area */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 20px',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '1080px',
            display: 'grid',
            gridTemplateColumns: 'minmax(320px, 460px) 1fr',
            gap: '36px',
            alignItems: 'start',
          }}
          className="login-container"
        >
          {/* Card Principal de Autenticação */}
          <div
            style={{
              background: t.surface,
              border: `1px solid ${t.border}`,
              borderRadius: '16px',
              padding: '36px 32px',
              boxShadow: mode === 'dark' ? '0 12px 36px rgba(0, 0, 0, 0.45)' : '0 10px 30px rgba(0, 0, 0, 0.06)',
            }}
          >
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: 'rgba(227, 6, 19, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 26 26">
                    <path d="M13 1 L25 7 L25 19 L13 25 L1 19 L1 7 Z" fill="none" stroke={t.primary} strokeWidth="2" />
                    <path d="M13 1 V25 M1 7 L25 19 M25 7 L1 19" stroke={t.primary} strokeWidth="1.2" opacity="0.4" />
                  </svg>
                </div>
                <span style={{ fontSize: '13px', fontWeight: 600, color: t.primary, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Acesso Seguro
                </span>
              </div>

              <h1 style={{ margin: '0 0 6px', fontSize: '24px', fontWeight: 700, color: t.text, letterSpacing: '-0.02em' }}>
                Entrar na Plataforma
              </h1>
              <p style={{ margin: 0, fontSize: '13.5px', color: t.textSecondary, lineHeight: 1.5 }}>
                Central de Inteligência de Dados, Negócios e Gestão Comercial.
              </p>
            </div>

            {/* Error Alert */}
            {errorMessage && (
              <div
                style={{
                  background: 'rgba(227, 6, 19, 0.1)',
                  border: `1px solid rgba(227, 6, 19, 0.35)`,
                  borderRadius: '8px',
                  padding: '12px 14px',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  fontSize: '13px',
                  color: t.primaryHover,
                }}
              >
                <AlertCircle size={17} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span style={{ lineHeight: 1.4 }}>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* Email field */}
              <div style={{ marginBottom: '18px' }}>
                <label
                  htmlFor="email"
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: t.textSecondary,
                    marginBottom: '7px',
                  }}
                >
                  E-mail Corporativo
                </label>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    border: `1px solid ${t.border}`,
                    borderRadius: '8px',
                    padding: '10px 14px',
                    background: t.bgSecondary,
                    transition: 'border-color 0.15s ease',
                  }}
                >
                  <Mail size={16} color={t.textMuted} />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
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

              {/* Password field */}
              <div style={{ marginBottom: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '7px' }}>
                  <label
                    htmlFor="password"
                    style={{
                      fontSize: '13px',
                      fontWeight: 500,
                      color: t.textSecondary,
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
                      color: t.primary,
                      fontSize: '12.5px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    Esqueceu a senha?
                  </button>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    border: `1px solid ${t.border}`,
                    borderRadius: '8px',
                    padding: '10px 14px',
                    background: t.bgSecondary,
                    transition: 'border-color 0.15s ease',
                  }}
                >
                  <Lock size={16} color={t.textMuted} />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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
                    }}
                    title={showPassword ? 'Ocultar senha' : 'Ver senha'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Remember me */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '24px',
                }}
              >
                <input
                  id="rememberMe"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  style={{
                    width: '16px',
                    height: '16px',
                    accentColor: t.primary,
                    cursor: 'pointer',
                  }}
                />
                <label
                  htmlFor="rememberMe"
                  style={{
                    fontSize: '13px',
                    color: t.textSecondary,
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                >
                  Lembrar meu acesso neste navegador
                </label>
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={isLoading}
                style={{
                  width: '100%',
                  padding: '12px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  background: t.primary,
                  color: '#FFFFFF',
                  fontSize: '14.5px',
                  fontWeight: 600,
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'background 0.15s ease, transform 0.1s ease',
                  boxShadow: '0 4px 14px rgba(227, 6, 19, 0.35)',
                  opacity: isLoading ? 0.7 : 1,
                }}
              >
                {isLoading ? (
                  <span>Validando credenciais corporativas...</span>
                ) : (
                  <>
                    <span>Acessar Plataforma</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>

            <div style={{ marginTop: '24px', paddingTop: '18px', borderTop: `1px solid ${t.border}`, fontSize: '11.5px', color: t.textMuted, textAlign: 'center' }}>
              Autenticação corporativa com criptografia de ponta a ponta e controle RBAC estrito.
            </div>
          </div>

          {/* Painel Lateral: Perfis de Teste do PRD & Arquitetura Hierárquica */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
            }}
          >
            {/* Box explicativo dos 6 perfis definidos no PRD */}
            <div
              style={{
                background: t.surface,
                border: `1px solid ${t.border}`,
                borderRadius: '16px',
                padding: '24px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles size={16} color={t.primary} />
                  <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: t.text }}>
                    Perfis de Acesso (PRD Seção 5)
                  </h2>
                </div>
                <span style={{ fontSize: '11.5px', color: t.textMuted }}>Clique para testar</span>
              </div>

              <p style={{ margin: '0 0 16px', fontSize: '12.5px', color: t.textSecondary, lineHeight: 1.45 }}>
                A plataforma possui 6 perfis com escopos de dados hierárquicos e permissões diferenciadas. Clique em qualquer perfil abaixo para autenticar instantaneamente:
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {availableUsers.map((u) => {
                  const isSelected = email.toLowerCase() === u.email.toLowerCase();
                  return (
                    <div
                      key={u.id}
                      onClick={() => handleQuickLogin(u.email, u.id)}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '10px',
                        background: isSelected ? t.surfaceElevated : t.bgSecondary,
                        border: `1px solid ${isSelected ? t.primary : t.border}`,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            width: '34px',
                            height: '34px',
                            borderRadius: '50%',
                            background: isSelected ? t.primary : t.surface,
                            border: `1px solid ${isSelected ? t.primary : t.border}`,
                            color: isSelected ? '#fff' : t.textSecondary,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '12.5px',
                            fontWeight: 600,
                            flexShrink: 0,
                          }}
                        >
                          {u.avatarInitials}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                            <span style={{ fontSize: '13.5px', fontWeight: 600, color: t.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {u.name}
                            </span>
                            <RoleBadge role={u.role as Role} size="sm" />
                          </div>
                          <div style={{ fontSize: '11.5px', color: t.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {u.scope.description}
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          fontSize: '12px',
                          fontWeight: 600,
                          color: isSelected ? t.primary : t.textMuted,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {isSelected ? 'Conectado ›' : 'Acessar ›'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Princípio Fundamental da Hierarquia */}
            <div
              style={{
                background: t.surface,
                border: `1px solid ${t.border}`,
                borderRadius: '16px',
                padding: '20px 24px',
              }}
            >
              <h3 style={{ margin: '0 0 8px', fontSize: '13.5px', fontWeight: 600, color: t.text }}>
                Estrutura de Dados e Escopo (PRD Seção 2 & 6)
              </h3>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '11.5px',
                  color: t.textMuted,
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ color: t.primary, fontWeight: 600 }}>EMPRESA</span>
                <span>→</span>
                <span>GERÊNCIA</span>
                <span>→</span>
                <span>SUPERVISÃO</span>
                <span>→</span>
                <span>VENDEDOR</span>
                <span>→</span>
                <span>CLIENTE</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Forgot Password Modal */}
      {isForgotModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={() => setIsForgotModalOpen(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '440px',
              background: t.surface,
              border: `1px solid ${t.border}`,
              borderRadius: '14px',
              padding: '28px',
              position: 'relative',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
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
                top: '16px',
                right: '16px',
                background: 'transparent',
                border: 'none',
                color: t.textMuted,
                cursor: 'pointer',
                padding: '4px',
              }}
            >
              <X size={18} />
            </button>

            {forgotSubmitted ? (
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: 'rgba(61, 214, 140, 0.15)',
                    border: '1px solid rgba(61, 214, 140, 0.3)',
                    color: '#3DD68C',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px',
                  }}
                >
                  <CheckCircle2 size={26} />
                </div>
                <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 600, color: t.text }}>
                  Instruções Enviadas!
                </h3>
                <p style={{ margin: '0 0 20px', fontSize: '13.5px', color: t.textSecondary, lineHeight: 1.5 }}>
                  Enviamos o link de recuperação para <strong>{forgotEmail || email}</strong>. Verifique sua caixa de entrada e pasta de spam corporativa.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotModalOpen(false);
                    setForgotSubmitted(false);
                  }}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    background: t.primary,
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: '13.5px',
                    cursor: 'pointer',
                  }}
                >
                  Retornar ao Login
                </button>
              </div>
            ) : (
              <div>
                <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 600, color: t.text }}>
                  Recuperar Senha Corporativa
                </h3>
                <p style={{ margin: '0 0 20px', fontSize: '13.5px', color: t.textSecondary, lineHeight: 1.5 }}>
                  Informe seu e-mail cadastrado. Nossa equipe de segurança enviará um token de redefinição de acesso.
                </p>

                <form onSubmit={handleForgotSubmit}>
                  <div style={{ marginBottom: '18px' }}>
                    <label style={{ display: 'block', fontSize: '12.5px', color: t.textSecondary, marginBottom: '6px' }}>
                      E-mail Corporativo
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
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: `1px solid ${t.border}`,
                        background: t.bgSecondary,
                        color: t.text,
                        fontSize: '13.5px',
                        fontFamily: "'Inter', sans-serif",
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={() => setIsForgotModalOpen(false)}
                      style={{
                        padding: '9px 16px',
                        borderRadius: '8px',
                        border: `1px solid ${t.border}`,
                        background: 'transparent',
                        color: t.textSecondary,
                        fontSize: '13.5px',
                        cursor: 'pointer',
                      }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      style={{
                        padding: '9px 18px',
                        borderRadius: '8px',
                        border: 'none',
                        background: t.primary,
                        color: '#FFFFFF',
                        fontSize: '13.5px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Enviar Link de Redefinição
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 860px) {
          .login-container {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
};
