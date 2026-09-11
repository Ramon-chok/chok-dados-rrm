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
