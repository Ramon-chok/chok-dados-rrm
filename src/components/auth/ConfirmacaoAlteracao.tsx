/**
 * Diálogo de confirmação de alteração.
 *
 * O perfil **Administrador** altera dados mediante confirmação: o servidor
 * recusa a gravação (428) enquanto não receber o cabeçalho de confirmação.
 * Em vez de cada tela tratar isso, a camada de rede chama este diálogo e, se
 * a pessoa confirmar, repete a mesma requisição confirmada.
 *
 * Duas coisas que este componente NÃO é:
 *
 * * Não é uma trava de segurança. A trava é o servidor, que simplesmente não
 *   grava sem o cabeçalho. Isto é a confirmação de INTENÇÃO, para que uma
 *   alteração não aconteça por um clique sem querer.
 * * Não é uma segunda autenticação. Quem chega aqui já entrou e já tem a
 *   permissão; o diálogo não pede senha nem token.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ShieldCheck, X } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { setConfirmador } from '../../lib/api';

interface Pedido {
  metodo: string;
  caminho: string;
  resolver: (confirmado: boolean) => void;
}

/** Descreve a operação em português, a partir do método e da rota. */
function descrever(metodo: string, caminho: string): { acao: string; alvo: string } {
  const verbo =
    metodo === 'DELETE' ? 'Excluir' : metodo === 'POST' ? 'Criar' : 'Alterar';

  const alvos: Array<[RegExp, string]> = [
    [/^\/users/, 'um usuário do sistema'],
    [/^\/imports\/history/, 'o histórico de importações'],
    [/^\/imports/, 'uma importação de dados'],
    [/^\/insights\/visual\/metas/, 'uma meta de fabricante'],
    [/^\/insights\/visual\/produtos-foco/, 'um produto foco'],
    [/^\/insights\/calendario/, 'um evento do calendário comercial'],
    [/^\/purchasing\/suppliers/, 'um fornecedor'],
    [/^\/purchasing\/negotiations/, 'uma negociação de compra'],
    [/^\/acessos\/liberacoes/, 'uma liberação de alteração'],
  ];
  const achado = alvos.find(([re]) => re.test(caminho));
  return { acao: verbo, alvo: achado ? achado[1] : 'um registro do sistema' };
}

export const ConfirmacaoAlteracao: React.FC = () => {
  const { t } = useTheme();
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const botaoRef = useRef<HTMLButtonElement>(null);

  // Registra o confirmador na camada de rede uma única vez.
  useEffect(() => {
    setConfirmador(
      ({ metodo, caminho }) =>
        new Promise<boolean>((resolver) => {
          setPedido({ metodo, caminho, resolver });
        })
    );
    return () => setConfirmador(null);
  }, []);

  const responder = useCallback(
    (confirmado: boolean) => {
      setPedido((atual) => {
        atual?.resolver(confirmado);
        return null;
      });
    },
    []
  );

  // Esc recusa: a saída fácil é a que NÃO altera nada.
  useEffect(() => {
    if (!pedido) return;
    botaoRef.current?.focus();
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') responder(false);
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [pedido, responder]);

  if (!pedido) return null;
  const { acao, alvo } = descrever(pedido.metodo, pedido.caminho);

  return (
    <div
      role="presentation"
      onClick={() => responder(false)}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: 'rgba(3, 7, 14, 0.62)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmar-titulo"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 440,
          background: t.surface,
          border: `1px solid ${t.border}`,
          borderRadius: 'var(--ga-radius)',
          boxShadow: t.shadow,
          padding: '22px 24px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: `${t.primary}1F`,
              border: `1px solid ${t.primary}4D`,
              color: t.primary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <ShieldCheck size={19} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2
              id="confirmar-titulo"
              style={{
                margin: 0,
                fontFamily: 'var(--ga-display)',
                fontSize: 17,
                fontWeight: 700,
                color: t.text,
                letterSpacing: '-0.02em',
              }}
            >
              Confirmar alteração
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 12.5, color: t.textSecondary, lineHeight: 1.55 }}>
              Seu perfil aplica alterações mediante confirmação.
            </p>
          </div>
          <button
            type="button"
            onClick={() => responder(false)}
            aria-label="Fechar sem alterar"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted, padding: 2 }}
          >
            <X size={17} />
          </button>
        </div>

        <div
          style={{
            background: t.bgSecondary,
            border: `1px solid ${t.border}`,
            borderRadius: 10,
            padding: '12px 14px',
            fontSize: 13.5,
            color: t.text,
            lineHeight: 1.6,
            marginBottom: 18,
          }}
        >
          <strong style={{ color: t.primary }}>{acao}</strong> {alvo}.
          <div style={{ marginTop: 6, fontSize: 11.5, color: t.textMuted }}>
            A alteração só é gravada depois que você confirmar aqui.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button
            ref={botaoRef}
            type="button"
            onClick={() => responder(false)}
            style={{
              padding: '9px 16px',
              borderRadius: 8,
              border: `1px solid ${t.border}`,
              background: t.surfaceElevated,
              color: t.textSecondary,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => responder(true)}
            style={{
              padding: '9px 18px',
              borderRadius: 8,
              border: 'none',
              background: t.primary,
              color: t.primaryForeground,
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Confirmar e aplicar
          </button>
        </div>
      </div>
    </div>
  );
};
