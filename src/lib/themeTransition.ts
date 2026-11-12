/**
 * Animação da troca de tema (escuro ↔ claro).
 *
 * O efeito é um círculo que nasce no próprio botão clicado e se abre até cobrir
 * a tela, revelando o tema novo por baixo — por isso a troca parece sair da mão
 * do usuário, e não "piscar" a página inteira.
 *
 * Dois caminhos, porque a View Transitions API ainda não está em todo navegador:
 *
 * 1. **Com `document.startViewTransition`** (Chrome/Edge atuais): o navegador
 *    tira um retrato da tela antes e depois da troca e nós animamos o
 *    `clip-path` do retrato NOVO. O conteúdo real é revelado, sem cobrir nada.
 * 2. **Sem ela** (Firefox/Safari mais antigos): uma camada temporária na cor de
 *    fundo do tema novo se abre em círculo, a troca acontece atrás dela e a
 *    camada some. Mesma leitura visual, sem depender da API.
 *
 * Quem pediu "menos animação" no sistema operacional (`prefers-reduced-motion`)
 * recebe a troca direta, sem efeito nenhum.
 */

export interface OrigemAnimacao {
  /** Coordenadas na viewport de onde o círculo nasce (centro do botão). */
  x: number;
  y: number;
}

const DURACAO_MS = 520;
const SUAVIZACAO = 'cubic-bezier(0.4, 0, 0.2, 1)';

/** Raio necessário para o círculo cobrir a tela inteira a partir de (x, y). */
function raioMaximo(x: number, y: number): number {
  return Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
}

function prefereMenosMovimento(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * Executa `aplicar()` (a troca de tema em si) acompanhada da animação.
 *
 * `aplicar` é sempre chamada exatamente uma vez, mesmo que a animação falhe —
 * o tema nunca fica preso no estado anterior por causa do efeito.
 */
export function animarTrocaDeTema(
  aplicar: () => void,
  origem: OrigemAnimacao | undefined,
  corDeFundoDestino: string
): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    aplicar();
    return;
  }
  if (prefereMenosMovimento()) {
    aplicar();
    return;
  }

  // Sem origem conhecida (ex.: troca pelo teclado), nasce no canto superior
  // direito, que é onde o botão de tema costuma estar.
  const x = origem?.x ?? window.innerWidth - 48;
  const y = origem?.y ?? 48;
  const raio = raioMaximo(x, y);

  const doc = document as Document & {
    startViewTransition?: (cb: () => void) => { ready: Promise<void>; finished: Promise<void> };
  };

  if (typeof doc.startViewTransition === 'function') {
    const transicao = doc.startViewTransition(() => {
      aplicar();
    });
    transicao.ready
      .then(() => {
        document.documentElement.animate(
          {
            clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${raio}px at ${x}px ${y}px)`],
          },
          {
            duration: DURACAO_MS,
            easing: SUAVIZACAO,
            // Anima o retrato NOVO: o tema que está chegando é o que se abre.
            pseudoElement: '::view-transition-new(root)',
          }
        );
      })
      .catch(() => {
        /* a troca já aconteceu dentro do callback; só o efeito se perdeu */
      });
    return;
  }

  // ── Alternativa sem View Transitions ────────────────────────────────────
  const camada = document.createElement('div');
  camada.setAttribute('aria-hidden', 'true');
  Object.assign(camada.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '2147483646',
    pointerEvents: 'none',
    background: corDeFundoDestino,
    clipPath: `circle(0px at ${x}px ${y}px)`,
    willChange: 'clip-path, opacity',
  } as Partial<CSSStyleDeclaration>);
  document.body.appendChild(camada);

  let jaAplicado = false;
  const aplicarUmaVez = () => {
    if (jaAplicado) return;
    jaAplicado = true;
    aplicar();
  };
  const remover = () => {
    aplicarUmaVez();
    camada.remove();
  };

  try {
    const abertura = camada.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${raio}px at ${x}px ${y}px)`] },
      { duration: DURACAO_MS, easing: SUAVIZACAO, fill: 'forwards' }
    );
    abertura.onfinish = () => {
      // Troca o tema com a tela já coberta e revela desvanecendo a camada.
      aplicarUmaVez();
      const saida = camada.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 260,
        easing: 'ease-out',
        fill: 'forwards',
      });
      saida.onfinish = remover;
      saida.oncancel = remover;
    };
    abertura.oncancel = remover;
    // Rede de segurança: se nenhum evento disparar, não deixa a camada presa.
    window.setTimeout(remover, DURACAO_MS + 600);
  } catch {
    remover();
  }
}
