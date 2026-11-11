/**
 * Geração de arquivos .xlsx no navegador.
 *
 * Antes isso vivia dentro do botão "Exportar Excel" que ficava em cada tela.
 * Os botões por tela saíram: a extração agora é centralizada em
 * "Dados e Exportações" (src/components/common/ExportCenter.tsx), e este
 * módulo guarda a parte mecânica — montar a planilha e baixar o arquivo.
 */
import * as XLSX from 'xlsx';

export interface ExcelSheetData {
  sheetName: string;
  data: Record<string, any>[];
}

/**
 * Neutraliza "injeção de fórmula" (CSV/Excel injection): texto vindo de cadastros ou
 * planilhas importadas que comece com = + - @ (ou TAB/CR) viraria fórmula ao abrir
 * o arquivo exportado. O apóstrofo inicial força o Excel a tratar como texto.
 */
const FORMULA_START = /^[=+\-@\t\r]/;

function neutralizeCell(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const clean = value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
  return FORMULA_START.test(clean) ? `'${clean}` : clean;
}

function neutralizeRows(rows: Record<string, any>[]): Record<string, any>[] {
  return rows.map((row) => {
    const out: Record<string, any> = {};
    Object.keys(row).forEach((k) => {
      out[String(neutralizeCell(k))] = neutralizeCell(row[k]);
    });
    return out;
  });
}

/** Nome de aba válido no Excel: até 31 caracteres e sem \ / ? * [ ] : */
function sanitizeSheetName(name: string, fallback: string): string {
  const clean = (name || fallback).replace(/[\\/?*[\]:]/g, ' ').trim().substring(0, 31);
  return clean || fallback;
}

/**
 * Monta a pasta de trabalho. Nomes de aba repetidos ganham sufixo numérico —
 * o Excel recusa o arquivo quando duas abas têm o mesmo nome, o que acontece
 * ao juntar telas diferentes no mesmo arquivo.
 */
export function buildWorkbook(sheets: ExcelSheetData[]): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const usados = new Set<string>();

  sheets.forEach((s, idx) => {
    let nome = sanitizeSheetName(s.sheetName, `Planilha${idx + 1}`);
    if (usados.has(nome.toLowerCase())) {
      let n = 2;
      let candidato = `${nome.substring(0, 28)} ${n}`;
      while (usados.has(candidato.toLowerCase())) {
        n += 1;
        candidato = `${nome.substring(0, 28)} ${n}`;
      }
      nome = candidato;
    }
    usados.add(nome.toLowerCase());
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(neutralizeRows(s.data)), nome);
  });

  return wb;
}

/** Garante a extensão .xlsx no nome do arquivo. */
export function withXlsxExtension(filename: string): string {
  return filename.toLowerCase().endsWith('.xlsx') ? filename : `${filename}.xlsx`;
}

/** Monta e baixa o arquivo. Lança se não houver nenhuma aba. */
export function downloadWorkbook(filename: string, sheets: ExcelSheetData[]): void {
  if (!sheets.length) throw new Error('Nada para exportar.');
  XLSX.writeFile(buildWorkbook(sheets), withXlsxExtension(filename));
}

/** Converte texto livre em nome de arquivo seguro. */
export function slugifyFilename(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'exportacao';
}
