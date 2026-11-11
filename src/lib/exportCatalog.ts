/**
 * Catálogo de extrações do sistema.
 *
 * Cada tela do sistema tinha o seu próprio botão "Exportar Excel". Eles saíram:
 * a leitura e a análise acontecem dentro do sistema, e a extração passou a ser
 * um ato consciente e centralizado na tela "Dados e Exportações" (ADMIN), onde
 * se escolhe QUAIS telas sair em planilha.
 *
 * Cada item aqui descreve uma tela e sabe buscar os próprios dados — o
 * conteúdo e as colunas são os mesmos que a tela mostra, só que sem depender
 * de a tela estar aberta. As buscas usam exatamente os mesmos endpoints das
 * telas (src/lib/api.ts), portanto o recorte de dados do usuário logado
 * (vendedor/equipe/gerência) continua valendo no servidor.
 */
import type { PeriodType } from '../context/GlobalFilterContext';
import type { ExcelSheetData } from './excel';
import { labelForTipo } from '../pages/admin/importTypes';
import {
  fetchBaseRoteiro,
  fetchCategoryBoard,
  fetchDashboard,
  fetchImportHistory,
  fetchNaoPositivadosImport,
  fetchRaioX,
  fetchSalesBoard,
  fetchSortimento,
  fetchTargets,
  fetchTop20Customers,
  fetchTopCustomers,
  fetchVerbaIndenizatoria,
} from './api';

/** Período escolhido na tela de exportações (vem do filtro global). */
export interface ExportContext {
  periodType: PeriodType;
  ano?: number;
  mes?: number;
  startDate: string;
  endDate: string;
  /** Rótulo legível do período, usado em colunas e no nome do arquivo. */
  periodLabel: string;
}

export type ExportGroup = 'Quadros' | 'Principal' | 'Comercial' | 'SAR' | 'Administração';

export interface ExportDataset {
  id: string;
  /** Nome da tela, igual ao do menu. */
  label: string;
  group: ExportGroup;
  /** O que sai na planilha, em uma linha. */
  description: string;
  /** true = ignora o período escolhido (a tela não é recortada por período). */
  ignoresPeriod?: boolean;
  build: (ctx: ExportContext) => Promise<ExcelSheetData[]>;
}

/* ------------------------------------------------------------------ *
 * Helpers de período — repetem a mesma regra usada pelas telas:
 * "personalizado" não manda ano/mês, e mês só vale no modo mensal.
 * ------------------------------------------------------------------ */

function periodParams(ctx: ExportContext) {
  return {
    ano: ctx.periodType === 'personalizado' ? undefined : ctx.ano,
    mes: ctx.periodType === 'mensal' ? ctx.mes : undefined,
    start: ctx.startDate || undefined,
    end: ctx.endDate || undefined,
  };
}

/** Ano/mês para as telas do SAR, que consultam sempre por ano (+ mês). */
function sarParams(ctx: ExportContext) {
  return {
    ano: ctx.ano ?? new Date().getFullYear(),
    mes: ctx.periodType === 'mensal' ? ctx.mes : undefined,
  };
}

function anoMes(ctx: ExportContext): string | undefined {
  if (ctx.periodType !== 'mensal' || !ctx.ano || !ctx.mes) return undefined;
  return `${ctx.ano}-${String(ctx.mes).padStart(2, '0')}`;
}

const fmtDate = (v: string | null) => (v ? new Date(v).toLocaleDateString('pt-BR') : '—');
const fmtDateTime = (v: string | null) => (v ? new Date(v).toLocaleString('pt-BR') : '—');

/** 2=segunda ... 6=sexta, convenção da planilha de Base de Roteiro. */
const DIA_LABEL: Record<number, string> = {
  2: 'Segunda',
  3: 'Terça',
  4: 'Quarta',
  5: 'Quinta',
  6: 'Sexta',
  7: 'Sábado',
};

const STATUS_IMPORTACAO: Record<string, string> = {
  CONCLUIDO: 'Concluído',
  CONCLUIDO_COM_AVISOS: 'Concluído com Avisos',
  FALHA: 'Falha',
};

/** Quantas linhas do ranking de Top Clientes a extração leva. */
const TOP_CLIENTES_LIMITE = 100;

