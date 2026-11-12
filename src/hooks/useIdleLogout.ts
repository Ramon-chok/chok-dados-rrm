import { useEffect, useRef, useState } from 'react';

/**
 * Seção 4 — desconexão automática por inatividade (AFK).
 *
 * Este hook é a parte visível da regra: ele desconecta a tela e mostra o aviso.
 * A regra **de verdade** é aplicada no servidor (`app/sessions.py` carimba
 * `ultimo_acesso` a cada requisição autenticada e devolve 401 depois de 40
 * minutos parados), então mexer no relógio do navegador, pausar o JavaScript ou
 * chamar a API direto não contorna nada — aqui o objetivo é não deixar a tela
 * aberta mostrando dados de quem já saiu.
 *
 * O que conta como atividade real: mouse, teclado, toque, rolagem e voltar o
 * foco para a aba. Movimento do mouse é amostrado (não reinicia o contador mais
 * de uma vez por segundo) para não virar um `setState` por pixel.
 */

/** Eventos que comprovam presença de alguém diante da tela. */
const EVENTOS: Array<keyof WindowEventMap> = [
  'mousedown',
  'mousemove',
  'keydown',
  'wheel',
  'touchstart',
  'touchmove',
  'scroll',
  'click',
];

export interface UseIdleLogoutOptions {
  /** Só vigia quando há alguém logado. */
  enabled: boolean;
  /** Janela de inatividade em ms (padrão 40 min, igual ao backend). */
  timeoutMs?: number;
  /** Quantos ms antes do fim o aviso deve aparecer (padrão 60 s). */
  warnBeforeMs?: number;
  /** Chamado quando a janela se esgota. */
  onIdle: () => void;
}

export interface UseIdleLogoutResult {
  /** `true` quando falta menos que `warnBeforeMs` — a tela pode avisar. */
  warning: boolean;
  /** Segundos restantes até a desconexão (só enquanto `warning`). */
  secondsLeft: number;
  /** Zera o contador (ex.: o usuário clicou em "continuar conectado"). */
  reset: () => void;
}

export const IDLE_TIMEOUT_MS = 40 * 60 * 1000;

export function useIdleLogout({
  enabled,
  timeoutMs = IDLE_TIMEOUT_MS,
  warnBeforeMs = 60_000,
  onIdle,
}: UseIdleLogoutOptions): UseIdleLogoutResult {
  const [warning, setWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const lastActivity = useRef<number>(Date.now());
  const disparado = useRef(false);
  // Guardado em ref para o efeito não reassinar os listeners a cada render.
  const onIdleRef = useRef(onIdle);
  onIdleRef.current = onIdle;

  const reset = () => {
    lastActivity.current = Date.now();
    disparado.current = false;
    setWarning(false);
    setSecondsLeft(0);
  };

  useEffect(() => {
    if (!enabled) {
      reset();
      return;
    }

    lastActivity.current = Date.now();
    disparado.current = false;
    let ultimoRegistro = 0;

    const registrar = () => {
      const agora = Date.now();
      // Amostragem: mousemove dispara dezenas de vezes por segundo.
      if (agora - ultimoRegistro < 1000) return;
      ultimoRegistro = agora;
      lastActivity.current = agora;
      if (disparado.current) return;
      setWarning((anterior) => (anterior ? false : anterior));
    };

    const aoVoltarFoco = () => {
      if (document.visibilityState === 'visible') registrar();
    };

    EVENTOS.forEach((evento) =>
      window.addEventListener(evento, registrar, { passive: true, capture: true })
    );
    document.addEventListener('visibilitychange', aoVoltarFoco);

    // Um único timer de 1s cuida do aviso e do disparo — nada de um timer por evento.
    const tick = window.setInterval(() => {
      const parado = Date.now() - lastActivity.current;
      const restante = timeoutMs - parado;

      if (restante <= 0) {
        if (!disparado.current) {
          disparado.current = true;
          setWarning(false);
          onIdleRef.current();
        }
        return;
      }
      if (restante <= warnBeforeMs) {
        setWarning(true);
        setSecondsLeft(Math.ceil(restante / 1000));
      } else {
        setWarning(false);
      }
    }, 1000);

    return () => {
      EVENTOS.forEach((evento) =>
        window.removeEventListener(evento, registrar, { capture: true } as EventListenerOptions)
      );
      document.removeEventListener('visibilitychange', aoVoltarFoco);
      window.clearInterval(tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, timeoutMs, warnBeforeMs]);

  return { warning, secondsLeft, reset };
}
