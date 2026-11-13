import React, { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Painel lateral de detalhe (drawer).
 *
 * É a casca única das fichas — cliente, produto, o que vier a seguir. Uma só
 * casca garante que abrir qualquer detalhe tenha o mesmo gesto em toda a
 * plataforma:
 *
 *   • no computador, desliza da direita por cima do conteúdo e deixa a tela
 *     de origem visível atrás (quem clicou na linha não perde a tabela);
 *   • no celular, sobe de baixo como uma folha e ocupa a tela inteira, com
 *     puxador no topo — o gesto que o telefone já ensina.
 *
 * Esc fecha, clicar fora fecha, e a página de trás não rola enquanto o
 * painel está aberto. O cabeçalho usa a faixa da marca; o corpo rola sozinho.
 * Os estilos estão em index.css, bloco "Painel lateral".
 */
export interface PainelLateralProps {
  aberto: boolean;
  onClose: () => void;
  /** Conteúdo do cabeçalho (título, subtítulo, ações). Já vem claro sobre azul. */
  cabecalho: React.ReactNode;
  /** Rótulo acessível do diálogo. */
  rotulo: string;
  /** Painel mais largo (820px) para fichas com tabelas de várias colunas. */
  largo?: boolean;
  children: React.ReactNode;
}

export const PainelLateral: React.FC<PainelLateralProps> = ({
  aberto,
  onClose,
  cabecalho,
  rotulo,
  largo,
  children,
}) => {
  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', aoTeclar);
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      document.body.style.overflow = overflowAnterior;
    };
  }, [aberto, onClose]);

  if (!aberto) return null;

  return (
    <>
      <div className="painel-fundo" onClick={onClose} aria-hidden="true" />
      <aside
        className={`painel-lateral${largo ? ' painel-lateral--largo' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={rotulo}
      >
        {/* Cabeçalho na faixa da marca: assinatura do grupo em todo detalhe. */}
        <div className="faixa-marca" style={{ position: 'relative', padding: '0 18px 16px', flexShrink: 0 }}>
          <div className="painel-lateral__puxador" aria-hidden="true" />
          <span className="faixa-marca__mascara" aria-hidden="true">
            <img src="/img/marca/simbolo-branco.svg" alt="" className="faixa-marca__simbolo" />
          </span>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, paddingTop: 16 }}>
            <div style={{ minWidth: 0, flex: 1 }}>{cabecalho}</div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="faixa-botao"
              style={{ width: 32, height: 32 }}
            >
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="painel-lateral__corpo">{children}</div>
      </aside>
    </>
  );
};
