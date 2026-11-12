import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Search, X, Building2, Package, Factory, Tags, Receipt, Loader2 } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { getErrorMessage } from '../../lib/api';
import { BuscaGrupo, BuscaItem, BuscaTipo, fetchBusca } from '../../lib/insights';
import { PageId } from '../../types';

/**
 * Seção 7 — pesquisa inteligente.
 *
 * Abre pelo ícone de lupa no cabeçalho ou por Ctrl/⌘+K. Procura, de uma vez só,
 * cliente, código/CNPJ, produto/SKU, fabricante, categoria e pedido.
 *
 * As permissões são do SERVIDOR: `/insights/busca` já filtra pelo escopo de
 * quem pesquisa (vendedor vê a própria carteira, supervisor a da equipe), então
 * nada aqui precisa — nem conseguiria — esconder resultado que não deveria ter
 * chegado.
 */

const ICONES: Record<BuscaTipo, React.ReactNode> = {
  cliente: <Building2 size={14} />,
  produto: <Package size={14} />,
  fabricante: <Factory size={14} />,
  categoria: <Tags size={14} />,
  pedido: <Receipt size={14} />,
};

export interface GlobalSearchProps {
  /**
   * Navegação da aplicação. Hoje a pesquisa é só de consulta (ver `copiar`),
   * mas a prop segue no contrato para quando houver uma tela de destino.
   */
  onNavigate?: (pagina: PageId, contexto?: { fabricante?: string; categoria?: string }) => void;
}