export const EXPORT_DATASETS: ExportDataset[] = [
  /* ---------------------------- Quadros ---------------------------- */
  {
    id: 'sales-board',
    label: 'Quadro de Vendas',
    group: 'Quadros',
    description: 'Meta x realizado por vendedor, com cobertura e margem.',
    build: async (ctx) => {
      const res = await fetchSalesBoard(periodParams(ctx));
      return [
        {
          sheetName: 'Quadro de Vendas',
          data: res.rows.map((r) => ({
            Código: r.codVendedor,
            Vendedor: r.vendedor || '—',
            Equipe: r.equipe || '—',
            Meta: r.meta,
            Realizado: r.realizado,
            Gap: r.gap,
            'Atingimento (%)': r.atingimento,
            'Meta Cobertura': r.metaCobertura,
            'Cobertura Realizada': r.realizadoCobertura,
            'Cobertura (%)': r.pctCobertura,
            'Margem (%)': r.margem,
            Período: ctx.periodLabel,
          })),
        },
      ];
    },
  },
  {
    id: 'categories',
    label: 'Categorias',
    group: 'Quadros',
    description: 'Meta x realizado por categoria/fabricante.',
    build: async (ctx) => {
      const res = await fetchCategoryBoard(periodParams(ctx));
      return [
        {
          sheetName: 'Categorias',
          data: res.rows.map((r) => ({
            Categoria: r.categoria,
            Meta: r.meta,
            Realizado: r.realizado,
            Gap: r.gap,
            'Atingimento (%)': r.atingimento,
            'Participação (%)': r.participacao,
            'Meta Cobertura': r.metaCobertura,
            'Cobertura Realizada': r.realizadoCobertura,
            'Margem (%)': r.margem,
            Período: ctx.periodLabel,
          })),
        },
      ];
    },
  },

  /* --------------------------- Principal --------------------------- */
  {
    id: 'dashboard',
    label: 'Dashboard',
    group: 'Principal',
    description: 'KPIs do período, série mensal, top clientes e fabricantes.',
    build: async (ctx) => {
      const data = await fetchDashboard(periodParams(ctx));
      const k = data.kpis;
      return [
        {
          sheetName: 'KPIs',
          data: [
            { Indicador: 'Meta Faturamento', Valor: k.meta },
            { Indicador: 'Realizado Faturamento', Valor: k.realizado },
            { Indicador: 'Atingimento Faturamento %', Valor: k.atingimento },
            { Indicador: 'GAP Faturamento', Valor: k.gap },
            { Indicador: 'Meta Cobertura', Valor: k.metaCobertura },
            { Indicador: 'Realizado Cobertura', Valor: k.realizadoCobertura },
            { Indicador: 'Atingimento Cobertura %', Valor: k.pctCobertura },
            { Indicador: 'GAP Cobertura', Valor: k.gapCobertura },
            { Indicador: 'Meta Sortimento', Valor: k.metaSortimento },
            { Indicador: 'Realizado Sortimento', Valor: k.realizadoSortimento },
            { Indicador: 'Atingimento Sortimento %', Valor: k.pctSortimento },
            { Indicador: 'GAP Sortimento', Valor: k.gapSortimento },
            { Indicador: 'Margem Total %', Valor: k.margem },
          ].map((row) => ({ ...row, Período: ctx.periodLabel })),
        },
        {
          sheetName: 'Série Mensal',
          data: data.serieMensal.map((s) => ({
            Ano: s.ano,
            Mês: s.mes,
            Meta: s.meta,
            Realizado: s.realizado,
            'Margem (%)': s.margem,
          })),
        },
        {
          sheetName: 'Top Clientes',
          data: data.topClientes.map((c, i) => ({
            Posição: i + 1,
            'É Rede': c.eRede ? 'Sim' : 'Não',
            Código: c.codigo || '—',
            Cliente: c.nome,
            Equipe: c.equipe,
            Faturamento: c.valor,
          })),
        },
        {
          sheetName: 'Fabricantes',
          data: data.fabricantes.map((f) => ({
            Fabricante: f.fabricante,
            Meta: f.meta,
            Realizado: f.realizado,
            'Atingimento %': f.pctR,
            'Meta Cobertura': f.metaCobertura,
            'Realizado Cobertura': f.realizadoCobertura,
            'Atingimento Cobertura %': f.pctCob,
            'Margem %': f.pctMargem,
          })),
        },
      ];
    },
  },
  {
    id: 'macro-view',
    label: 'Visão Macro',
    group: 'Principal',
    description: 'Consolidado corporativo por fabricante.',
    build: async (ctx) => {
      const data = await fetchDashboard(periodParams(ctx));
      return [
        {
          sheetName: 'Macro',
          data: data.fabricantes.map((f) => ({
            Fabricante: f.fabricante,
            Meta: f.meta,
            Realizado: f.realizado,
            GAP: f.gap,
            Atingimento: f.pctR,
            Margem: f.pctMargem,
            Período: ctx.periodLabel,
          })),
        },
      ];
    },
  },

  /* --------------------------- Comercial --------------------------- */
  {
    id: 'not-positivated',
    label: 'Não Positivados',
    group: 'Comercial',
    description: 'Clientes sem compra no período, com o valor de cada fabricante.',
    build: async (ctx) => {
      const res = await fetchNaoPositivadosImport(periodParams(ctx));
      const categorias = res.categorias || [];
      return [
        {
          sheetName: 'Não Positivados',
          data: res.rows.map((c) => {
            const porFabricante: Record<string, number> = {};
            let total = 0;
            categorias.forEach((cat) => {
              const v = Number(c.fabricantes?.[cat]) || 0;
              porFabricante[cat] = v;
            });
            Object.values(c.fabricantes || {}).forEach((v) => {
              total += Number(v) || 0;
            });
            return {
              'Cód. Cliente': c.codCliente,
              'Razão Social': c.razaoSocial,
              'Nome Fantasia': c.nomeFantasia,
              Município: c.municipio,
              ...(c.vendedor !== undefined ? { Vendedor: c.vendedor } : {}),
              ...(c.equipe !== undefined ? { Equipe: c.equipe } : {}),
              ...porFabricante,
              'Valor Total': total,
              Período: ctx.periodLabel,
            };
          }),
        },
      ];
    },
  },
  {
    id: 'top-20-customers',
    label: 'TOP 20 Clientes',
    group: 'Comercial',
    description: 'Comparativo de trimestre e mês por cliente/rede.',
    build: async (ctx) => {
      const rows = await fetchTop20Customers(periodParams(ctx));
      return [
        {
          sheetName: 'Top 20 Clientes',
          data: rows.map((r) => ({
            'Data Referência': fmtDate(r.dataReferencia),
            Nível: r.nivel,
            Gerência: r.gerencia,
            Equipe: r.equipe,
            'Cód. Vendedor': r.codVendedor,
            Vendedor: r.nomeVendedor,
            Pasta: r.pasta,
            'Cód. Cliente': r.codCliente,
            'Cliente/Redes': r.clienteRedes,
            'Trimestre 25': r.trimestre25,
            'Trimestre 26': r.trimestre26,
            '% Cresc. Trimestre': r.pctCrescTrimestre,
            'Mês 25': r.mes25,
            'Mês 26': r.mes26,
            '% Cresc. Mês': r.pctCrescMes,
            Período: ctx.periodLabel,
          })),
        },
      ];
    },
  },
  {
    id: 'top-customers',
    label: 'TOP Clientes',
    group: 'Comercial',
    description: `Ranking de faturamento do período (até ${TOP_CLIENTES_LIMITE} clientes).`,
    build: async (ctx) => {
      const rows = await fetchTopCustomers({
        start: ctx.startDate || undefined,
        end: ctx.endDate || undefined,
        limit: TOP_CLIENTES_LIMITE,
      });
      return [
        {
          sheetName: 'Top Clientes',
          data: rows.map((c) => ({
            Posição: c.pos,
            Código: c.codigo,
            Cliente: c.nome,
            Vendedor: c.vendedor,
            Equipe: c.equipe,
            Faturamento: c.faturamento,
            'Participação %': c.part,
            Período: ctx.periodLabel,
          })),
        },
      ];
    },
  },
  {
    id: 'sortiments',
    label: 'Sortimentos',
    group: 'Comercial',
    description: 'Lista de sortimento importada, item por item.',
    ignoresPeriod: true,
    build: async () => {
      const rows = await fetchSortimento();
      return [
        {
          sheetName: 'Sortimentos',
          data: rows.map((p) => ({
            Código: p.codigo,
            Produto: p.produto,
            Fabricante: p.fabricante,
            Categoria: p.categoria,
            Linha: p.linha,
            'Atualizado em': p.atualizadoEm,
          })),
        },
      ];
    },
  },
  {
    id: 'objectives',
    label: 'Objetivos',
    group: 'Comercial',
    description: 'Metas de faturamento e cobertura por vendedor e fabricante.',
    build: async (ctx) => {
      const mesRef = anoMes(ctx);
      const rows = await fetchTargets(mesRef ? { ano_mes: mesRef } : undefined);
      return [
        {
          sheetName: 'Objetivos',
          data: rows.map((r) => ({
            'Ano-Mês': r.anoMes,
            'Cód. Vendedor': r.codVendedor,
            Vendedor: r.vendedor,
            Equipe: r.equipe,
            Fabricante: r.fabricante,
            'Meta Faturamento': r.metaFaturamento,
            'Meta Cobertura': r.metaCobertura,
          })),
        },
      ];
    },
  },

  /* ------------------------------- SAR ------------------------------ */
  {
    id: 'sar-raio-x',
    label: 'Raio-X',
    group: 'SAR',
    description: 'Visitas, positivação e produtividade por vendedor.',
    build: async (ctx) => {
      const data = await fetchRaioX(sarParams(ctx));
      return [
        {
          sheetName: 'RaioX',
          data: data.rows.map((r) => ({
            Código: r.codVendedor,
            Vendedor: r.vendedor,
            Equipe: r.equipe,
            Dias: r.diasComDados,
            'Visitas Prev.': r.visitasPrevistas,
            'Visitas Real.': r.visitasRealizadas,
            'Fora de Rota': r.visitasForaRota,
            '% Fora Rota': r.percForaRota,
            '% GPS': r.percGps,
            Pedidos: r.pedidos,
            '% Positivação': r.percPositivacao,
            Produtividade: r.produtividade,
            Início: r.horaInicio || '',
            Fim: r.horaFim || '',
            'T. Campo': r.tempoCampo || '',
            'Acumulado Prev.': r.acumuladoPrevista,
            'Acumulado Real.': r.acumuladoRealizadas,
            'Acumulado %': r.acumuladoPorcentagem,
            '% Positivação Acumulada': r.percPositivacaoAcumulado,
            Apontamentos: r.apontamentosInconsistencia || '',
          })),
        },
      ];
    },
  },
  {
    id: 'sar-base-roteiro',
    label: 'Base de Roteiro',
    group: 'SAR',
    description: 'Roteiro de visitação do último snapshot importado.',
    ignoresPeriod: true,
    build: async () => {
      const data = await fetchBaseRoteiro();
      return [
        {
          sheetName: 'Base de Roteiro',
          data: data.rows.map((p) => ({
            'Código Cliente': p.codCliente || '',
            'Razão Social': p.razaoSocial || '',
            'Nome Fantasia': p.nomeFantasia || '',
            'Código Vendedor': p.codVendedor || '',
            Vendedor: p.vendedor || '',
            Equipe: p.equipe || '',
            Município: p.municipio || '',
            Bairro: p.bairro || '',
            Endereço: p.endereco || '',
            Latitude: p.latitude ?? '',
            Longitude: p.longitude ?? '',
            Dia: p.dia ?? '',
            'Dia da semana': p.dia !== null ? DIA_LABEL[p.dia] || '' : '',
            Semana: p.semana || '',
            Sequência: p.sequencia ?? '',
            Frequência: p.frequencia || '',
            'Data de Referência': fmtDate(data.data),
          })),
        },
      ];
    },
  },
  {
    id: 'sar-verba-indenizatoria',
    label: 'Verba Indenizatória',
    group: 'SAR',
    description: 'KM, verba, desconto, reembolso e valor a pagar por vendedor.',
    build: async (ctx) => {
      const data = await fetchVerbaIndenizatoria(sarParams(ctx));
      return [
        {
          sheetName: 'Verba Indenizatória',
          data: data.rows.map((r) => ({
            Código: r.codVendedor,
            Nome: r.vendedor,
            Equipe: r.equipe || '',
            'KM Total': r.kmTotal,
            'Verba Indenizatória': r.verbaIndenizatoria,
            Desconto: r.desconto,
            Reembolso: r.reembolso,
            'A Pagar': r.aPagar,
            ...(data.mode === 'periodo' ? { 'Fechamentos somados': r.periodos } : {}),
          })),
        },
      ];
    },
  },

  /* -------------------------- Administração ------------------------- */
  {
    id: 'import-history',
    label: 'Histórico de Importações',
    group: 'Administração',
    description: 'Auditoria das importações: arquivo, usuário, linhas e status.',
    ignoresPeriod: true,
    build: async () => {
      const entradas = await fetchImportHistory(500);
      return [
        {
          sheetName: 'Histórico',
          data: entradas.map((i) => ({
            'Tipo de Dado': labelForTipo(i.tipo),
            Arquivo: i.arquivo || '—',
            Usuário: i.usuario_nome || '—',
            'Data e Hora': fmtDateTime(i.data_importacao),
            'Total de Linhas': i.total_linhas,
            Válidos: i.total_linhas - i.rejeitados,
            Novos: i.novos,
            Atualizados: i.atualizados,
            Rejeitados: i.rejeitados,
            Status: STATUS_IMPORTACAO[i.status] || i.status,
            Erro: i.mensagem_erro || '',
          })),
        },
      ];
    },
  },
];

export const EXPORT_GROUP_ORDER: ExportGroup[] = [
  'Quadros',
  'Principal',
  'Comercial',
  'SAR',
  'Administração',
];

export function datasetsByGroup(): { group: ExportGroup; datasets: ExportDataset[] }[] {
  return EXPORT_GROUP_ORDER.map((group) => ({
    group,
    datasets: EXPORT_DATASETS.filter((d) => d.group === group),
  })).filter((g) => g.datasets.length > 0);
}

export function findDataset(id: string): ExportDataset | undefined {
  return EXPORT_DATASETS.find((d) => d.id === id);
}
