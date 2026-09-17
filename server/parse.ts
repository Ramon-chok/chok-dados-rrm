// Conversores tolerantes para valores que chegam de planilhas Excel já
// "achatadas" em JSON pelo frontend (xlsx). Nunca lançam para o chamador —
// devolvem { ok:false } para que a linha seja rejeitada com um motivo claro
// em vez de derrubar a importação inteira (regra 27 do PRD).

export type ParseResult<T> = { ok: true; value: T | null } | { ok: false; error: string };

export function parseNumeric(raw: unknown): ParseResult<number> {
  if (raw === undefined || raw === null || raw === '') return { ok: true, value: null };
  if (typeof raw === 'number') {
    if (Number.isNaN(raw)) return { ok: false, error: 'valor numérico inválido' };
    return { ok: true, value: raw };
  }
  const s = String(raw).trim();
  if (s === '') return { ok: true, value: null };
  // Aceita formato BR (1.234,56) e formato simples (1234.56)
  const normalized = /,\d{1,2}$/.test(s) ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  const n = Number(normalized.replace(/[R$\s%]/g, ''));
  if (Number.isNaN(n)) return { ok: false, error: `valor numérico inválido: "${raw}"` };
  return { ok: true, value: n };
}

export function parseInteger(raw: unknown): ParseResult<number> {
  const res = parseNumeric(raw);
  if (!res.ok) return res;
  if (res.value === null) return { ok: true, value: null };
  return { ok: true, value: Math.trunc(res.value) };
}

const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);

export function parseDateOnly(raw: unknown): ParseResult<string> {
  if (raw === undefined || raw === null || raw === '') return { ok: false, error: 'data ausente' };

  // Data serial do Excel (número de dias desde 30/12/1899)
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || raw <= 0) return { ok: false, error: `data inválida: "${raw}"` };
    const d = new Date(EXCEL_EPOCH_UTC + raw * 86400000);
    return { ok: true, value: d.toISOString().slice(0, 10) };
  }

  const s = String(raw).trim();
  if (s === '') return { ok: false, error: 'data ausente' };

  // YYYY-MM-DD (já ISO)
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return { ok: true, value: `${m[1]}-${m[2]}-${m[3]}` };

  // DD/MM/YYYY ou DD-MM-YYYY
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) {
    const [, dd, mm, yyyy] = m;
    return { ok: true, value: `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}` };
  }

  const asDate = new Date(s);
  if (!Number.isNaN(asDate.getTime())) return { ok: true, value: asDate.toISOString().slice(0, 10) };

  return { ok: false, error: `data inválida: "${raw}"` };
}

export function parseText(raw: unknown): ParseResult<string> {
  if (raw === undefined || raw === null) return { ok: true, value: null };
  const s = String(raw).trim();
  return { ok: true, value: s === '' ? null : s };
}

const TRUE_VALUES = new Set(['sim', 's', 'true', 'verdadeiro', '1', 'x', 'yes', 'y']);
const FALSE_VALUES = new Set(['nao', 'não', 'n', 'false', 'falso', '0', '', 'no']);

export function parseBoolean(raw: unknown): ParseResult<boolean> {
  if (raw === undefined || raw === null || raw === '') return { ok: true, value: false };
  if (typeof raw === 'boolean') return { ok: true, value: raw };
  if (typeof raw === 'number') return { ok: true, value: Boolean(raw) };
  const s = String(raw).trim().toLowerCase();
  if (TRUE_VALUES.has(s)) return { ok: true, value: true };
  if (FALSE_VALUES.has(s)) return { ok: true, value: false };
  return { ok: false, error: `valor booleano inválido: "${raw}" (use sim/não)` };
}

function formatHms(totalSeconds: number): string {
  const s = Math.round(totalSeconds);
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

/**
 * Hora-do-dia (ex.: horário de check-in) — aceita "HH:MM"/"HH:MM:SS" e a hora
 * serial do Excel (fração do dia: 0.5 = 12:00). Sempre normaliza para um
 * horário dentro de 24h, pois representa um instante do dia, não uma duração.
 */
export function parseTimeOfDay(raw: unknown): ParseResult<string> {
  if (raw === undefined || raw === null || raw === '') return { ok: true, value: null };

  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return { ok: false, error: `hora inválida: "${raw}"` };
    const frac = ((raw % 1) + 1) % 1; // usa só a parte fracionária (hora-do-dia)
    return { ok: true, value: formatHms(frac * 86400) };
  }

  const s = String(raw).trim();
  if (s === '') return { ok: true, value: null };
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (m) {
    const hh = Number(m[1]);
    const mm = Number(m[2]);
    const ss = m[3] ? Number(m[3]) : 0;
    if (hh > 23 || mm > 59 || ss > 59) return { ok: false, error: `hora inválida: "${raw}"` };
    return { ok: true, value: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}` };
  }
  return { ok: false, error: `hora inválida: "${raw}"` };
}

/**
 * Duração (ex.: tempo em campo) — mesmo formato "HH:MM[:SS]"/hora serial do
 * Excel, mas SEM normalizar para 24h: uma jornada pode ultrapassar meia-noite
 * quando somada (ex.: 26:15:00), por isso é gravada como texto, não TIME.
 */
export function parseDuration(raw: unknown): ParseResult<string> {
  if (raw === undefined || raw === null || raw === '') return { ok: true, value: null };

  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || raw < 0) return { ok: false, error: `duração inválida: "${raw}"` };
    return { ok: true, value: formatHms(raw * 86400) };
  }

  const s = String(raw).trim();
  if (s === '') return { ok: true, value: null };
  const m = s.match(/^(\d{1,3}):(\d{2})(?::(\d{2}))?$/);
  if (m) {
    const hh = Number(m[1]);
    const mm = Number(m[2]);
    const ss = m[3] ? Number(m[3]) : 0;
    if (mm > 59 || ss > 59) return { ok: false, error: `duração inválida: "${raw}"` };
    return { ok: true, value: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}` };
  }
  return { ok: false, error: `duração inválida: "${raw}"` };
}