export const GlobalSearch: React.FC<GlobalSearchProps> = () => {
  const { t } = useTheme();
  const [aberto, setAberto] = useState(false);
  const [termo, setTermo] = useState('');
  const [grupos, setGrupos] = useState<BuscaGrupo[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);
  const campo = useRef<HTMLInputElement | null>(null);

  const fechar = useCallback(() => {
    setAberto(false);
    setTermo('');
    setGrupos([]);
    setErro(null);
  }, []);

  // Atalho de teclado + Esc para fechar.
  useEffect(() => {
    const aoTeclar = (evento: KeyboardEvent) => {
      if ((evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === 'k') {
        evento.preventDefault();
        setAberto((anterior) => !anterior);
      }
      if (evento.key === 'Escape') fechar();
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [fechar]);

  useEffect(() => {
    if (aberto) requestAnimationFrame(() => campo.current?.focus());
  }, [aberto]);

  // Debounce: só consulta depois de 280 ms parado, para não disparar uma
  // requisição por tecla digitada.
  useEffect(() => {
    if (!aberto) return;
    const limpo = termo.trim();
    if (limpo.length < 2) {
      setGrupos([]);
      setCarregando(false);
      return;
    }
    let ativo = true;
    setCarregando(true);
    const timer = window.setTimeout(async () => {
      try {
        const resposta = await fetchBusca(limpo);
        if (ativo) {
          setGrupos(resposta.grupos);
          setErro(null);
        }
      } catch (e) {
        if (ativo) {
          setGrupos([]);
          setErro(getErrorMessage(e, 'Não foi possível pesquisar agora.'));
        }
      } finally {
        if (ativo) setCarregando(false);
      }
    }, 280);
    return () => {
      ativo = false;
      window.clearTimeout(timer);
    };
  }, [termo, aberto]);

  /**
   * A pesquisa hoje é de consulta: ela identifica o registro e mostra o que a
   * base sabe sobre ele. A tela de Desempenho por Fabricante foi retirada do
   * sistema, então não há mais para onde navegar a partir de um fabricante ou
   * de uma categoria — os resultados seguem informativos.
   *
   * Quando existir uma tela de destino, basta voltar a chamar `onNavigate`
   * aqui; a prop continua disponível para isso.
   */
  const copiar = (item: BuscaItem) => {
    const texto = [item.titulo, item.detalhe].filter(Boolean).join(' — ');
    try {
      void navigator.clipboard?.writeText(texto);
      setCopiado(item.id);
      window.setTimeout(() => setCopiado((atual) => (atual === item.id ? null : atual)), 1400);
    } catch {
      /* sem área de transferência disponível: o resultado continua visível */
    }
  };

  return (
    <>
      <button
        onClick={() => setAberto(true)}
        title="Pesquisar (Ctrl+K)"
        aria-label="Abrir pesquisa"
        style={{
          width: 34,
          height: 34,
          borderRadius: 8,
          border: `1px solid ${t.border}`,
          background: 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: t.textSecondary,
          flexShrink: 0,
        }}
      >
        <Search size={15} />
      </button>

      {aberto && (
        <div
          onClick={fechar}
          role="presentation"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(3, 7, 14, 0.66)',
            backdropFilter: 'blur(4px)',
            zIndex: 120,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            padding: '12vh 16px 16px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Pesquisa inteligente"
            className="ga-fade-in"
            style={{
              width: '100%',
              maxWidth: 620,
              background: t.surface,
              border: `1px solid ${t.border}`,
              borderRadius: 14,
              boxShadow: t.shadow,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '70vh',
            }}
          >
            <div className="ga-accent-bar" />
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '14px 16px',
                borderBottom: `1px solid ${t.border}`,
              }}
            >
              <Search size={17} color={t.accentTeal} />
              <input
                ref={campo}
                value={termo}
                onChange={(e) => setTermo(e.target.value)}
                placeholder="Cliente, CNPJ, SKU, fabricante, categoria ou pedido…"
                style={{
                  flex: 1,
                  minWidth: 0,
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  color: t.text,
                  fontSize: 15,
                }}
              />
              {carregando && <Loader2 size={15} color={t.textMuted} style={{ animation: 'rr-spin 0.8s linear infinite' }} />}
              <button
                onClick={fechar}
                aria-label="Fechar pesquisa"
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: t.textMuted,
                  cursor: 'pointer',
                  display: 'flex',
                  padding: 2,
                }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ overflowY: 'auto', padding: '8px 0' }}>
              {termo.trim().length < 2 && (
                <div style={{ padding: '18px 18px 22px', fontSize: 12.5, color: t.textMuted, lineHeight: 1.7 }}>
                  Digite ao menos 2 caracteres. Você pode cruzar informações: procure o cliente e,
                  no resultado, abra o fabricante para ver o que ele comprou e em que período.
                  <div style={{ marginTop: 10, fontSize: 11.5 }}>
                    Os resultados respeitam o seu perfil — você só encontra o que está no seu escopo.
                  </div>
                </div>
              )}

              {erro && <div style={{ padding: '14px 18px', fontSize: 12.5, color: t.danger }}>{erro}</div>}

              {!carregando && !erro && termo.trim().length >= 2 && grupos.length === 0 && (
                <div style={{ padding: '18px', fontSize: 12.5, color: t.textMuted }}>
                  Nada encontrado para “{termo.trim()}”.
                </div>
              )}

              {grupos.map((grupo) => (
                <div key={grupo.tipo} style={{ marginBottom: 6 }}>
                  <div
                    style={{
                      padding: '8px 18px 4px',
                      fontSize: 10.5,
                      fontWeight: 700,
                      letterSpacing: '0.07em',
                      textTransform: 'uppercase',
                      color: t.textMuted,
                    }}
                  >
                    {grupo.rotulo}
                  </div>
                  {grupo.itens.map((item) => {
                    const foiCopiado = copiado === item.id;
                    return (
                      <div
                        key={`${grupo.tipo}-${item.id}`}
                        onClick={() => copiar(item)}
                        role="button"
                        tabIndex={0}
                        title="Clique para copiar a referência"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            copiar(item);
                          }
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 11,
                          padding: '9px 18px',
                          cursor: 'pointer',
                          transition: 'background 0.14s ease',
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLDivElement).style.background = t.hover;
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                        }}
                      >
                        <span style={{ color: t.accentBlueLight, display: 'flex', flexShrink: 0 }}>
                          {ICONES[grupo.tipo]}
                        </span>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              fontSize: 13,
                              color: t.text,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {item.titulo}
                          </div>
                          {item.detalhe && (
                            <div
                              style={{
                                fontSize: 11,
                                color: t.textMuted,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {item.detalhe}
                            </div>
                          )}
                        </div>
                        {foiCopiado ? (
                          <span style={{ fontSize: 11, color: t.success, flexShrink: 0 }}>copiado</span>
                        ) : (
                          typeof item.valor === 'number' && (
                            <span className="num" style={{ fontSize: 12.5, color: t.text, flexShrink: 0 }}>
                              {`R$ ${item.valor.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`}
                            </span>
                          )
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
