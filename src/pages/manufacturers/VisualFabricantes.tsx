/**
 * Visual Fabricantes — leitura comercial por fabricante.
 *
 * Traz para dentro da plataforma CHOK as funções descritas no PRD da
 * Plataforma de Desenvolvimento de Fabricantes, usando as bases que ESTE
 * sistema já importa e mantendo o desenho das demais telas.
 *
 * Organização (de cima para baixo, do mais decisivo ao mais detalhado):
 *
 *  1. **Fabricante e períodos** — o que se está lendo e de quando. A
 *     comparação A/B fica no topo porque é ela que dá sentido a todo o resto.
 *  2. **Avisos de leitura** — cobertura incompleta, períodos sobrepostos e
 *     precedência da carga aparecem JUNTO dos números, não num rodapé.
 *  3. **Abas** — visão geral, comparação, rankings, clientes, produtos foco,
 *     metas, margens e acessos.
 *
 * Três regras do PRD guiam tudo o que está aqui:
 *
 * * **Ausência não é zero.** Indicador sem base aparece como traço com o
 *   motivo ao lado; nunca como 0.
 * * **A tela não é a trava.** Cada recurso é autorizado no servidor. O que
 *   esta tela faz é não oferecer o que o perfil não pode abrir — margens, por
 *   exemplo, nem chegam ao navegador de quem não tem `margin.view`.
 * * **Rastreabilidade.** Cada bloco diz de qual importação veio.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  BadgeDollarSign,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Download,
  Factory,
  Layers,
  Percent,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Target,
  Trash2,
  TrendingUp,
  Trophy,
  UserMinus,
  Users,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { ErrorBlock, LoadingBlock } from '../../components/common/DataState';
import { SingleSelectFilter } from '../../components/common/SingleSelectFilter';
import { ChartTooltip, fmtBRLShort, useChartColors } from '../../components/charts/chartKit';
import { downloadWorkbook, slugifyFilename } from '../../lib/excel';
import { getErrorMessage } from '../../lib/api';
import { isAdminRole, podeFiltrarEquipe, podeFiltrarVendedor } from '../../types';
import {
  AcessosResponse,
  CatalogoResponse,
  DimensoesResponse,
  EvolucaoResponse,
  ItemRanking,
  MargensResponse,
  MetasResponse,
  Precedencia,
  ProdutosFocoResponse,
  RankingsResponse,
  RecuperarResponse,
  ResumoResponse,
  fetchAcessos,
  fetchCatalogo,
  fetchDimensoes,
  fetchEvolucao,
  fetchMargens,
  fetchMetas,
  fetchProdutosFoco,
  fetchRankings,
  fetchRecuperar,
  fetchResumo,
  gravarMeta,
  registrarAcesso,
  removerMeta,
  removerProdutoFoco,
  salvarProdutoFoco,
} from '../../lib/visualFabricantes';
import {
  BarraProporcao,
  BlocoIndisponivel,
  Botao,
  CampoData,
  CartaoIndicador,
  FaixaAvisos,
  Fontes,
  GradeCartoes,
  Secao,
  SeloMovimento,
  SeloVariacao,
  TRACO,
  Tabela,
  Td,
  Th,
  dataBR,
  fmtBRL,
  fmtInt,
  fmtPct,
  formatar,
} from './visualShared';

// ─────────────────────────────────────────────────────────────────────────────
// Datas
// ─────────────────────────────────────────────────────────────────────────────
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const MES_CURTO = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

interface Intervalo {
  inicio: string;
  fim: string;
}

/** Mês corrente até hoje — o recorte que a gestão abre por padrão. */
function mesAtual(): Intervalo {
  const hoje = new Date();
  return { inicio: iso(new Date(hoje.getFullYear(), hoje.getMonth(), 1)), fim: iso(hoje) };
}

/** Mesmo trecho do mês anterior: serve de período A sem sobrepor o B. */
function mesmoTrechoMesAnterior(b: Intervalo): Intervalo {
  const ini = new Date(`${b.inicio}T00:00:00`);
  const fim = new Date(`${b.fim}T00:00:00`);
  const inicioA = new Date(ini.getFullYear(), ini.getMonth() - 1, ini.getDate());
  const diasNoMes = new Date(fim.getFullYear(), fim.getMonth(), 0).getDate();
  const fimA = new Date(fim.getFullYear(), fim.getMonth() - 1, Math.min(fim.getDate(), diasNoMes));
  return { inicio: iso(inicioA), fim: iso(fimA) };
}

/**
 * Mesmo trecho do ano anterior.
 *
 * 29/02 não existe em ano comum: em vez de deslizar para 01/03 (o que o
 * construtor de Date faria sozinho), a data recua para 28/02. É o CA-25 do
 * PRD — comparar com uma data válida, não com um dia de outro mês.
 */
function mesmoTrechoAnoAnterior(b: Intervalo): Intervalo {
  const ajustar = (valor: string) => {
    const d = new Date(`${valor}T00:00:00`);
    const ano = d.getFullYear() - 1;
    const ultimoDia = new Date(ano, d.getMonth() + 1, 0).getDate();
    return iso(new Date(ano, d.getMonth(), Math.min(d.getDate(), ultimoDia)));
  };
  return { inicio: ajustar(b.inicio), fim: ajustar(b.fim) };
}

function trimestreAtual(): Intervalo {
  const hoje = new Date();
  const primeiroMes = Math.floor(hoje.getMonth() / 3) * 3;
  return { inicio: iso(new Date(hoje.getFullYear(), primeiroMes, 1)), fim: iso(hoje) };
}

