/**
 * Semanas do ciclo comercial interno (Seção 8) — espelho exato de
 * `semana_comercial()` em `backend/app/routers/insights.py`.
 *
 * Referência combinada: a PRIMEIRA linha semanal exibida no calendário de
 * janeiro/2026 é a **Semana 3**. A semana vai de **domingo a sábado**, e
 * 01/01/2026 cai numa quinta — então essa linha começa em 28/12/2025. A partir
 * daí a sequência 1-2-3-4 se repete e **nunca reinicia** ao virar mês ou ano.
 *
 * (A âncora era 29/12/2025 quando a semana começava na segunda. Ao passar para
 * domingo ela recuou um dia, de propósito: assim janeiro/2026 continua abrindo
 * exatamente na Semana 3, que é a referência combinada.)
 *
 * Atenção: NÃO é a numeração ISO das semanas do ano. É o ciclo operacional de
 * quatro semanas usado pelo SAR.
 *
 * Todas as contas são feitas em horário LOCAL e ancoradas ao meio-dia: assim
 * nenhum fuso ou eventual horário de verão desloca a data em um dia.
 */

const ANCORA_SEMANA = 3;
const UM_DIA_MS = 86_400_000;

/** Date local no meio-dia — imune a deslocamento por fuso/DST. */
function meioDia(ano: number, mes0: number, dia: number): Date {
  return new Date(ano, mes0, dia, 12, 0, 0, 0);
}

function normalizar(data: Date): Date {
  return meioDia(data.getFullYear(), data.getMonth(), data.getDate());
}

function somarDias(data: Date, dias: number): Date {
  const saida = normalizar(data);
  saida.setDate(saida.getDate() + dias);
  return saida;
}

/** Domingo de referência do ciclo: 28/12/2025. */
const ANCORA = meioDia(2025, 11, 28);

/** Domingo que abre a semana daquela data (semana = domingo → sábado). */
export function domingoDaSemana(data: Date): Date {
  const base = normalizar(data);
  // getDay(): 0 = domingo, logo o próprio valor já é quanto recuar.
  return somarDias(base, -base.getDay());
}

/** @deprecated Nome antigo, de quando a semana começava na segunda. */
export const segundaDaSemana = domingoDaSemana;

/** Número da semana (1..4) no ciclo comercial contínuo. */
export function semanaComercial(data: Date): number {
  const domingo = domingoDaSemana(data);
  const semanas = Math.round((domingo.getTime() - ANCORA.getTime()) / (7 * UM_DIA_MS));
  // `%` em JS mantém o sinal do dividendo: o +4 garante resultado positivo
  // também para datas anteriores à âncora (navegar para trás no calendário).
  return ((((semanas + ANCORA_SEMANA - 1) % 4) + 4) % 4) + 1;
}

export interface LinhaSemana {
  /** Domingo que abre a linha. */
  inicio: Date;
  /** Os 7 dias da linha (domingo → sábado). */
  dias: Date[];
  semana: number;
}

/**
 * Linhas semanais de um mês, como o calendário as exibe: sempre de domingo a
 * sábado, incluindo os dias vizinhos que completam a primeira e a última.
 */
export function linhasDoMes(ano: number, mes: number): LinhaSemana[] {
  const proximoMes = meioDia(mes === 12 ? ano + 1 : ano, mes === 12 ? 0 : mes, 1);
  let cursor = domingoDaSemana(meioDia(ano, mes - 1, 1));
  const linhas: LinhaSemana[] = [];

  while (cursor.getTime() < proximoMes.getTime()) {
    const dias = Array.from({ length: 7 }, (_, i) => somarDias(cursor, i));
    linhas.push({ inicio: cursor, dias, semana: semanaComercial(dias[0]) });
    cursor = somarDias(cursor, 7);
  }
  return linhas;
}

export const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

/** Cabeçalho das colunas, na ordem real da semana: domingo → sábado. */
export const DIAS_CURTOS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

/** Índices de `DIAS_CURTOS`/`getDay()` que são fim de semana. */
export const FIM_DE_SEMANA = [0, 6];

/** `2026-01-05` a partir de um Date, sem efeito de fuso. */
export function isoDia(data: Date): string {
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${data.getFullYear()}-${mes}-${dia}`;
}

/** Lê `2026-01-05` como data local (não como UTC, que recuaria um dia). */
export function dataDeIso(iso: string): Date {
  const [ano, mes, dia] = iso.slice(0, 10).split('-').map(Number);
  return meioDia(ano, (mes || 1) - 1, dia || 1);
}

export function mesmoDia(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  );
}
