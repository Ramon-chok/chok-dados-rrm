/**
 * Feriados brasileiros para o calendário comercial.
 *
 * Calculados localmente, sem depender de API externa: o calendário precisa
 * funcionar para qualquer mês/ano que o usuário navegar, inclusive offline.
 *
 * Dois tipos, porque a diferença muda a operação:
 *
 * * **nacional** — feriado por lei federal: não se trabalha, não há venda.
 * * **facultativo** — ponto facultativo de âmbito federal (Carnaval, Quarta-feira
 *   de Cinzas, Corpus Christi). Muitas empresas trabalham; por isso aparece com
 *   marcação mais discreta, e não como feriado fechado.
 *
 * Feriados estaduais e municipais variam por cidade e **não** estão aqui. Para
 * incluir os da operação, acrescente as datas em `FERIADOS_REGIONAIS`.
 */

export type TipoFeriado = 'nacional' | 'facultativo' | 'regional';

export interface Feriado {
  /** `2026-01-01` */
  data: string;
  nome: string;
  tipo: TipoFeriado;
}

/** Feriados nacionais de data fixa (mês 1-12, dia). */
const FIXOS: Array<{ mes: number; dia: number; nome: string }> = [
  { mes: 1, dia: 1, nome: 'Confraternização Universal' },
  { mes: 4, dia: 21, nome: 'Tiradentes' },
  { mes: 5, dia: 1, nome: 'Dia do Trabalho' },
  { mes: 9, dia: 7, nome: 'Independência do Brasil' },
  { mes: 10, dia: 12, nome: 'Nossa Senhora Aparecida' },
  { mes: 11, dia: 2, nome: 'Finados' },
  { mes: 11, dia: 15, nome: 'Proclamação da República' },
  // Feriado nacional desde a Lei 14.759/2023.
  { mes: 11, dia: 20, nome: 'Consciência Negra' },
  { mes: 12, dia: 25, nome: 'Natal' },
];

/**
 * Datas específicas da operação (estaduais/municipais). Deixe no formato
 * `'AAAA-MM-DD'`; elas aparecem no calendário como "regional".
 *
 * Exemplo para Franca/SP:
 *   { data: '2026-07-28', nome: 'Aniversário de Franca', tipo: 'regional' },
 */
export const FERIADOS_REGIONAIS: Feriado[] = [];

/**
 * Domingo de Páscoa pelo algoritmo de Gauss/Meeus (calendário gregoriano).
 * Dele saem Carnaval, Cinzas, Sexta-feira Santa e Corpus Christi.
 */
function domingoDePascoa(ano: number): Date {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31); // 3 = março, 4 = abril
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  // Meio-dia: evita que fuso/horário de verão desloque a data em um dia.
  return new Date(ano, mes - 1, dia, 12, 0, 0, 0);
}

function iso(data: Date): string {
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${data.getFullYear()}-${mes}-${dia}`;
}

function somarDias(data: Date, dias: number): Date {
  const saida = new Date(data);
  saida.setDate(saida.getDate() + dias);
  return saida;
}

const cache = new Map<number, Map<string, Feriado>>();

/** Todos os feriados do ano, indexados por data (`AAAA-MM-DD`). */
export function feriadosDoAno(ano: number): Map<string, Feriado> {
  const emCache = cache.get(ano);
  if (emCache) return emCache;

  const mapa = new Map<string, Feriado>();
  const inserir = (f: Feriado) => {
    // Se duas regras caírem no mesmo dia, o nacional prevalece sobre o facultativo.
    const atual = mapa.get(f.data);
    if (atual && atual.tipo === 'nacional' && f.tipo !== 'nacional') return;
    mapa.set(f.data, f);
  };

  FIXOS.forEach(({ mes, dia, nome }) =>
    inserir({ data: iso(new Date(ano, mes - 1, dia, 12)), nome, tipo: 'nacional' })
  );

  const pascoa = domingoDePascoa(ano);
  inserir({ data: iso(somarDias(pascoa, -48)), nome: 'Carnaval', tipo: 'facultativo' });
  inserir({ data: iso(somarDias(pascoa, -47)), nome: 'Carnaval', tipo: 'facultativo' });
  inserir({ data: iso(somarDias(pascoa, -46)), nome: 'Quarta-feira de Cinzas', tipo: 'facultativo' });
  inserir({ data: iso(somarDias(pascoa, -2)), nome: 'Sexta-feira Santa', tipo: 'nacional' });
  inserir({ data: iso(pascoa), nome: 'Páscoa', tipo: 'facultativo' });
  inserir({ data: iso(somarDias(pascoa, 60)), nome: 'Corpus Christi', tipo: 'facultativo' });

  FERIADOS_REGIONAIS.filter((f) => f.data.startsWith(String(ano))).forEach(inserir);

  cache.set(ano, mapa);
  return mapa;
}

/** Feriado de uma data específica, ou `undefined`. */
export function feriadoDe(data: Date): Feriado | undefined {
  return feriadosDoAno(data.getFullYear()).get(iso(data));
}

/** Feriados que caem dentro do mês (ordenados por data). */
export function feriadosDoMes(ano: number, mes: number): Feriado[] {
  const prefixo = `${ano}-${String(mes).padStart(2, '0')}`;
  return [...feriadosDoAno(ano).values()]
    .filter((f) => f.data.startsWith(prefixo))
    .sort((a, b) => a.data.localeCompare(b.data));
}
