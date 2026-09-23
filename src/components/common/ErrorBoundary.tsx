import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Mudar esta chave (ex.: página atual) limpa o erro e tenta renderizar de novo. */
  resetKey?: unknown;
  /** true = ocupa a tela inteira (erro fora do layout). */
  fullScreen?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Captura erros de renderização e mostra uma tela amigável — o texto/stack do
 * erro nunca é exibido ao usuário nem registrado no console do navegador.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  // O projeto não instala @types/react: declara os membros herdados usados aqui.
  declare props: Readonly<ErrorBoundaryProps>;
  declare setState: (state: ErrorBoundaryState) => void;
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidUpdate(prev: ErrorBoundaryProps) {
    if (this.state.hasError && prev.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return <ErrorFallback fullScreen={this.props.fullScreen} onRetry={() => this.setState({ hasError: false })} />;
  }
}

const ErrorFallback: React.FC<{ fullScreen?: boolean; onRetry: () => void }> = ({ fullScreen, onRetry }) => {
  const { t } = useTheme();
  return (
    <div
      role="alert"
      style={{
        minHeight: fullScreen ? '100vh' : undefined,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: fullScreen ? 16 : '40px 0',
        background: fullScreen ? t.bg : undefined,
      }}
    >
      <div
        style={{
          maxWidth: 460,
          width: '100%',
          background: t.surface,
          border: `1px solid ${t.border}`,
          borderRadius: 14,
          padding: '28px 24px',
          textAlign: 'center',
        }}
      >
        <AlertTriangle size={28} color={t.primary} style={{ marginBottom: 12 }} />
        <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: t.text }}>Algo não saiu como esperado</h2>
        <p style={{ margin: '0 0 20px', fontSize: 13.5, color: t.textSecondary, lineHeight: 1.5 }}>
          Não foi possível exibir esta tela. Tente novamente; se o problema continuar, recarregue a página.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={onRetry}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '9px 16px',
              borderRadius: 8,
              border: 'none',
              background: t.primary,
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <RotateCcw size={14} /> Tentar novamente
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '9px 16px',
              borderRadius: 8,
              border: `1px solid ${t.border}`,
              background: 'transparent',
              color: t.text,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Recarregar página
          </button>
        </div>
      </div>
    </div>
  );
};
