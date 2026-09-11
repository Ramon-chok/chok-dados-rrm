// Gera os modelos de planilha (.xlsx) de cada tipo de importação, com os
// cabeçalhos exatos esperados por server/importTypes.ts e 2 linhas de
// exemplo mostrando o formato certo (datas DD/MM/AAAA, números sem "R$"/"%").
// Uso: node scripts/generate-import-templates.mjs
import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '..', 'templates', 'importacao');
fs.mkdirSync(outDir, { recursive: true });

const TEMPLATES = [
  {
    file: '01_vendas.xlsx',
    headers: ['numero_pedido', 'data_emissao', 'cod_cliente', 'cod_vendedor', 'valor_total'],
    rows: [
      ['PED-000123', '11/09/2026', '5001', '1250', 4520.9],
      ['PED-000124', '11/09/2026', '5002', '1250', 1899],
    ],
  },
  {
    file: '02_metas.xlsx',
    headers: ['ano_mes', 'cod_vendedor', 'fabricante', 'meta_faturamento', 'meta_cobertura'],
    rows: [
      ['2026-09', '1250', 'NESTLÉ', 90000, 12],
      ['2026-09', '1250', 'UNILEVER', 60000, 10],
    ],
  },
  {
    file: '03_clientes.xlsx',
    headers: ['cod_cliente', 'razao_social', 'cnpj', 'cod_vendedor', 'status'],
    rows: [
      ['5001', 'Mercado Bom Preço LTDA', '12.345.678/0001-90', '1250', 'Ativo'],
      ['5002', 'Distribuidora São José LTDA', '98.765.432/0001-10', '1250', 'Ativo'],
    ],
  },
  {
    file: '04_vendedores.xlsx',
    headers: ['cod_vendedor', 'nome', 'email', 'equipe'],
    rows: [
      ['1250', 'João Souza', 'joao.souza@chok.com.br', 'TRAB ALFA'],
      ['1251', 'Maria Lima', 'maria.lima@chok.com.br', 'TRAB ALFA'],
    ],
  },
  {
    file: '05_equipes.xlsx',
    headers: ['nome_equipe', 'supervisor', 'gerencia'],
    rows: [
      ['TRAB ALFA', 'Supervisor A', 'TRAD'],
      ['TRAB BETA', 'Supervisor B', 'TRAD'],
    ],
  },
  {
    file: '06_supervisores.xlsx',
    headers: ['nome_supervisor', 'gerencia', 'email'],
    rows: [
      ['Supervisor A', 'TRAD', 'supervisor.a@chok.com.br'],
      ['Supervisor B', 'TRAD', 'supervisor.b@chok.com.br'],
    ],
  },
  {
    file: '07_gerencias.xlsx',
    headers: ['codigo_gerencia', 'nome_gerencia'],
    rows: [
      ['TRAD', 'Gerência Tradicional'],
      ['AS', 'Gerência Autosserviço'],
    ],
  },
  {
    file: '08_fabricantes.xlsx',
    headers: ['nome_fabricante', 'razao_social', 'cnpj'],
    rows: [
      ['NESTLÉ', 'Nestlé Brasil LTDA', '60.409.075/0001-25'],
      ['UNILEVER', 'Unilever Brasil LTDA', '61.081.885/0001-79'],
    ],
  },
  {
    file: '09_categorias.xlsx',
    headers: ['cod_categoria', 'nome_categoria', 'fabricante'],
    rows: [
      ['CAT-01', 'Biscoitos', 'NESTLÉ'],
      ['CAT-02', 'Achocolatados', 'NESTLÉ'],
    ],
  },
  {
    file: '10_produtos.xlsx',
    headers: ['cod_produto', 'descricao', 'fabricante', 'categoria', 'preco_tabela'],
    rows: [
      ['PRD-1001', 'Biscoito Recheado 130g', 'NESTLÉ', 'CAT-01', 3.45],
      ['PRD-1002', 'Achocolatado em Pó 400g', 'NESTLÉ', 'CAT-02', 8.9],
    ],
  },
  {
    file: '11_visitas.xlsx',
    headers: ['cod_cliente', 'cod_vendedor', 'data_visita', 'status_visita'],
    rows: [
      ['5001', '1250', '11/09/2026', 'Realizada'],
      ['5002', '1250', '11/09/2026', 'Fora de Rota'],
    ],
  },
  {
    file: '12_indicadores_vendedor.xlsx',
    headers: [
      'cod_vendedor',
      'gerencia',
      'nome_vendedor',
      'meta_faturamento',
      'realizado_faturamento',
      'meta_cobertura',
      'realizado_cobertura',
      'meta_sortimento',
      'realizado_sortimento',
      'pct_margem',
    ],
    rows: [
      ['1250', 'TRAD', 'João Souza', 90000, 84424.24, 12, 10, 40, 35, 9.56],
      ['1251', 'TRAD', 'Maria Lima', 85000, 92842.11, 12, 13, 38, 34, 10.21],
    ],
  },
  {
    file: '13_indicadores_fabricante.xlsx',
    headers: ['cod_vendedor', 'fabricante', 'gerencia', 'equipe', 'meta', 'realizado', 'cobertura', 'realizado_cobertura', 'pct_margem'],
    rows: [
      ['1250', 'NESTLÉ', 'TRAD', 'TRAB ALFA', 30000, 28150.1, 12, 10, 21.4],
      ['1250', 'UNILEVER', 'TRAD', 'TRAB ALFA', 20000, 19870.5, 12, 10, 19.5],
    ],
  },
  {
    file: '14_indicadores_positivacao.xlsx',
    headers: [
      'cod_vendedor',
      'equipe',
      'visitas_previstas',
      'visitas_realizadas',
      'vendas_previstas',
      'vendas_realizadas',
      'fora_de_rota',
      'gps_ok',
      'pedidos',
      'apontamentos',
    ],
    rows: [
      ['1250', 'TRAB ALFA', 20, 18, 15, 13, 1, 17, 13, 18],
      ['1251', 'TRAB ALFA', 22, 20, 17, 15, 0, 20, 15, 20],
    ],
  },
];

for (const tpl of TEMPLATES) {
  const wb = XLSX.utils.book_new();
  const aoa = [tpl.headers, ...tpl.rows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = tpl.headers.map((h) => ({ wch: Math.max(h.length + 2, 14) }));
  XLSX.utils.book_append_sheet(wb, ws, 'dados');
  XLSX.writeFile(wb, path.join(outDir, tpl.file));
  console.log('gerado:', tpl.file);
}

console.log(`\n${TEMPLATES.length} modelos gerados em ${outDir}`);