function anoAtual(): Intervalo {
  const hoje = new Date();
  return { inicio: iso(new Date(hoje.getFullYear(), 0, 1)), fim: iso(hoje) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Abas
// ─────────────────────────────────────────────────────────────────────────────
type AbaId =
  | 'visao'
  | 'comparacao'
  | 'rankings'
  | 'clientes'
  | 'foco'
  | 'metas'
  | 'margens'
  | 'acessos';

interface Aba {
  id: AbaId;
  rotulo: string;
  icone: React.ReactNode;
  /** Quando false, a aba nem aparece — o recurso também é negado no servidor. */
  visivel: boolean;
}

export const VisualFabricantesPage: React.FC = () => {
  const { t } = useTheme();
  const { currentUser, hasPermission } = useAuth();
  const cores = useChartColors();
  const papel = currentUser?.role;

  // ── Catálogo e escopo ────────────────────────────────────────────────────
  const [catalogo, setCatalogo] = useState<CatalogoResponse | null>(null);
  const [carregandoCatalogo, setCarregandoCatalogo] = useState(true);
  const [erroCatalogo, setErroCatalogo] = useState<string | null>(null);
  const [fabricante, setFabricante] = useState('');

  // ── Períodos ─────────────────────────────────────────────────────────────
  const [periodoB, setPeriodoB] = useState<Intervalo>(() => mesAtual());
  const [periodoA, setPeriodoA] = useState<Intervalo>(() => mesmoTrechoMesAnterior(mesAtual()));
  const [compararA, setCompararA] = useState(true);
  const [precedencia, setPrecedencia] = useState<Precedencia>('auto');

  // ── Filtros comerciais ───────────────────────────────────────────────────
  const [equipe, setEquipe] = useState('');
  const [vendedor, setVendedor] = useState('');

  const [aba, setAba] = useState<AbaId>('visao');

  // ── Dados por bloco ──────────────────────────────────────────────────────
  const [resumo, setResumo] = useState<ResumoResponse | null>(null);
  const [evolucao, setEvolucao] = useState<EvolucaoResponse | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [dimensoes, setDimensoes] = useState<DimensoesResponse | null>(null);
  const [rankings, setRankings] = useState<RankingsResponse | null>(null);
  const [recuperar, setRecuperar] = useState<RecuperarResponse | null>(null);
  const [foco, setFoco] = useState<ProdutosFocoResponse | null>(null);
  const [metas, setMetas] = useState<MetasResponse | null>(null);
  const [margens, setMargens] = useState<MargensResponse | null>(null);
  const [acessos, setAcessos] = useState<AcessosResponse | null>(null);
  const [erroAba, setErroAba] = useState<string | null>(null);
  const [carregandoAba, setCarregandoAba] = useState(false);

  // Buscas locais de cada bloco.
  const [buscaDimensao, setBuscaDimensao] = useState('');
  const [buscaRanking, setBuscaRanking] = useState('');
  const [buscaCliente, setBuscaCliente] = useState('');
  const [buscaMargem, setBuscaMargem] = useState('');
  /**
   * Filtro de margens EFETIVAMENTE aplicado.
   *
   * Fica separado do texto digitado de propósito: `carregarAba` entra na lista
   * de dependências do efeito que carrega a aba, então usar o texto direto
   * dispararia uma requisição por tecla digitada. A consulta só é refeita
   * quando o usuário confirma a busca ou troca de página.
   */
  const [filtroMargem, setFiltroMargem] = useState<{ busca: string; pagina: number }>({
    busca: '',
    pagina: 1,
  });

  const podeVerMargem = !!catalogo?.podeVerMargem && hasPermission('margin.view');
  const podeGravarMetas = !!catalogo?.podeGravarMetas;
  const podeVerAcessos = !!catalogo?.podeVerAcessos;
  const podeExportar = catalogo?.podeExportar !== false;
  const escopoTravado = !!catalogo?.escopoTravado;

  // ── Carga do catálogo ────────────────────────────────────────────────────
  useEffect(() => {
    let vivo = true;
    (async () => {
      setCarregandoCatalogo(true);
      setErroCatalogo(null);
      try {
        const dados = await fetchCatalogo();
        if (!vivo) return;
        setCatalogo(dados);
        // Perfil travado (fornecedor) entra direto no próprio fabricante.
        if (dados.fabricanteDoPerfil) setFabricante(dados.fabricanteDoPerfil);
        else if (dados.fabricantes.length === 1) setFabricante(dados.fabricantes[0].fabricante);
      } catch (err) {
        if (vivo) setErroCatalogo(getErrorMessage(err, 'Falha ao carregar o catálogo de fabricantes.'));
      } finally {
        if (vivo) setCarregandoCatalogo(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  const parametrosBase = useMemo(
    () => ({
      fabricante: fabricante || undefined,
      equipe: equipe || undefined,
      vendedor: vendedor || undefined,
      precedencia,
    }),
    [fabricante, equipe, vendedor, precedencia]
  );

  // ── Visão geral: resumo + evolução ───────────────────────────────────────
  useEffect(() => {
    let vivo = true;
    (async () => {
      setCarregando(true);
      setErro(null);
      try {
        const [r, e] = await Promise.all([
          fetchResumo({
            ...parametrosBase,
            bInicio: periodoB.inicio,
            bFim: periodoB.fim,
            aInicio: compararA ? periodoA.inicio : undefined,
            aFim: compararA ? periodoA.fim : undefined,
          }),
          fetchEvolucao({ ...parametrosBase, inicio: periodoB.inicio, fim: periodoB.fim }),
        ]);
        if (!vivo) return;
        setResumo(r);
        setEvolucao(e);
      } catch (err) {
        if (vivo) {
          setResumo(null);
          setEvolucao(null);
          setErro(getErrorMessage(err, 'Falha ao carregar os indicadores do fabricante.'));
        }
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [parametrosBase, periodoB, periodoA, compararA]);

  // Registra a consulta (RF-029). Auditoria não pode interromper a tela.
  useEffect(() => {
    if (!fabricante) return;
    void registrarAcesso({
      fabricante,
      recurso: 'visual-fabricantes',
      detalhe: `${periodoB.inicio} a ${periodoB.fim}`,
    }).catch(() => undefined);
  }, [fabricante, periodoB.inicio, periodoB.fim]);

  // ── Carga sob demanda das demais abas ────────────────────────────────────
  const carregarAba = useCallback(
    async (alvo: AbaId) => {
      setErroAba(null);
      setCarregandoAba(true);
      try {
        if (alvo === 'comparacao') {
          setDimensoes(
            await fetchDimensoes({
              ...parametrosBase,
              bInicio: periodoB.inicio,
              bFim: periodoB.fim,
              aInicio: compararA ? periodoA.inicio : undefined,
              aFim: compararA ? periodoA.fim : undefined,
            })
          );
        } else if (alvo === 'rankings') {
          setRankings(await fetchRankings({ ...parametrosBase, inicio: periodoB.inicio, fim: periodoB.fim }));
        } else if (alvo === 'clientes') {
          setRecuperar(
            await fetchRecuperar({
              fabricante: fabricante || undefined,
              aInicio: periodoA.inicio,
              aFim: periodoA.fim,
              bInicio: periodoB.inicio,
              bFim: periodoB.fim,
            })
          );
        } else if (alvo === 'foco') {
          setFoco(await fetchProdutosFoco(fabricante || undefined));
        } else if (alvo === 'metas') {
          setMetas(await fetchMetas(fabricante || undefined));
        } else if (alvo === 'margens') {
          setMargens(
            await fetchMargens({
              fabricante: fabricante || undefined,
              inicio: periodoB.inicio,
              fim: periodoB.fim,
              busca: filtroMargem.busca || undefined,
              pagina: filtroMargem.pagina,
            })
          );
        } else if (alvo === 'acessos') {
          setAcessos(await fetchAcessos({ fabricante: fabricante || undefined, limit: 200 }));
        }
      } catch (err) {
        setErroAba(getErrorMessage(err, 'Falha ao carregar este bloco.'));
      } finally {
        setCarregandoAba(false);
      }
    },
    [parametrosBase, periodoA, periodoB, compararA, fabricante, filtroMargem]
  );

  useEffect(() => {
    if (aba === 'visao') return;
    void carregarAba(aba);
  }, [aba, carregarAba]);

  // ── Opções de filtro, derivadas do próprio recorte ───────────────────────
  // Nada de endpoint separado de "todas as equipes": as opções saem do que
  // este usuário já enxerga neste fabricante.
  const opcoesEquipe = useMemo(() => {
    const vistas = new Set<string>();
    (dimensoes?.equipes || []).forEach((e) => vistas.add(e.rotulo));
    (rankings?.vendedores.itens || []).forEach((v) => vistas.add(v.equipe));
    return [...vistas].filter(Boolean).sort().map((v) => ({ value: v, label: v }));
  }, [dimensoes, rankings]);

  const opcoesVendedor = useMemo(() => {
    const mapa = new Map<string, string>();
    (dimensoes?.vendedores || []).forEach((v) => mapa.set(v.chave, v.rotulo));
    (rankings?.vendedores.itens || []).forEach((v) => mapa.set(v.chave, v.nome));
    return [...mapa.entries()]
      .sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'))
      .map(([value, label]) => ({ value, label }));
  }, [dimensoes, rankings]);

  const abas: Aba[] = [
    { id: 'visao', rotulo: 'Visão geral', icone: <Activity size={15} />, visivel: true },
    { id: 'comparacao', rotulo: 'Comparação', icone: <TrendingUp size={15} />, visivel: true },
    { id: 'rankings', rotulo: 'Rankings', icone: <Trophy size={15} />, visivel: true },
    { id: 'clientes', rotulo: 'Clientes a recuperar', icone: <UserMinus size={15} />, visivel: true },
    { id: 'foco', rotulo: 'Produtos foco', icone: <Layers size={15} />, visivel: true },
    { id: 'metas', rotulo: 'Metas', icone: <Target size={15} />, visivel: true },
    { id: 'margens', rotulo: 'Margens', icone: <Percent size={15} />, visivel: podeVerMargem },
    { id: 'acessos', rotulo: 'Acessos', icone: <ShieldCheck size={15} />, visivel: podeVerAcessos },
  ];

  // ── Exportação ───────────────────────────────────────────────────────────
  const exportarRankings = () => {
    if (!rankings) return;
    // RN-06: a TELA destaca vinte; o arquivo leva TODOS os grupos positivos.
    downloadWorkbook(
      `visual-fabricantes-rankings-${slugifyFilename(fabricante || 'todos')}-${periodoB.inicio}-${periodoB.fim}`,
      [
        {
          sheetName: 'Vendedores',
          data: rankings.vendedores.itens.map((v, i) => ({
            Posição: i + 1,
            Código: v.chave,
            Vendedor: v.nome,
            Equipe: v.equipe,
            Valor: v.valor,
            'Participação (%)': v.participacao ?? '',
            Clientes: v.clientes ?? '',
            Meta: v.meta ?? '',
          })),
        },
        {
          sheetName: 'Clientes',
          data: rankings.clientes.itens.map((c, i) => ({
            Posição: i + 1,
            Código: c.chave,
            Cliente: c.nome,
            Equipe: c.equipe,
            Rede: c.rede ? 'Sim' : 'Não',
            Valor: c.valor,
            'Participação (%)': c.participacao ?? '',
          })),
        },
        {
          sheetName: 'Filtros',
          data: [
            {
              Fabricante: fabricante || 'Todos os autorizados',
              Início: periodoB.inicio,
              Fim: periodoB.fim,
              Equipe: equipe || 'Todas',
              Vendedor: vendedor || 'Todos',
              Precedência: rankings.precedencia,
              Observação: rankings.observacao,
            },
          ],
        },
      ]
    );
  };

  const exportarRecuperar = () => {
    if (!recuperar) return;
    downloadWorkbook(
      `clientes-a-recuperar-${slugifyFilename(fabricante || 'todos')}-${periodoB.inicio}`,
      [
        {
          sheetName: 'Oportunidades',
          data: recuperar.oportunidades.map((o) => ({
            Código: o.codigo,
            Cliente: o.nome,
            Fabricante: o.fabricante || '',
            'Vendedor em A': o.vendedorEmA,
            'Equipe em A': o.equipeEmA,
            'Última compra': o.ultimaCompra || '',
            'Valor em A': o.valorEmA,
          })),
        },
        {
          sheetName: 'Sem positivação',
          data: recuperar.semPositivacao.itens.map((c) => ({
            Código: c.codigo,
            Cliente: c.nome,
            Município: c.municipio,
            Vendedor: c.vendedor,
            Equipe: c.equipe,
            Valor: c.valor,
          })),
        },
      ]
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Estados iniciais
  // ─────────────────────────────────────────────────────────────────────────
  if (carregandoCatalogo) return <LoadingBlock label="Carregando fabricantes autorizados..." />;
  if (erroCatalogo) return <ErrorBlock message={erroCatalogo} />;

  if (catalogo?.vinculoPendente) {
    return (
      <div>
        <Cabecalho fabricante={null} />
        <BlocoIndisponivel
          titulo="Cadastro sem fabricante vinculado"
          motivo={
            'Este acesso é de representante de fabricante, mas o cadastro ainda não aponta qual fabricante ' +
            'ele representa. Enquanto o vínculo não for definido pela administração, nenhum dado comercial ' +
            'é liberado — e isso é proposital: sem vínculo, liberar "tudo" seria o erro.'
          }
        />
      </div>
    );
  }

  if (!catalogo?.fabricantes.length) {
    return (
      <div>
        <Cabecalho fabricante={null} />
        <BlocoIndisponivel
          titulo="Nenhum fabricante no seu escopo"
          motivo={
            'A base de Indicadores por Fabricante ainda não tem carga dentro do recorte deste perfil. ' +
            'Isso é ausência de dado, não desempenho zero: assim que a importação cobrir este escopo, ' +
            'os fabricantes aparecem aqui.'
          }
        />
      </div>
    );
  }

  const fabricanteAtual = catalogo.fabricantes.find((f) => f.fabricante === fabricante);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div>
      <Cabecalho fabricante={fabricante || null} />

      {/* ── Fabricante, períodos e filtros ─────────────────────────────── */}
      <section
        style={{
          background: t.surface,
          border: `1px solid ${t.border}`,
          borderRadius: 12,
          padding: '14px 16px',
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <div style={{ minWidth: 240, flex: '1 1 240px' }}>
            <SingleSelectFilter
              label="Fabricante"
              options={catalogo.fabricantes.map((f) => ({ value: f.fabricante, label: f.fabricante }))}
              value={fabricante}
              onChange={escopoTravado ? () => undefined : setFabricante}
              allLabel="Todos os autorizados"
              allowClear={!escopoTravado}
            />
          </div>

          {podeFiltrarEquipe(papel) && opcoesEquipe.length > 0 && (
            <div style={{ minWidth: 180 }}>
              <SingleSelectFilter label="Equipe" options={opcoesEquipe} value={equipe} onChange={setEquipe} />
            </div>
          )}
          {podeFiltrarVendedor(papel) && opcoesVendedor.length > 0 && (
            <div style={{ minWidth: 200 }}>
              <SingleSelectFilter
                label="Vendedor"
                options={opcoesVendedor}
                value={vendedor}
                onChange={setVendedor}
              />
            </div>
          )}

          <div style={{ minWidth: 190 }}>
            <SingleSelectFilter
              label="Precedência da carga"
              options={[
                { value: 'auto', label: 'Automática (recomendada)' },
                { value: 'soma', label: 'Somar todas as datas' },
                { value: 'ultima_carga', label: 'Só a carga mais recente do mês' },
              ]}
              value={precedencia}
              onChange={(v) => setPrecedencia(v as Precedencia)}
              allowClear={false}
            />
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))',
            gap: 14,
            marginTop: 14,
            paddingTop: 14,
            borderTop: `1px solid ${t.border}`,
          }}
        >
          {/* Período B — o que está sendo analisado */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
              <CalendarRange size={15} color={t.primary} />
              <strong style={{ fontSize: 12.5, color: t.text }}>Período analisado (B)</strong>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <CampoData
                rotulo="Início"
                valor={periodoB.inicio}
                onChange={(v) => setPeriodoB((p) => ({ ...p, inicio: v }))}
              />
              <CampoData rotulo="Fim" valor={periodoB.fim} onChange={(v) => setPeriodoB((p) => ({ ...p, fim: v }))} />
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              {[
                { rotulo: 'Mês atual', calc: mesAtual },
                { rotulo: 'Trimestre', calc: trimestreAtual },
                { rotulo: 'Ano', calc: anoAtual },
              ].map((atalho) => (
                <Atalho
                  key={atalho.rotulo}
                  rotulo={atalho.rotulo}
                  onClick={() => {
                    const novo = atalho.calc();
                    setPeriodoB(novo);
                    setPeriodoA(mesmoTrechoAnoAnterior(novo));
                  }}
                />
              ))}
            </div>
          </div>

          {/* Período A — a base de comparação */}
          <div>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                marginBottom: 8,
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              <input type="checkbox" checked={compararA} onChange={(e) => setCompararA(e.target.checked)} />
              <strong style={{ fontSize: 12.5, color: t.text }}>Comparar com o período anterior (A)</strong>
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', opacity: compararA ? 1 : 0.5 }}>
              <CampoData
                rotulo="Início"
                valor={periodoA.inicio}
                disabled={!compararA}
                onChange={(v) => setPeriodoA((p) => ({ ...p, inicio: v }))}
              />
              <CampoData
                rotulo="Fim"
                valor={periodoA.fim}
                disabled={!compararA}
                onChange={(v) => setPeriodoA((p) => ({ ...p, fim: v }))}
              />
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              <Atalho rotulo="Mês anterior" onClick={() => setPeriodoA(mesmoTrechoMesAnterior(periodoB))} />
              <Atalho rotulo="Ano anterior" onClick={() => setPeriodoA(mesmoTrechoAnoAnterior(periodoB))} />
            </div>
          </div>
        </div>

        {fabricanteAtual && (
          <div style={{ marginTop: 12, fontSize: 11.5, color: t.textMuted, lineHeight: 1.6 }}>
            <strong style={{ color: t.textSecondary }}>Cobertura declarada:</strong>{' '}
            {dataBR(fabricanteAtual.coberturaDeclarada.inicio)} a {dataBR(fabricanteAtual.coberturaDeclarada.fim)} ·{' '}
            {fmtInt(fabricanteAtual.coberturaDeclarada.diasComCarga)} datas com carga ·{' '}
            {fmtInt(fabricanteAtual.skus)} SKUs no sortimento. Cobertura declarada é o intervalo que a base diz ter;
            ela não comprova que o conteúdo daquele intervalo está completo.
          </div>
        )}
      </section>

      {/* ── Abas ───────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          gap: 6,
          marginBottom: 16,
          overflowX: 'auto',
          paddingBottom: 4,
        }}
        role="tablist"
        aria-label="Blocos da Visual Fabricantes"
      >
        {abas
          .filter((a) => a.visivel)
          .map((a) => {
            const ativa = aba === a.id;
            return (
              <button
                key={a.id}
                role="tab"
                aria-selected={ativa}
                onClick={() => setAba(a.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '9px 14px',
                  borderRadius: 8,
                  border: `1px solid ${ativa ? t.borderActive : t.border}`,
                  background: ativa ? `${t.accentTeal}1A` : t.surface,
                  color: ativa ? t.text : t.textSecondary,
                  fontSize: 12.5,
                  fontWeight: ativa ? 700 : 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {a.icone}
                {a.rotulo}
              </button>
            );
          })}
      </div>

      {erro && <ErrorBlock message={erro} />}
      {resumo && <FaixaAvisos avisos={resumo.avisos} />}

      {/* ── Conteúdo ───────────────────────────────────────────────────── */}
      {aba === 'visao' && (
        <AbaVisaoGeral
          carregando={carregando}
          resumo={resumo}
          evolucao={evolucao}
          compararA={compararA}
          podeVerMargem={podeVerMargem}
          cores={cores}
        />
      )}

      {aba !== 'visao' && erroAba && <ErrorBlock message={erroAba} />}
      {aba !== 'visao' && carregandoAba && <LoadingBlock />}

      {aba === 'comparacao' && !carregandoAba && dimensoes && (
        <AbaComparacao dados={dimensoes} busca={buscaDimensao} setBusca={setBuscaDimensao} cores={cores} />
      )}

      {aba === 'rankings' && !carregandoAba && rankings && (
        <AbaRankings
          dados={rankings}
          busca={buscaRanking}
          setBusca={setBuscaRanking}
          podeExportar={podeExportar}
          onExportar={exportarRankings}
        />
      )}

      {aba === 'clientes' && !carregandoAba && recuperar && (
        <AbaClientes
          dados={recuperar}
          busca={buscaCliente}
          setBusca={setBuscaCliente}
          podeExportar={podeExportar}
          onExportar={exportarRecuperar}
        />
      )}

      {aba === 'foco' && !carregandoAba && foco && (
        <AbaProdutosFoco dados={foco} fabricante={fabricante} onMudou={() => void carregarAba('foco')} />
      )}

      {aba === 'metas' && !carregandoAba && metas && (
        <AbaMetas
          dados={metas}
          fabricante={fabricante}
          podeGravar={podeGravarMetas}
          periodoSugerido={periodoB}
          onMudou={() => void carregarAba('metas')}
        />
      )}

      {aba === 'margens' && !carregandoAba && margens && (
        <AbaMargens
          dados={margens}
          busca={buscaMargem}
          setBusca={setBuscaMargem}
          onAplicarBusca={() => setFiltroMargem({ busca: buscaMargem, pagina: 1 })}
          onTrocarPagina={(p) => setFiltroMargem((f) => ({ ...f, pagina: p }))}
        />
      )}

      {aba === 'acessos' && !carregandoAba && acessos && <AbaAcessos dados={acessos} />}

      {/* Rodapé de responsabilidade: a tela organiza a leitura, não decide. */}
      <p style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.6, marginTop: 20, maxWidth: 820 }}>
        Esta tela organiza a leitura comercial do fabricante; ela não altera pedidos, faturamento nem cadastro de
        origem. Correções precisam ser feitas na fonte e reimportadas — editar o resultado aqui não resolveria a
        divergência, só a esconderia. {isAdminRole(papel) ? 'Como administrador, você enxerga todos os fabricantes do catálogo.' : ''}
      </p>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Cabeçalho
// ─────────────────────────────────────────────────────────────────────────────
const Cabecalho: React.FC<{ fabricante: string | null }> = ({ fabricante }) => {
  const { t } = useTheme();
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <Factory size={22} color={t.primary} />
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: t.text }}>Visual Fabricantes</h1>
      </div>
      <p style={{ margin: 0, fontSize: 13, color: t.textSecondary, lineHeight: 1.55, maxWidth: 860 }}>
        Desempenho e oportunidades de desenvolvimento por fabricante: valor, clientes, ticket, mix, equipes, metas e
        margens, com comparação entre dois períodos.{' '}
        {fabricante ? (
          <>
            Lendo <strong style={{ color: t.text }}>{fabricante}</strong>.
          </>
        ) : (
          'Escolha um fabricante para aprofundar.'
        )}
      </p>
    </div>
  );
};

const Atalho: React.FC<{ rotulo: string; onClick: () => void }> = ({ rotulo, onClick }) => {
  const { t } = useTheme();
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 10px',
        borderRadius: 20,
        border: `1px solid ${t.border}`,
        background: t.bgSecondary,
        color: t.textSecondary,
        fontSize: 11,
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      {rotulo}
    </button>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Aba 1 — Visão geral
// ─────────────────────────────────────────────────────────────────────────────
const AbaVisaoGeral: React.FC<{
  carregando: boolean;
  resumo: ResumoResponse | null;
  evolucao: EvolucaoResponse | null;
  compararA: boolean;
  podeVerMargem: boolean;
  cores: ReturnType<typeof useChartColors>;
}> = ({ carregando, resumo, evolucao, compararA, podeVerMargem, cores }) => {
  const { t } = useTheme();
  if (carregando) return <LoadingBlock />;
  if (!resumo) return null;

  const b = resumo.periodoB;
  const c = resumo.comparacao;

  const serie = (evolucao?.serie || []).map((p) => ({
    ...p,
    rotulo: `${MES_CURTO[p.mes - 1] ?? p.mes}/${String(p.ano).slice(2)}`,
  }));

  return (
    <>
      <Secao
        titulo={`Indicadores de ${dataBR(b.inicio)} a ${dataBR(b.fim)}`}
        descricao={
          compararA && resumo.periodoA
            ? `Comparados com ${dataBR(resumo.periodoA.inicio)} a ${dataBR(resumo.periodoA.fim)}. ` +
              'Quando o período anterior não tem base, a variação aparece como "sem base comparável" — ' +
              'nunca como queda de 100%.'
            : 'Sem período de comparação selecionado: os números são absolutos do intervalo escolhido.'
        }
      >
        {b.semDados ? (
          <BlocoIndisponivel
            titulo="Sem carga neste período"
            motivo={
              'A base não tem registros no intervalo escolhido. Isso é ausência de cobertura, e não venda zero: ' +
              'mostrar "R$ 0" aqui seria afirmar algo que a base não diz.'
            }
          />
        ) : (
          <GradeCartoes>
            <CartaoIndicador
              rotulo="Valor realizado"
              valor={b.valor}
              formato="brl"
              icone={<BadgeDollarSign size={14} />}
              delta={compararA ? c.valor : undefined}
              destaque
              nota="Soma do realizado do fabricante no recorte filtrado."
            />
            <CartaoIndicador
              rotulo="Meta da base"
              valor={b.meta || null}
              formato="brl"
              icone={<Target size={14} />}
              delta={compararA ? c.meta : undefined}
              motivoIndisponivel="Não há meta importada para este recorte."
            />
            <CartaoIndicador
              rotulo="Atingimento"
              valor={b.atingimento}
              formato="pct"
              icone={<TrendingUp size={14} />}
              motivoIndisponivel="Sem meta positiva não existe denominador: atingimento fica indisponível, não 0%."
              nota={
                b.faltaParaMeta !== null
                  ? `Falta ${fmtBRL(b.faltaParaMeta)} para a meta (superação não gera falta negativa).`
                  : undefined
              }
            />
            <CartaoIndicador
              rotulo="Clientes atendidos"
              valor={b.clientes || null}
              formato="int"
              icone={<Users size={14} />}
              delta={compararA ? c.clientes : undefined}
              motivoIndisponivel="A base não registra cobertura realizada neste recorte."
              nota="Clientes distintos por recorte; valores de recortes diferentes não se somam."
            />
            <CartaoIndicador
              rotulo="Ticket por cliente"
              valor={b.ticket}
              formato="brl"
              icone={<Activity size={14} />}
              delta={compararA ? c.ticket : undefined}
              motivoIndisponivel="Sem clientes na base, o ticket não tem denominador."
              nota="Valor dividido por clientes atendidos — não é ticket por pedido."
            />
            {podeVerMargem && (
              <CartaoIndicador
                rotulo="Margem ponderada"
                valor={b.margem}
                formato="pct"
                icone={<Percent size={14} />}
                delta={compararA ? c.margem : undefined}
                motivoIndisponivel="Nenhuma linha do período traz percentual de margem na origem."
                nota="Ponderada pelo valor: a média simples dos percentuais daria outro número e estaria errada."
              />
            )}
            <CartaoIndicador
              rotulo="Equipes no período"
              valor={b.equipes || null}
              formato="int"
              icone={<Users size={14} />}
              motivoIndisponivel="Sem vínculo de equipe nas linhas deste recorte."
            />
            <CartaoIndicador
              rotulo="Vendedores no período"
              valor={b.vendedores || null}
              formato="int"
              icone={<Users size={14} />}
              motivoIndisponivel="Sem vendedores com movimento neste recorte."
            />
          </GradeCartoes>
        )}

        <div style={{ marginTop: 14, fontSize: 11.5, color: t.textMuted, lineHeight: 1.6 }}>
          Regra de soma aplicada:{' '}
          <strong style={{ color: t.textSecondary }}>
            {b.precedencia === 'ultima_carga' ? 'carga mais recente de cada mês' : 'soma de todas as datas'}
          </strong>{' '}
          · {fmtInt(b.datasComCarga.length)} datas com carga no período.
        </div>
        <Fontes fontes={resumo.fontes} />
      </Secao>

      <Secao
        titulo="Evolução mensal e acumulado"
        descricao={
          'Meta e realizado mês a mês, com a linha do acumulado. Só aparece o que já aconteceu: nenhum ponto é ' +
          'projetado, porque projeção apresentada como realizado induz a erro.'
        }
      >
        {!serie.length ? (
          <BlocoIndisponivel
            titulo="Sem série para este período"
            motivo="Não há meses com carga dentro do intervalo escolhido."
          />
        ) : (
          <div style={{ width: '100%', height: 320 }}>
            <ResponsiveContainer>
              <ComposedChart data={serie} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
                <CartesianGrid stroke={cores.grid} vertical={false} />
                <XAxis dataKey="rotulo" tick={{ fill: cores.axis, fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis
                  tickFormatter={fmtBRLShort}
                  tick={{ fill: cores.axis, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={78}
                />
                <Tooltip content={<ChartTooltip valueFormatter={(v) => fmtBRL(v)} />} cursor={{ fill: `${cores.grid}66` }} />
                <Bar dataKey="meta" name="Meta" fill={cores.target} radius={[3, 3, 0, 0]} />
                <Bar dataKey="realizado" name="Realizado" fill={cores.series[0]} radius={[3, 3, 0, 0]} />
                <Line
                  type="monotone"
                  dataKey="acumuladoRealizado"
                  name="Acumulado realizado"
                  stroke={cores.series[2]}
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
        <Fontes fontes={evolucao?.fontes} />
      </Secao>
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Aba 2 — Comparação por dimensão
// ─────────────────────────────────────────────────────────────────────────────
const AbaComparacao: React.FC<{
  dados: DimensoesResponse;
  busca: string;
  setBusca: (v: string) => void;
  cores: ReturnType<typeof useChartColors>;
}> = ({ dados, busca, setBusca, cores }) => {
  const { t } = useTheme();
  const termo = busca.trim().toLowerCase();

  // A busca precisa valer para a TABELA e para o GRÁFICO ao mesmo tempo
  // (RF-013): se filtrasse só a tabela, os dois contariam histórias diferentes.
  const categoriasFiltradas = useMemo(
    () => dados.categorias.filter((c) => !termo || c.nome.toLowerCase().includes(termo)),
    [dados.categorias, termo]
  );
  const linhasFiltradas = useMemo(
    () =>
      dados.linhas.filter(
        (l) => !termo || l.nome.toLowerCase().includes(termo) || l.categoria.toLowerCase().includes(termo)
      ),
    [dados.linhas, termo]
  );

  const linhaTabela = (item: (typeof dados.equipes)[number]) => (
    <tr key={item.chave}>
      <Td forte>{item.rotulo}</Td>
      <Td align="right" numero>
        {formatar(item.valor.anterior, 'brl')}
      </Td>
      <Td align="right" numero forte>
        {formatar(item.valor.atual, 'brl')}
      </Td>
      <Td align="right">
        <SeloVariacao delta={item.valor} formato="brl" />
      </Td>
      <Td align="right" numero>
        {item.clientesB ? fmtInt(item.clientesB) : TRACO}
      </Td>
      <Td align="center">
        <SeloMovimento movimento={item.movimento} />
      </Td>
    </tr>
  );

  return (
    <>
      <FaixaAvisos avisos={dados.avisos} />

      <Secao
        titulo="Equipes"
        descricao={
          dados.comparouPeriodos
            ? 'Comparação por chave da equipe: quem entrou, quem saiu e quem mudou de patamar. Diferença de total ' +
              'não diz quais equipes entraram — por isso o movimento vem explícito em cada linha.'
            : 'Sem período de comparação: apenas os valores do período analisado.'
        }
      >
        {!dados.equipes.length ? (
          <BlocoIndisponivel
            titulo={dados.estruturaInterna === false ? 'Fora desta visão' : 'Sem equipes no recorte'}
            motivo={
              dados.estruturaInterna === false
                ? 'Equipes e vendedores descrevem a estrutura comercial da CHOK e não compõem a visão do representante do fabricante.'
                : 'Nenhuma equipe com movimento neste período.'
            }
          />
        ) : (
          <Tabela>
            <thead>
              <tr>
                <Th>Equipe</Th>
                <Th align="right">Período A</Th>
                <Th align="right">Período B</Th>
                <Th align="right">Variação</Th>
                <Th align="right">Clientes (B)</Th>
                <Th align="center">Movimento</Th>
              </tr>
            </thead>
            <tbody>{dados.equipes.map(linhaTabela)}</tbody>
          </Tabela>
        )}
      </Secao>

      <Secao
        titulo="Vendedores"
        descricao="Mesma leitura por código do vendedor. A identidade é o código, não o nome: nomes repetidos não são fundidos."
      >
        {!dados.vendedores.length ? (
          <BlocoIndisponivel
            titulo={dados.estruturaInterna === false ? 'Fora desta visão' : 'Sem vendedores no recorte'}
            motivo={
              dados.estruturaInterna === false
                ? 'O desempenho individual da equipe comercial é informação interna da CHOK.'
                : 'Nenhum vendedor com movimento neste período.'
            }
          />
        ) : (
          <Tabela>
            <thead>
              <tr>
                <Th>Vendedor</Th>
                <Th align="right">Período A</Th>
                <Th align="right">Período B</Th>
                <Th align="right">Variação</Th>
                <Th align="right">Clientes (B)</Th>
                <Th align="center">Movimento</Th>
              </tr>
            </thead>
            <tbody>{dados.vendedores.slice(0, 100).map(linhaTabela)}</tbody>
          </Tabela>
        )}
      </Secao>

      <Secao
        titulo="Categorias e linhas do portfólio"
        descricao={
          'Vem da Lista de Sortimento: descreve o portfólio do fabricante (quantos SKUs por categoria e linha). ' +
          'Essa base não carrega valor por período, então aqui não há comparação A/B — e dizer isso é mais útil ' +
          'do que exibir zeros.'
        }
        acoes={
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              border: `1px solid ${t.border}`,
              borderRadius: 8,
              padding: '7px 12px',
              background: t.bgSecondary,
            }}
          >
            <Search size={14} color={t.textMuted} />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar categoria ou linha..."
              aria-label="Buscar categoria ou linha"
              style={{
                border: 'none',
                outline: 'none',
                background: 'transparent',
                color: t.text,
                fontSize: 12.5,
                width: 210,
              }}
            />
          </div>
        }
      >
        {!dados.categorias.length ? (
          <BlocoIndisponivel
            titulo="Sortimento não importado para este fabricante"
            motivo="Sem a Lista de Sortimento não há como listar categorias e linhas deste fabricante."
          />
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))',
              gap: 16,
            }}
          >
            <div style={{ height: 300 }}>
              <ResponsiveContainer>
                <BarChart
                  data={categoriasFiltradas.slice(0, 12)}
                  layout="vertical"
                  margin={{ top: 4, right: 16, bottom: 4, left: 4 }}
                >
                  <CartesianGrid stroke={cores.grid} horizontal={false} />
                  <XAxis type="number" tick={{ fill: cores.axis, fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis
                    type="category"
                    dataKey="nome"
                    width={130}
                    tick={{ fill: cores.axis, fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    content={<ChartTooltip valueFormatter={(v) => `${fmtInt(v)} SKUs`} />}
                    cursor={{ fill: `${cores.grid}66` }}
                  />
                  <Bar dataKey="skus" name="SKUs" fill={cores.series[0]} radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <Tabela minWidth={320}>
              <thead>
                <tr>
                  <Th>Linha</Th>
                  <Th>Categoria</Th>
                  <Th align="right">SKUs</Th>
                </tr>
              </thead>
              <tbody>
                {linhasFiltradas.slice(0, 60).map((l) => (
                  <tr key={`${l.categoria}-${l.nome}`}>
                    <Td forte>{l.nome}</Td>
                    <Td>{l.categoria}</Td>
                    <Td align="right" numero>
                      {fmtInt(l.skus)}
                    </Td>
                  </tr>
                ))}
                {!linhasFiltradas.length && (
                  <tr>
                    <Td>Nenhuma linha corresponde à busca.</Td>
                    <Td> </Td>
                    <Td> </Td>
                  </tr>
                )}
              </tbody>
            </Tabela>
          </div>
        )}
        <Fontes fontes={dados.fontes} />
      </Secao>
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Aba 3 — Rankings
// ─────────────────────────────────────────────────────────────────────────────
const AbaRankings: React.FC<{
  dados: RankingsResponse;
  busca: string;
  setBusca: (v: string) => void;
  podeExportar: boolean;
  onExportar: () => void;
}> = ({ dados, busca, setBusca, podeExportar, onExportar }) => {
  const { t } = useTheme();
  const termo = busca.trim().toLowerCase();

  const filtrar = (itens: ItemRanking[]): ItemRanking[] =>
    itens.filter(
      (i) =>
        !termo ||
        i.nome.toLowerCase().includes(termo) ||
        String(i.chave).toLowerCase().includes(termo) ||
        i.equipe.toLowerCase().includes(termo)
    );

  const vendedores = filtrar(dados.vendedores.itens);
  const clientes = filtrar(dados.clientes.itens);

  const bloco = (
    titulo: string,
    descricao: string,
    itens: ItemRanking[],
    total: number,
    extra?: (item: ItemRanking) => React.ReactNode
  ) => {
    const maximo = itens[0]?.valor || 0;
    const destacados = itens.slice(0, dados.destaque);
    return (
      <Secao titulo={titulo} descricao={descricao}>
        {!itens.length ? (
          <BlocoIndisponivel
            titulo="Sem grupos positivos"
            motivo="Nenhum grupo com valor final positivo neste recorte. Grupos zerados ou negativos não entram no ranking."
          />
        ) : (
          <>
            <Tabela>
              <thead>
                <tr>
                  <Th width={46} align="right">
                    #
                  </Th>
                  <Th>Nome</Th>
                  <Th>Equipe</Th>
                  <Th align="right">Valor</Th>
                  <Th width={110}> </Th>
                  <Th align="right">Participação</Th>
                  {extra && <Th align="center">Detalhe</Th>}
                </tr>
              </thead>
              <tbody>
                {destacados.map((item, i) => (
                  <tr key={item.chave}>
                    <Td align="right" numero>
                      {i + 1}
                    </Td>
                    <Td forte>{item.nome}</Td>
                    <Td>{item.equipe}</Td>
                    <Td align="right" numero forte>
                      {fmtBRL(item.valor)}
                    </Td>
                    <Td>
                      <BarraProporcao valor={item.valor} maximo={maximo} destaque={i < 3} />
                    </Td>
                    <Td align="right" numero>
                      {item.participacao === null ? TRACO : fmtPct(item.participacao)}
                    </Td>
                    {extra && <Td align="center">{extra(item)}</Td>}
                  </tr>
                ))}
              </tbody>
            </Tabela>
            <div style={{ marginTop: 10, fontSize: 11.5, color: t.textMuted, lineHeight: 1.6 }}>
              Exibindo {fmtInt(destacados.length)} de {fmtInt(itens.length)} grupos positivos · total do recorte{' '}
              <span className="num">{fmtBRL(total)}</span>. {dados.observacao}
            </div>
          </>
        )}
      </Secao>
    );
  };

  return (
    <>
      <div
        style={{
          display: 'flex',
          gap: 10,
          marginBottom: 14,
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            border: `1px solid ${t.border}`,
            borderRadius: 8,
            padding: '8px 12px',
            background: t.surface,
            flex: '1 1 260px',
            maxWidth: 380,
          }}
        >
          <Search size={15} color={t.textMuted} />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, código ou equipe..."
            aria-label="Buscar no ranking"
            style={{ border: 'none', outline: 'none', background: 'transparent', color: t.text, width: '100%' }}
          />
        </div>
        {podeExportar && (
          <Botao variante="primario" onClick={onExportar}>
            <Download size={15} />
            Exportar Excel (todos os grupos)
          </Botao>
        )}
      </div>

      {dados.vendedores.indisponivel ? (
        <Secao titulo="Vendedores" descricao="Ranking por vendedor no período.">
          <BlocoIndisponivel titulo="Fora desta visão" motivo={dados.vendedores.indisponivel} />
        </Secao>
      ) : (
        bloco(
          'Vendedores',
          `A tela destaca os ${dados.destaque} primeiros; a exportação leva todos os grupos positivos. ` +
            'A participação usa o valor total do recorte, não apenas o dos destacados.',
          vendedores,
          dados.vendedores.total
        )
      )}

      {dados.clientes.indisponivel ? (
        <Secao titulo="Clientes e redes" descricao="Ranking de clientes do fabricante no período.">
          <BlocoIndisponivel titulo="Ranking de clientes indisponível" motivo={dados.clientes.indisponivel} />
        </Secao>
      ) : (
        bloco(
          'Clientes e redes',
          'Cliente explicitamente marcado como rede fica identificado na coluna de detalhe; ausência de vínculo ' +
            'não é tratada como "sem rede".',
          clientes,
          dados.clientes.total,
          (item) =>
            item.rede ? (
              <span style={{ fontSize: 11, fontWeight: 700, color: t.accentBlue }}>Rede</span>
            ) : (
              <span style={{ fontSize: 11, color: t.textMuted }}>{TRACO}</span>
            )
        )
      )}
      <Fontes fontes={dados.fontes} />
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Aba 4 — Clientes a recuperar
// ─────────────────────────────────────────────────────────────────────────────
const AbaClientes: React.FC<{
  dados: RecuperarResponse;
  busca: string;
  setBusca: (v: string) => void;
  podeExportar: boolean;
  onExportar: () => void;
}> = ({ dados, busca, setBusca, podeExportar, onExportar }) => {
  const { t } = useTheme();
  const termo = busca.trim().toLowerCase();
  const oportunidades = dados.oportunidades.filter(
    (o) =>
      !termo ||
      o.nome.toLowerCase().includes(termo) ||
      o.codigo.toLowerCase().includes(termo) ||
      o.vendedorEmA.toLowerCase().includes(termo) ||
      o.equipeEmA.toLowerCase().includes(termo)
  );
  const semPositivacao = dados.semPositivacao.itens.filter(
    (c) => !termo || c.nome.toLowerCase().includes(termo) || c.codigo.toLowerCase().includes(termo)
  );

  return (
    <>
      <div
        style={{
          display: 'flex',
          gap: 10,
          marginBottom: 14,
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            border: `1px solid ${t.border}`,
            borderRadius: 8,
            padding: '8px 12px',
            background: t.surface,
            flex: '1 1 260px',
            maxWidth: 380,
          }}
        >
          <Search size={15} color={t.textMuted} />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar cliente, código, vendedor ou equipe..."
            aria-label="Buscar cliente"
            style={{ border: 'none', outline: 'none', background: 'transparent', color: t.text, width: '100%' }}
          />
        </div>
        {podeExportar && (
          <Botao variante="primario" onClick={onExportar}>
            <Download size={15} />
            Exportar Excel
          </Botao>
        )}
      </div>

      <Secao
        titulo="Oportunidades de recuperação"
        descricao={
          `Clientes com compra em ${dataBR(dados.periodoA.inicio)}–${dataBR(dados.periodoA.fim)} e sem recompra em ` +
          `${dataBR(dados.periodoB.inicio)}–${dataBR(dados.periodoB.fim)}. A recompra é conferida em toda a base do ` +
          'fabricante, não só na carteira do vendedor anterior: quem voltou a comprar com outro vendedor não ' +
          'aparece aqui como perdido.'
        }
      >
        {dados.indisponivel ? (
          <BlocoIndisponivel titulo="Cruzamento indisponível nesta carga" motivo={dados.indisponivel} />
        ) : !oportunidades.length ? (
          <BlocoIndisponivel
            titulo="Nenhuma oportunidade neste recorte"
            motivo="Todos os clientes com compra no período anterior voltaram a comprar no período analisado."
          />
        ) : (
          <>
            <Tabela>
              <thead>
                <tr>
                  <Th>Cliente</Th>
                  <Th>Código</Th>
                  <Th>Vendedor em A</Th>
                  <Th>Equipe em A</Th>
                  <Th>Última compra</Th>
                  <Th align="right">Valor em A</Th>
                </tr>
              </thead>
              <tbody>
                {oportunidades.slice(0, 300).map((o) => (
                  <tr key={o.codigo}>
                    <Td forte>{o.nome}</Td>
                    <Td numero>{o.codigo}</Td>
                    <Td>{o.vendedorEmA}</Td>
                    <Td>{o.equipeEmA}</Td>
                    <Td numero>{dataBR(o.ultimaCompra)}</Td>
                    <Td align="right" numero forte>
                      {fmtBRL(o.valorEmA)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Tabela>
            <div style={{ marginTop: 10, fontSize: 11.5, color: t.warning, lineHeight: 1.6 }}>{dados.observacao}</div>
          </>
        )}
      </Secao>

      <Secao
        titulo="Clientes sem positivação no fabricante"
        descricao={
          'Leitura independente, vinda da base de Não Positivados. Útil mesmo quando o cruzamento acima está ' +
          'indisponível, porque não depende de comparar dois períodos.'
        }
      >
        {dados.semPositivacao.indisponivel && !semPositivacao.length ? (
          <BlocoIndisponivel titulo="Sem dados de positivação" motivo={dados.semPositivacao.indisponivel} />
        ) : (
          <Tabela>
            <thead>
              <tr>
                <Th>Cliente</Th>
                <Th>Código</Th>
                <Th>Município</Th>
                <Th>Vendedor</Th>
                <Th>Equipe</Th>
                <Th align="right">Valor de referência</Th>
              </tr>
            </thead>
            <tbody>
              {semPositivacao.slice(0, 300).map((c) => (
                <tr key={c.codigo}>
                  <Td forte>{c.nome}</Td>
                  <Td numero>{c.codigo}</Td>
                  <Td>{c.municipio}</Td>
                  <Td>{c.vendedor}</Td>
                  <Td>{c.equipe}</Td>
                  <Td align="right" numero>
                    {c.valor ? fmtBRL(c.valor) : TRACO}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Tabela>
        )}
        <Fontes fontes={dados.fontes} />
      </Secao>
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Aba 5 — Produtos foco
// ─────────────────────────────────────────────────────────────────────────────
const AbaProdutosFoco: React.FC<{
  dados: ProdutosFocoResponse;
  fabricante: string;
  onMudou: () => void;
}> = ({ dados, fabricante, onMudou }) => {
  const { t } = useTheme();
  const [codigo, setCodigo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [metaClientes, setMetaClientes] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const salvar = async () => {
    if (!fabricante) {
      setErro('Escolha um fabricante antes de cadastrar um produto foco.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await salvarProdutoFoco({
        fabricante,
        codProduto: codigo.trim(),
        descricao: descricao.trim() || undefined,
        metaClientes: Number(metaClientes) || 0,
      });
      setCodigo('');
      setDescricao('');
      setMetaClientes('');
      onMudou();
    } catch (err) {
      setErro(getErrorMessage(err, 'Falha ao salvar o produto foco.'));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Secao
      titulo="Produtos foco"
      descricao={
        'Itens acompanhados neste fabricante, com a referência de clientes de CADA um. As coberturas não se ' +
        'somam: o mesmo cliente pode contar em vários produtos, então sete coberturas não formam uma carteira única.'
      }
    >
      <FaixaAvisos avisos={dados.avisos} />

      {dados.podeEditar && (
        <div
          style={{
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
            alignItems: 'flex-end',
            padding: '12px 14px',
            borderRadius: 10,
            background: t.bgSecondary,
            border: `1px solid ${t.border}`,
            marginBottom: 14,
          }}
        >
          <CampoTexto rotulo="Código do produto" valor={codigo} onChange={setCodigo} largura={150} />
          <CampoTexto rotulo="Descrição (opcional)" valor={descricao} onChange={setDescricao} largura={240} />
          <CampoTexto
            rotulo="Clientes de referência"
            valor={metaClientes}
            onChange={setMetaClientes}
            largura={150}
            tipo="number"
          />
          <Botao variante="primario" onClick={salvar} disabled={salvando || !codigo.trim()}>
            <Plus size={15} />
            {salvando ? 'Salvando...' : 'Adicionar item'}
          </Botao>
        </div>
      )}

      {erro && <ErrorBlock message={erro} />}

      {!dados.itens.length ? (
        <BlocoIndisponivel
          titulo="Nenhum produto foco cadastrado"
          motivo={
            dados.podeEditar
              ? 'Cadastre os itens que este fabricante quer acompanhar e a referência de clientes de cada um.'
              : 'Este fabricante ainda não tem itens foco definidos pela gestão.'
          }
        />
      ) : (
        <Tabela>
          <thead>
            <tr>
              <Th>Produto</Th>
              <Th>Código</Th>
              <Th>Categoria</Th>
              <Th align="right">Clientes de referência</Th>
              <Th align="right">Clientes atendidos</Th>
              {dados.podeEditar && <Th align="center">Ações</Th>}
            </tr>
          </thead>
          <tbody>
            {dados.itens.map((item) => (
              <tr key={item.id}>
                <Td forte>{item.descricao || TRACO}</Td>
                <Td numero>{item.codProduto}</Td>
                <Td>{item.categoria || TRACO}</Td>
                <Td align="right" numero>
                  {fmtInt(item.metaClientes)}
                </Td>
                <Td align="right" numero>
                  {item.clientesAtendidos === null ? (
                    <span title="Depende de venda no nível do produto, que ainda não é carregada.">{TRACO}</span>
                  ) : (
                    fmtInt(item.clientesAtendidos)
                  )}
                </Td>
                {dados.podeEditar && (
                  <Td align="center">
                    <Botao
                      variante="perigo"
                      titulo="Retirar do acompanhamento"
                      onClick={async () => {
                        await removerProdutoFoco(item.id);
                        onMudou();
                      }}
                    >
                      <Trash2 size={14} />
                    </Botao>
                  </Td>
                )}
              </tr>
            ))}
          </tbody>
        </Tabela>
      )}
      <Fontes fontes={dados.fontes} />
    </Secao>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Aba 6 — Metas
// ─────────────────────────────────────────────────────────────────────────────
const AbaMetas: React.FC<{
  dados: MetasResponse;
  fabricante: string;
  podeGravar: boolean;
  periodoSugerido: Intervalo;
  onMudou: () => void;
}> = ({ dados, fabricante, podeGravar, periodoSugerido, onMudou }) => {
  const { t } = useTheme();
  const [inicio, setInicio] = useState(periodoSugerido.inicio);
  const [fim, setFim] = useState(periodoSugerido.fim);
  const [valor, setValor] = useState('');
  const [cobertura, setCobertura] = useState('');
  const [observacao, setObservacao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const salvar = async () => {
    if (!fabricante) {
      setErro('Escolha um fabricante antes de gravar a meta: a meta pertence ao fabricante e às datas exatas.');
      return;
    }
    setSalvando(true);
    setErro(null);
    setAviso(null);
    try {
      const r = await gravarMeta({
        fabricante,
        inicio,
        fim,
        metaValor: Number(valor.replace(/\./g, '').replace(',', '.')) || 0,
        metaCobertura: cobertura ? Number(cobertura) : null,
        observacao: observacao.trim() || undefined,
      });
      setValor('');
      setCobertura('');
      setObservacao('');
      if (r.aviso) setAviso(r.aviso);
      onMudou();
    } catch (err) {
      setErro(getErrorMessage(err, 'Falha ao gravar a meta.'));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Secao
      titulo="Metas financeiras por fabricante"
      descricao={dados.observacao}
      acoes={
        <span style={{ fontSize: 11.5, color: t.textMuted }}>
          Gravadas no servidor: aparecem em qualquer sessão e aparelho.
        </span>
      }
    >
      {podeGravar ? (
        <div
          style={{
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
            alignItems: 'flex-end',
            padding: '12px 14px',
            borderRadius: 10,
            background: t.bgSecondary,
            border: `1px solid ${t.border}`,
            marginBottom: 14,
          }}
        >
          <CampoData rotulo="Início" valor={inicio} onChange={setInicio} />
          <CampoData rotulo="Fim" valor={fim} onChange={setFim} />
          <CampoTexto rotulo="Meta de valor (R$)" valor={valor} onChange={setValor} largura={160} />
          <CampoTexto
            rotulo="Meta de clientes (opcional)"
            valor={cobertura}
            onChange={setCobertura}
            largura={160}
            tipo="number"
          />
          <CampoTexto rotulo="Observação" valor={observacao} onChange={setObservacao} largura={220} />
          <Botao variante="primario" onClick={salvar} disabled={salvando || !valor}>
            <Target size={15} />
            {salvando ? 'Gravando...' : 'Gravar meta'}
          </Botao>
        </div>
      ) : (
        <FaixaAvisos
          tom="info"
          avisos={[
            'Este perfil lê as metas do próprio fabricante, mas não grava. A gravação é uma capacidade da gestão.',
          ]}
        />
      )}

      {erro && <ErrorBlock message={erro} />}
      {aviso && <FaixaAvisos avisos={[aviso]} />}

      {!dados.metas.length ? (
        <BlocoIndisponivel
          titulo="Nenhuma meta cadastrada"
          motivo={
            'Sem meta cadastrada o atingimento fica indisponível na visão geral — e não 0%, que seria afirmar ' +
            'um desempenho que ninguém mediu.'
          }
        />
      ) : (
        <Tabela>
          <thead>
            <tr>
              <Th>Fabricante</Th>
              <Th>Início</Th>
              <Th>Fim</Th>
              <Th align="right">Meta de valor</Th>
              <Th align="right">Meta de clientes</Th>
              <Th>Observação</Th>
              <Th>Responsável</Th>
              {podeGravar && <Th align="center">Ações</Th>}
            </tr>
          </thead>
          <tbody>
            {dados.metas.map((m) => (
              <tr key={m.id}>
                <Td forte>{m.fabricante}</Td>
                <Td numero>{dataBR(m.inicio)}</Td>
                <Td numero>{dataBR(m.fim)}</Td>
                <Td align="right" numero forte>
                  {fmtBRL(m.metaValor)}
                </Td>
                <Td align="right" numero>
                  {m.metaCobertura === null ? TRACO : fmtInt(m.metaCobertura)}
                </Td>
                <Td>{m.observacao || TRACO}</Td>
                <Td>{m.criadoPor || TRACO}</Td>
                {podeGravar && (
                  <Td align="center">
                    <Botao
                      variante="perigo"
                      titulo="Remover meta"
                      onClick={async () => {
                        await removerMeta(m.id);
                        onMudou();
                      }}
                    >
                      <Trash2 size={14} />
                    </Botao>
                  </Td>
                )}
              </tr>
            ))}
          </tbody>
        </Tabela>
      )}
    </Secao>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Aba 7 — Margens (só chega aqui quem tem margin.view)
// ─────────────────────────────────────────────────────────────────────────────
const AbaMargens: React.FC<{
  dados: MargensResponse;
  busca: string;
  setBusca: (v: string) => void;
  /** Aplica o texto digitado e volta para a primeira página. */
  onAplicarBusca: () => void;
  onTrocarPagina: (pagina: number) => void;
}> = ({ dados, busca, setBusca, onAplicarBusca, onTrocarPagina }) => {
  const { t } = useTheme();

  return (
    <Secao
      titulo="Margens — visão administrativa"
      descricao={
        'Informação restrita: este bloco não existe para o perfil de fornecedor, e os campos de margem nem saem ' +
        'do servidor para quem não tem permissão. Não é um campo escondido na tela.'
      }
      acoes={
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              border: `1px solid ${t.border}`,
              borderRadius: 8,
              padding: '7px 12px',
              background: t.bgSecondary,
            }}
          >
            <Search size={14} color={t.textMuted} />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onAplicarBusca();
              }}
              placeholder="Buscar vendedor, código, equipe..."
              aria-label="Buscar margem"
              style={{
                border: 'none',
                outline: 'none',
                background: 'transparent',
                color: t.text,
                fontSize: 12.5,
                width: 200,
              }}
            />
          </div>
          <Botao onClick={onAplicarBusca}>
            <RefreshCw size={14} />
            Buscar
          </Botao>
        </div>
      }
    >
      <GradeCartoes min={240}>
        <CartaoIndicador
          rotulo="Margem ponderada do recorte"
          valor={dados.margemPonderada}
          formato="pct"
          icone={<Percent size={14} />}
          destaque
          motivoIndisponivel="Nenhuma linha do período traz percentual na origem: o denominador ponderado é zero."
          nota="Soma(percentual × valor) ÷ soma dos valores elegíveis."
        />
        <CartaoIndicador
          rotulo="Valor com margem informada"
          valor={dados.valorComMargem || null}
          formato="brl"
          icone={<BadgeDollarSign size={14} />}
          motivoIndisponivel="Nenhum valor elegível para ponderação neste recorte."
          nota="Só este valor entra na ponderação — o restante não tem percentual na origem."
        />
      </GradeCartoes>

      <div style={{ marginTop: 14 }}>
        <Tabela>
          <thead>
            <tr>
              <Th>Fabricante</Th>
              <Th>Vendedor</Th>
              <Th>Código</Th>
              <Th>Equipe</Th>
              <Th align="right">Valor</Th>
              <Th align="right">Valor com margem</Th>
              <Th align="right">Margem</Th>
            </tr>
          </thead>
          <tbody>
            {dados.itens.map((m) => (
              <tr key={`${m.fabricante}-${m.codigo}`}>
                <Td>{m.fabricante}</Td>
                <Td forte>{m.nome}</Td>
                <Td numero>{m.codigo}</Td>
                <Td>{m.equipe}</Td>
                <Td align="right" numero>
                  {fmtBRL(m.valor)}
                </Td>
                <Td align="right" numero>
                  {m.valorComMargem ? fmtBRL(m.valorComMargem) : TRACO}
                </Td>
                <Td align="right" numero forte>
                  {m.margem === null ? (
                    <span title="Percentual ausente na origem — não é 0%.">{TRACO}</span>
                  ) : (
                    fmtPct(m.margem)
                  )}
                </Td>
              </tr>
            ))}
            {!dados.itens.length && (
              <tr>
                <Td>Nenhuma linha neste recorte.</Td>
                <Td> </Td>
                <Td> </Td>
                <Td> </Td>
                <Td> </Td>
                <Td> </Td>
                <Td> </Td>
              </tr>
            )}
          </tbody>
        </Tabela>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 10,
          marginTop: 12,
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: 11.5, color: t.textMuted }}>
          Página {fmtInt(dados.pagina)} de {fmtInt(dados.paginas)} · {fmtInt(dados.total)} agrupamentos ·{' '}
          {fmtInt(dados.porPagina)} por página
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <Botao disabled={dados.pagina <= 1} onClick={() => onTrocarPagina(dados.pagina - 1)}>
            <ChevronLeft size={14} />
            Anterior
          </Botao>
          <Botao disabled={dados.pagina >= dados.paginas} onClick={() => onTrocarPagina(dados.pagina + 1)}>
            Próxima
            <ChevronRight size={14} />
          </Botao>
        </div>
      </div>

      <Fontes fontes={dados.fontes} extra={dados.observacao} />
    </Secao>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Aba 8 — Histórico de acessos
// ─────────────────────────────────────────────────────────────────────────────
const AbaAcessos: React.FC<{ dados: AcessosResponse }> = ({ dados }) => {
  const { t } = useTheme();
  return (
    <Secao
      titulo="Histórico de acessos"
      descricao={
        dados.escopoCompleto
          ? 'Consultas registradas nesta tela: quem abriu, qual fabricante, quando e com qual resultado.'
          : 'Você está vendo apenas os próprios acessos.'
      }
    >
      {!dados.eventos.length ? (
        <BlocoIndisponivel
          titulo="Nenhum acesso registrado"
          motivo="Ainda não houve consultas registradas para este recorte."
        />
      ) : (
        <Tabela>
          <thead>
            <tr>
              <Th>Quando</Th>
              <Th>Usuário</Th>
              <Th>Perfil</Th>
              <Th>Fabricante</Th>
              <Th>Recurso</Th>
              <Th>Resultado</Th>
              <Th>Origem</Th>
            </tr>
          </thead>
          <tbody>
            {dados.eventos.map((e) => (
              <tr key={e.id}>
                <Td numero>
                  {e.ocorridoEm ? new Date(e.ocorridoEm).toLocaleString('pt-BR') : TRACO}
                </Td>
                <Td forte>{e.usuario || TRACO}</Td>
                <Td>{e.papel || TRACO}</Td>
                <Td>{e.fabricante || TRACO}</Td>
                <Td>{e.recurso || TRACO}</Td>
                <Td>
                  <span style={{ color: e.sucesso ? t.success : t.danger, fontWeight: 700, fontSize: 11.5 }}>
                    {e.sucesso ? 'permitido' : 'negado'}
                  </span>
                </Td>
                <Td numero>{e.origemChave || TRACO}</Td>
              </tr>
            ))}
          </tbody>
        </Tabela>
      )}
      <Fontes extra={dados.observacao} />
    </Secao>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Campo de texto simples usado nos formulários desta tela
// ─────────────────────────────────────────────────────────────────────────────
const CampoTexto: React.FC<{
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
  largura?: number;
  tipo?: 'text' | 'number';
}> = ({ rotulo, valor, onChange, largura = 180, tipo = 'text' }) => {
  const { t } = useTheme();
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      <span style={{ fontSize: 10.5, color: t.textMuted, fontWeight: 600 }}>{rotulo}</span>
      <input
        type={tipo}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: '7px 10px',
          borderRadius: 8,
          border: `1px solid ${t.border}`,
          background: t.surface,
          color: t.text,
          fontSize: 12.5,
          width: largura,
          maxWidth: '100%',
        }}
      />
    </label>
  );
};

export default VisualFabricantesPage;
