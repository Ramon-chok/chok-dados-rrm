import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/common/DataState';
import { SingleSelectFilter } from '../../components/common/SingleSelectFilter';
import { MultiSelectFilter } from '../../components/common/MultiSelectFilter';
import { BaseRoteiroPonto, BaseRoteiroResponse, fetchBaseRoteiro, getErrorMessage } from '../../lib/api';
import {
  AlertCircle,
  BarChart3,
  Building2,
  CalendarDays,
  Crosshair,
  Eye,
  EyeOff,
  Layers,
  MapPin,
  Palette,
  Repeat,
  Route,
  Search,
} from 'lucide-react';
import { podeFiltrarEquipe, podeFiltrarVendedor } from '../../types';

/* ------------------------------------------------------------------ *
 * Cores
 *
 * A paleta vem da referência de data-viz e foi VALIDADA para a forma de
 * dispersão (--pairs all: num mapa qualquer par de cores pode cair lado a
 * lado). O resultado da validação define o desenho desta tela:
 *
 *  - Só 4 matizes passam todos os pares nos dois temas (slots 1,4,5,6 —
 *    azul/amarelo/magenta/verde). Nenhum conjunto de 5 passa o piso de visão
 *    normal (o melhor fica em ΔE 11,9, abaixo do mínimo de 15). Por isso o
 *    agrupamento NOMINAL (vendedor, equipe, semana) usa 4 cores fixas + um
 *    cinza neutro de "Outros" — nunca se gera/cicla um 5º matiz.
 *  - "Dia" é ORDINAL (segunda→sexta), então usa o trabalho de cor certo para
 *    dado ordenado: rampa sequencial de um único matiz, clara→escura. Isso
 *    acomoda os 5 dias sem cair no limite do caso nominal.
 *
 * Em todos os casos a identidade NÃO fica só na cor: a legenda está sempre
 * presente com a contagem, o popup do ponto nomeia tudo e a tabela abaixo do
 * mapa lista as linhas filtradas.
 * ------------------------------------------------------------------ */

/** Slots 1,4,5,6 da paleta de referência — único conjunto de 4 que passa --pairs all nos dois temas. */
const CAT_COLORS = {
  light: ['#2a78d6', '#eda100', '#e87ba4', '#008300'],
  dark: ['#3987e5', '#c98500', '#d55181', '#008300'],
} as const;

/** Cinza neutro de "Outros" — nunca é um matiz da paleta categórica. */
const OUTROS_COLOR = { light: '#8b8b86', dark: '#7d7d78' } as const;

/** Rampa sequencial (um matiz, clara→escura) para o dia da semana, que é ordinal. */
const SEQ_COLORS = {
  light: ['#8fbdf0', '#5c9ce8', '#2a78d6', '#1d5aa6', '#123c73'],
  dark: ['#a9cdf5', '#6ba6ec', '#3987e5', '#2a6ab5', '#1c4a82'],
} as const;

/**
 * Quantas categorias usam os matizes VALIDADOS antes de entrar o gerador.
 *
 * Os 4 primeiros vêm da paleta de referência, que é a única combinação que
 * passa a validação de distinguibilidade em TODOS os pares (num mapa qualquer
 * par de cores pode cair lado a lado). Daí em diante as cores são geradas —
 * ver `corGerada`.
 */
const CAT_VALIDADAS = 4;

/* --- Gerador de tons em OKLCH -------------------------------------- *
 *
 * OKLCH (e não HSL) porque aqui luminosidade e croma precisam ser
 * PERCEPTUAIS: em HSL, "50% de luz" num amarelo e num azul resultam em cores
 * de clareza muito diferente, e metade dos tons saía fora da faixa legível ou
 * lavada a ponto de parecer cinza. A primeira versão disto era em HSL e o
 * validador reprovou — havia tom gerado a ΔE 1,6 do azul da paleta fixa,
 * praticamente a mesma cor.
 * ------------------------------------------------------------------ */

const SRGB_GAMMA = (v: number): number =>
  v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;

function oklchParaRgb(L: number, C: number, hGraus: number): [number, number, number] {
  const h = (hGraus * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/** OKLCH → hex, baixando o croma até a cor caber no sRGB (em vez de "clipar",
 *  que distorceria o matiz). Devolve também o croma que sobrou. */
function oklchParaHex(L: number, C: number, h: number): { hex: string; c: number } {
  let c = C;
  for (let i = 0; i < 60; i++) {
    const rgb = oklchParaRgb(L, c, h);
    if (rgb.every((v) => v >= -0.0005 && v <= 1.0005)) break;
    c -= 0.003;
    if (c <= 0) {
      c = 0;
      break;
    }
  }
  const rgb = oklchParaRgb(L, c, h).map((v) =>
    Math.round(Math.min(1, Math.max(0, SRGB_GAMMA(v))) * 255)
  );
  return { hex: `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`, c };
}

/** Abaixo disto a cor "lê como cinza" e se confunde com o ponto sem dado. */
const CROMA_MIN = 0.105;

/**
 * Matiz inicial dos tons gerados. 335° não é arbitrário: testei os 72
 * deslocamentos de 5 em 5 graus medindo, em cada um, a menor distância entre
 * QUALQUER par de cores (num mapa dois pontos de qualquer categoria podem
 * ficar lado a lado). 335° foi o que deu a maior distância mínima.
 */
const MATIZ_INICIAL = 335;

/**
 * Cor da enésima categoria depois das 4 validadas.
 *
 * O matiz avança pelo ÂNGULO ÁUREO (137,508°): cada tom novo cai no maior
 * espaço vazio que restou no círculo cromático, então 20, 50 ou 80 setores
 * ficam o mais espalhados possível, sem repetir tom.
 *
 * Só o matiz não basta — depois de uma volta inteira, matizes vizinhos voltam
 * a se aproximar. Por isso a luminosidade alterna em três faixas: dois tons
 * de matiz próximo caem em faixas diferentes e seguem separáveis por clareza,
 * não só por cor. Quando o matiz não sustenta croma no sRGB naquela
 * luminosidade (ciano e teal, tipicamente), tenta as outras faixas antes de
 * aceitar uma cor lavada.
 *
 * AVISO HONESTO: acima de 4 cores simultâneas num mapa, NENHUMA paleta passa
 * o piso de distinguibilidade — o melhor conjunto de 5 que existe fica em
 * ΔE 11,9, abaixo do mínimo de 15. Com dezenas de setores, tons vizinhos VÃO
 * se parecer; aqui o pior par fica em ΔE ~5. Por isso a identidade nunca
 * depende só da cor: legenda com contagem, popup do ponto e a tabela abaixo
 * nomeiam cada um.
 */
function corGerada(indice: number, isDark: boolean): string {
  const h = (MATIZ_INICIAL + indice * 137.508) % 360;
  const faixa = indice % 3;
  // A faixa útil do tema escuro é mais estreita (L ~0,48–0,67) que a do claro
  // (0,43–0,77): usar a mesma reprovava metade dos tons no escuro.
  const bandas = isDark ? [0.62, 0.54, 0.66] : [0.56, 0.48, 0.64];
  const C = [0.15, 0.14, 0.13][faixa];
  const ordem = [bandas[faixa], ...bandas.filter((_, k) => k !== faixa)];
  let melhor: { hex: string; c: number } | null = null;
  for (const L of ordem) {
    const r = oklchParaHex(L, C, h);
    if (r.c >= CROMA_MIN) return r.hex;
    if (!melhor || r.c > melhor.c) melhor = r;
  }
  return melhor!.hex;
}

/** Categorias que representam AUSÊNCIA de dado — sempre neutras, nunca um tom. */
const CATEGORIAS_VAZIAS = new Set(['Sem vendedor', 'Sem equipe', 'Sem dia', 'Sem semana']);

/**
 * Estilo do marcador que depende da camada de fundo escolhida.
 *
 * O anel separa pontos sobrepostos, então precisa contrastar com o MAPA e não
 * com o tema da página. Sobre satélite a imagem é visualmente "ruidosa":
 * opacidade cheia mantém o ponto legível; sobre mapa de ruas um leve alfa
 * deixa a via aparecer por baixo.
 */
function estiloPorFundo(id: BasemapId): { anelCor: string; anelPeso: number; opacidade: number } {
  const escuro = !!BASEMAPS[id].escuro;
  return {
    anelCor: escuro ? '#F1F1F6' : '#FFFFFF',
    anelPeso: escuro ? 1.5 : 2,
    opacidade: id === 'satelite' ? 1 : 0.9,
  };
}

/** Acima disto o rótulo dentro do ponto fica ilegível e pesado — só pontos. */
const MAX_PONTOS_COM_ROTULO = 400;

// A planilha usa a convenção 2=segunda ... 6=sexta (1=domingo, 7=sábado).
const DIA_LABEL: Record<number, string> = {
  1: 'Domingo',
  2: 'Segunda',
  3: 'Terça',
  4: 'Quarta',
  5: 'Quinta',
  6: 'Sexta',
  7: 'Sábado',
};

const DIA_CURTO: Record<number, string> = {
  1: 'Dom', 2: 'Seg', 3: 'Ter', 4: 'Qua', 5: 'Qui', 6: 'Sex', 7: 'Sáb',
};

type ColorirPor = 'vendedor' | 'equipe' | 'dia' | 'semana';

const COLORIR_LABEL: Record<ColorirPor, string> = {
  vendedor: 'Vendedor / setor',
  equipe: 'Equipe',
  dia: 'Dia da semana',
  semana: 'Semana do mês',
};

/** Centro inicial do mapa quando não há nenhum ponto geocodificado (Brasil). */
const FALLBACK_CENTER: [number, number] = [-14.235, -51.925];

/* ------------------------------------------------------------------ *
 * Camadas de fundo do mapa
 *
 * Todas SEM chave de API — de propósito. O basemap escuro da CARTO, usado
 * antes, passou a exigir API key e começou a servir os tiles carimbados com
 * "API KEY REQUIRED". Aqui só entram fontes que funcionam sem cadastro:
 *   - OpenStreetMap (URL canônica, sem os subdomínios {s}, hoje depreciados);
 *   - Esri World Imagery, para o satélite.
 * Preto-e-branco e escuro reaproveitam os tiles do OSM com filtro CSS, em vez
 * de depender de mais um serviço.
 * ------------------------------------------------------------------ */

const OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const ESRI_ATTR = '&copy; <a href="https://www.esri.com">Esri</a>';
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services';

type BasemapId =
  | 'padrao'
  | 'esri_ruas'
  | 'humanitario'
  | 'cicloturismo'
  | 'topografico'
  | 'esri_topo'
  | 'fisico'
  | 'satelite'
  | 'satelite_ruas'
  | 'cinza_claro'
  | 'cinza_escuro'
  | 'pb'
  | 'escuro'
  | 'sepia'
  | 'natgeo'
  | 'oceanos';

interface BasemapCfg {
  label: string;
  /** Agrupamento exibido no seletor. */
  grupo: string;
  url: string;
  attribution: string;
  maxZoom: number;
  /** Classe CSS aplicada ao container de tiles (filtro de cor). */
  className?: string;
  /** true = fundo escuro: controles e anel dos pontos se adaptam. */
  escuro?: boolean;
  /** Camadas de referência desenhadas POR CIMA da base (ruas, nomes). */
  overlays?: string[];
}

/**
 * Todos os estilos disponíveis — e todos SEM chave de API.
 *
 * Cada endereço foi testado antes de entrar aqui (HTTP 200 e imagem de
 * verdade). Ficaram de fora, de propósito, os provedores que passaram a
 * exigir cadastro: CARTO (que devolvia os tiles carimbados com "API KEY
 * REQUIRED", o problema original) e Stamen, hoje servido pela Stadia.
 *
 * Preto-e-branco, escuro e sépia não são serviços novos: reaproveitam os
 * tiles do OSM com filtro CSS, sem requisição adicional.
 */
const BASEMAPS: Record<BasemapId, BasemapCfg> = {
  padrao: {
    label: 'Mapa padrão',
    grupo: 'Ruas',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: OSM_ATTR,
    maxZoom: 19,
  },
  esri_ruas: {
    label: 'Ruas (Esri)',
    grupo: 'Ruas',
    url: `${ESRI}/World_Street_Map/MapServer/tile/{z}/{y}/{x}`,
    attribution: ESRI_ATTR,
    maxZoom: 19,
  },
  humanitario: {
    label: 'Humanitário (HOT)',
    grupo: 'Ruas',
    url: 'https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    attribution: `${OSM_ATTR}, tiles Humanitarian OSM Team`,
    maxZoom: 19,
  },
  cicloturismo: {
    label: 'Ciclovias',
    grupo: 'Ruas',
    url: 'https://a.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png',
    attribution: `${OSM_ATTR}, tiles CyclOSM`,
    maxZoom: 19,
  },

  satelite: {
    label: 'Satélite',
    grupo: 'Satélite',
    url: `${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`,
    attribution: `Imagens ${ESRI_ATTR}, Maxar, Earthstar Geographics`,
    maxZoom: 19,
    escuro: true,
  },
  satelite_ruas: {
    label: 'Satélite com ruas',
    grupo: 'Satélite',
    url: `${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`,
    attribution: `Imagens ${ESRI_ATTR}, Maxar, Earthstar Geographics`,
    maxZoom: 19,
    escuro: true,
    // Camadas de referência da própria Esri: vias e nomes por cima da imagem.
    overlays: [
      `${ESRI}/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}`,
      `${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`,
    ],
  },

  topografico: {
    label: 'Topográfico',
    grupo: 'Relevo',
    url: 'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: `${OSM_ATTR}, SRTM | tiles OpenTopoMap (CC-BY-SA)`,
    // OpenTopoMap não gera tiles acima do zoom 17.
    maxZoom: 17,
  },
  esri_topo: {
    label: 'Topográfico (Esri)',
    grupo: 'Relevo',
    url: `${ESRI}/World_Topo_Map/MapServer/tile/{z}/{y}/{x}`,
    attribution: ESRI_ATTR,
    maxZoom: 19,
  },
  fisico: {
    label: 'Relevo físico',
    grupo: 'Relevo',
    url: `${ESRI}/World_Physical_Map/MapServer/tile/{z}/{y}/{x}`,
    attribution: ESRI_ATTR,
    // O World_Physical_Map só existe até o zoom 8.
    maxZoom: 8,
  },

  cinza_claro: {
    label: 'Cinza claro',
    grupo: 'Neutros',
    url: `${ESRI}/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`,
    attribution: ESRI_ATTR,
    maxZoom: 16,
  },
  cinza_escuro: {
    label: 'Cinza escuro',
    grupo: 'Neutros',
    url: `${ESRI}/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`,
    attribution: ESRI_ATTR,
    maxZoom: 16,
    escuro: true,
  },
  pb: {
    label: 'Preto e branco',
    grupo: 'Neutros',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: OSM_ATTR,
    maxZoom: 19,
    className: 'mapa-tiles-cinza',
  },
  escuro: {
    label: 'Escuro',
    grupo: 'Neutros',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: OSM_ATTR,
    maxZoom: 19,
    className: 'mapa-tiles-escuro',
    escuro: true,
  },
  sepia: {
    label: 'Sépia',
    grupo: 'Neutros',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: OSM_ATTR,
    maxZoom: 19,
    className: 'mapa-tiles-sepia',
  },

  natgeo: {
    label: 'National Geographic',
    grupo: 'Temáticos',
    url: `${ESRI}/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}`,
    attribution: `${ESRI_ATTR}, National Geographic`,
    maxZoom: 16,
  },
  oceanos: {
    label: 'Oceanos',
    grupo: 'Temáticos',
    url: `${ESRI}/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}`,
    attribution: `${ESRI_ATTR}, GEBCO, NOAA`,
    maxZoom: 13,
  },
};

const BASEMAP_ORDEM: BasemapId[] = [
  'padrao', 'esri_ruas', 'humanitario', 'cicloturismo',
  'satelite', 'satelite_ruas',
  'topografico', 'esri_topo', 'fisico',
  'cinza_claro', 'cinza_escuro', 'pb', 'escuro', 'sepia',
  'natgeo', 'oceanos',
];

/* ------------------------------------------------------------------ *
 * Roteirização
 * ------------------------------------------------------------------ */

/**
 * Um ponto está roteirizado quando tem dia E semana de visita.
 *
 * Na planilha de origem o cliente sem roteiro vem com "-" em DIA, SEMANA e
 * FREQUÊNCIA. "-" em coluna numérica/semana já é convertido para vazio na
 * importação; em FREQUÊNCIA (texto) o "-" é gravado como veio, por isso a
 * verificação aqui olha dia/semana, que são as colunas confiáveis.
 */
function estaRoteirizado(p: BaseRoteiroPonto): boolean {
  return p.dia !== null && !!p.semana;
}

/** Frequência exibível: trata "-" e vazio como ausência de roteiro. */
function frequenciaLabel(p: BaseRoteiroPonto): string {
  const f = (p.frequencia || '').trim();
  if (!f || f === '-' || !estaRoteirizado(p)) return 'Não roteirizado';
  return f.toUpperCase();
}

/** Ordem de leitura das frequências (da mais intensa para a ausência). */
const FREQ_ORDEM = ['SEMANAL', 'QUINZENAL', 'MENSAL', 'Não roteirizado'];

/** Quantas cidades o gráfico de cidades mostra. */
const MAX_CIDADES_GRAFICO = 12;

function nomeCliente(p: BaseRoteiroPonto): string {
  return p.nomeFantasia || p.razaoSocial || p.codCliente || '—';
}

/** Escapa texto que vai para o HTML do popup do Leaflet (vem de planilha). */
function esc(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Base de Roteiro (SAR) — mapa dos clientes roteirizados, alimentado pela
 * importação "Base de Roteiro" (tabela base_roteiro, ver
 * src/pages/admin/Metas.tsx).
 *
 * A tabela é um snapshot por data_referencia: o seletor "Importação" troca
 * entre as bases já enviadas, e a tela abre na mais recente. Os pontos vêm de
 * uma vez e o filtro acontece no cliente, para o mapa responder sem ida ao
 * servidor a cada ajuste.
 */
export const BaseRoteiroPage: React.FC = () => {
  const { t, mode } = useTheme();
  const { currentUser } = useAuth();
  const isDark = mode === 'dark';

  const role = currentUser?.role;
  const canFilterVendedor = podeFiltrarVendedor(role);
  const canFilterEquipe = podeFiltrarEquipe(role);

  const [data, setData] = useState<string>('');
  const [resp, setResp] = useState<BaseRoteiroResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [colorirPor, setColorirPor] = useState<ColorirPor>('vendedor');
  // Camada de fundo escolhida pelo usuário. Começa acompanhando o tema, mas
  // é preferência própria a partir daí (trocar o tema não desfaz a escolha).
  const [basemap, setBasemap] = useState<BasemapId>(() => (isDark ? 'escuro' : 'padrao'));
  /** Espelho em ref: o efeito que cria o mapa precisa saber a escolha atual
   *  sem depender dela (depender recriaria o mapa inteiro a cada troca). */
  const basemapRef = useRef<BasemapId>(basemap);
  const basemapCfg = BASEMAPS[basemap];
  /** Fundo escuro (noturno ou satélite) manda nos controles e no anel dos pontos. */
  const fundoEscuro = !!basemapCfg.escuro;
  const [selectedVendedor, setSelectedVendedor] = useState('');
  const [selectedEquipe, setSelectedEquipe] = useState('');
  const [selectedMunicipio, setSelectedMunicipio] = useState('');
  const [selectedDias, setSelectedDias] = useState<string[]>([]);
  const [selectedSemanas, setSelectedSemanas] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  /** Categorias escondidas pelo clique na legenda. */
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  /**
   * Legenda começa RECOLHIDA: com dezenas de vendedores ela virava uma
   * parede de nomes entre os filtros e o mapa. Fica atrás de um botão, que
   * preserva o filtro por clique de quem precisa dele.
   */
  const [legendaVisivel, setLegendaVisivel] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const payload = await fetchBaseRoteiro({ data: data || undefined });
        if (!mounted) return;
        setResp(payload);
        // Primeira carga: fixa o snapshot que o servidor escolheu, para o
        // seletor refletir a base que está na tela.
        if (!data && payload.data) setData(payload.data);
      } catch (e) {
        if (mounted) setError(getErrorMessage(e, 'Falha ao carregar a Base de Roteiro'));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [data]);

  const rows = resp?.rows ?? [];
  const filtros = resp?.filtros;

  // Trocar o critério de cor reinicia o que a legenda escondeu (as categorias
  // são outras).
  useEffect(() => {
    setHidden(new Set());
  }, [colorirPor, data]);

  /* ---------------------------------------------------------------- *
   * Categoria de cada ponto + atribuição de cor
   * ---------------------------------------------------------------- */

  const categoriaDe = React.useCallback(
    (p: BaseRoteiroPonto): string => {
      switch (colorirPor) {
        case 'vendedor':
          return p.vendedor || p.codVendedor || 'Sem vendedor';
        case 'equipe':
          return p.equipe || 'Sem equipe';
        case 'dia':
          return p.dia === null ? 'Sem dia' : String(p.dia);
        case 'semana':
          return p.semana || 'Sem semana';
      }
    },
    [colorirPor]
  );

  /**
   * Ordem estável das categorias, calculada sobre o snapshot INTEIRO (não
   * sobre o resultado filtrado): assim filtrar por equipe/cidade nunca
   * repinta os pontos que sobraram — a cor segue a entidade.
   */
  const categorias = useMemo(() => {
    const contagem = new Map<string, number>();
    rows.forEach((p) => {
      const c = categoriaDe(p);
      contagem.set(c, (contagem.get(c) || 0) + 1);
    });
    const chaves = Array.from(contagem.keys());
    if (colorirPor === 'dia') {
      // Ordinal: segunda → sexta, "Sem dia" no fim.
      chaves.sort((a, b) => {
        if (a === 'Sem dia') return 1;
        if (b === 'Sem dia') return -1;
        return Number(a) - Number(b);
      });
    } else {
      chaves.sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
    }
    return chaves.map((chave) => ({ chave, total: contagem.get(chave) || 0 }));
  }, [rows, categoriaDe, colorirPor]);

  const corDaCategoria = useMemo(() => {
    const paleta = isDark ? CAT_COLORS.dark : CAT_COLORS.light;
    const rampa = isDark ? SEQ_COLORS.dark : SEQ_COLORS.light;
    const outros = isDark ? OUTROS_COLOR.dark : OUTROS_COLOR.light;
    const map = new Map<string, string>();

    if (colorirPor === 'dia') {
      // Rampa sequencial: o passo acompanha a posição ordinal do dia.
      const comDia = categorias.filter((c) => c.chave !== 'Sem dia');
      comDia.forEach((c, i) => {
        map.set(c.chave, rampa[Math.min(i, rampa.length - 1)]);
      });
      map.set('Sem dia', outros);
      return map;
    }

    // Nominal: TODA categoria ganha tom próprio. As 4 primeiras usam os
    // matizes validados (melhor separação possível) e as seguintes são
    // geradas por ângulo áureo — nenhum setor fica mais no cinza de "Outros".
    // O índice vem da ordem estável calculada sobre o snapshot inteiro, então
    // filtrar não repinta os pontos que sobraram.
    let geradas = 0;
    categorias.forEach((c, i) => {
      if (CATEGORIAS_VAZIAS.has(c.chave)) {
        // Ausência de dado continua neutra: não é um setor, é um buraco.
        map.set(c.chave, outros);
        return;
      }
      map.set(c.chave, i < CAT_VALIDADAS ? paleta[i] : corGerada(geradas, isDark));
      if (i >= CAT_VALIDADAS) geradas++;
    });
    return map;
  }, [categorias, colorirPor, isDark]);

  // Legenda com TODAS as categorias (cada uma tem tom próprio agora). Pode
  // ficar longa — por isso a faixa tem altura limitada e rolagem própria.
  const legenda = useMemo(() => {
    const outros = isDark ? OUTROS_COLOR.dark : OUTROS_COLOR.light;
    return categorias.map((c) => ({
      chave: c.chave,
      rotulo: colorirPor === 'dia' && c.chave !== 'Sem dia' ? DIA_LABEL[Number(c.chave)] || c.chave : c.chave,
      cor: corDaCategoria.get(c.chave) || outros,
      total: c.total,
    }));
  }, [categorias, corDaCategoria, colorirPor, isDark]);

  /* ---------------------------------------------------------------- *
   * Filtros (no cliente)
   * ---------------------------------------------------------------- */

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((p) => {
      if (selectedVendedor && p.codVendedor !== selectedVendedor) return false;
      if (selectedEquipe && p.equipe !== selectedEquipe) return false;
      if (selectedMunicipio && p.municipio !== selectedMunicipio) return false;
      if (selectedDias.length > 0 && !selectedDias.includes(p.dia === null ? 'Sem dia' : String(p.dia))) return false;
      if (selectedSemanas.length > 0 && !selectedSemanas.includes(p.semana || 'Sem semana')) return false;
      if (q) {
        const alvo = `${p.codCliente || ''} ${p.razaoSocial || ''} ${p.nomeFantasia || ''} ${p.endereco || ''} ${p.bairro || ''}`;
        if (!alvo.toLowerCase().includes(q)) return false;
      }
      // Legenda: categoria escondida sai do mapa e da tabela.
      const cat = categoriaDe(p);
      if (hidden.has(cat)) return false;
      return true;
    });
  }, [
    rows,
    query,
    selectedVendedor,
    selectedEquipe,
    selectedMunicipio,
    selectedDias,
    selectedSemanas,
    hidden,
    categoriaDe,
  ]);

  /** Só os pontos que têm coordenada vão para o mapa. */
  const pontosNoMapa = useMemo(
    () => filtrados.filter((p) => p.latitude !== null && p.longitude !== null),
    [filtrados]
  );

  const resumo = useMemo(() => {
    const clientes = new Set<string>();
    const vendedores = new Set<string>();
    const cidades = new Set<string>();
    filtrados.forEach((p) => {
      if (p.codCliente) clientes.add(p.codCliente);
      if (p.codVendedor) vendedores.add(p.codVendedor);
      if (p.municipio) cidades.add(p.municipio);
    });
    return {
      pontos: filtrados.length,
      noMapa: pontosNoMapa.length,
      semCoordenada: filtrados.length - pontosNoMapa.length,
      clientes: clientes.size,
      vendedores: vendedores.size,
      cidades: cidades.size,
    };
  }, [filtrados, pontosNoMapa]);

  /* ---------------------------------------------------------------- *
   * Mapa (Leaflet)
   * ---------------------------------------------------------------- */

  // Callback ref (e não useRef): o container do mapa só é montado depois do
  // carregamento, então um efeito com dependência vazia rodaria antes do div
  // existir e o mapa nunca seria criado. Guardar o elemento em estado faz os
  // efeitos abaixo rodarem no commit em que ele aparece.
  const [mapEl, setMapEl] = useState<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  /**
   * Contador incrementado toda vez que um mapa novo nasce.
   *
   * Os efeitos de tiles e de pontos liam `mapRef.current` mas dependiam só de
   * `mapEl`. Com o StrictMode do React (ativo em src/main.tsx), o efeito de
   * criação roda, é desfeito e roda de novo no mesmo commit: o mapa final é o
   * SEGUNDO, mas os efeitos seguintes não tinham nada nas dependências que
   * mudasse entre os dois, então podiam ficar amarrados ao primeiro — que já
   * foi destruído. Resultado: trocar a camada não surtia efeito nenhum.
   * Com o contador em ESTADO, eles sempre rodam contra o mapa vivo.
   */
  const [mapVersion, setMapVersion] = useState(0);
  /**
   * As QUATRO camadas de fundo, criadas uma única vez junto com o mapa.
   *
   * Antes a camada era criada/destruída por um efeito que dependia da escolha
   * do usuário. Além de frágil (ver mapVersion acima), isso recriava a camada
   * do zero a cada clique. Agora as quatro existem desde o início e a troca é
   * só um add/remove no mapa — instantâneo e sem efeito nenhum envolvido.
   */
  const tilesRef = useRef<Record<BasemapId, L.LayerGroup> | null>(null);
  /** Qual delas está no mapa agora (fonte da verdade do lado do Leaflet). */
  const basemapAtivoRef = useRef<BasemapId | null>(null);
  /** Último estilo de ponto aplicado, para não reestilizar à toa. */
  const estiloPontoRef = useRef<string>('');
  const layerRef = useRef<L.LayerGroup | null>(null);
  // Renderer de canvas: com milhares de pontos o SVG do Leaflet trava no
  // pan/zoom; no canvas o desenho é de uma vez só.
  const rendererRef = useRef<L.Canvas | null>(null);
  /** Evita refazer o fitBounds a cada repintura (só quando o recorte muda). */
  const lastFitRef = useRef<string>('');

  // Cria o mapa quando (e só quando) o container entra na árvore.
  useEffect(() => {
    if (!mapEl || mapRef.current) return;
    const map = L.map(mapEl, {
      center: FALLBACK_CENTER,
      zoom: 4,
      preferCanvas: true,
      zoomControl: true,
      attributionControl: true,
      // minZoom/maxZoom EXPLÍCITOS no mapa — esta é a correção do travamento.
      //
      // Sem eles, o Leaflet recalcula os limites de zoom a cada camada que
      // entra ou sai (_updateZoomLevels). Como os 16 estilos têm tetos
      // diferentes (19, 17, 16, 13, 8), toda troca mudava o alcance de zoom:
      // disparava `zoomlevelschange` e, quando o teto novo era menor que o
      // zoom atual, um `setZoom` animado. Cada um desses eventos faz o canvas
      // REPROJETAR os 6.800 pontos (Canvas._onZoomEnd percorre todos os
      // caminhos) — era isso que congelava a tela a cada clique.
      //
      // Com o alcance fixo, o vão de zoom nunca muda, o evento não dispara e
      // a troca passa a ser só add/remove de tiles. O teto real de cada
      // provedor vai em maxNativeZoom (abaixo), que faz o Leaflet ampliar o
      // último nível disponível em vez de limitar o mapa inteiro.
      minZoom: 3,
      maxZoom: 19,
    });
    rendererRef.current = L.canvas({ padding: 0.5 });
    layerRef.current = L.layerGroup().addTo(map);

    // Cria TODAS as camadas agora e guarda; a troca depois é só add/remove.
    // Cada estilo é um LayerGroup (base + eventuais camadas de referência),
    // para "satélite com ruas" entrar e sair como uma coisa só.
    // Camada não adicionada ao mapa não cria DOM nem baixa tile (o Leaflet só
    // inicializa no onAdd), então ter as 16 prontas não custa requisição.
    const tiles = {} as Record<BasemapId, L.LayerGroup>;
    (Object.keys(BASEMAPS) as BasemapId[]).forEach((id) => {
      const cfg = BASEMAPS[id];
      const base = L.tileLayer(cfg.url, {
        attribution: cfg.attribution,
        // maxNativeZoom (e não maxZoom): "este provedor só tem tiles até
        // aqui; acima disso, amplie o último nível". Assim um basemap de
        // baixa resolução não restringe o zoom do mapa — e não mexe nos
        // limites de zoom, que é o que causava o travamento.
        maxNativeZoom: cfg.maxZoom,
        maxZoom: 19,
        // O filtro de cor vai em className porque o Leaflet aplica essa classe
        // no CONTAINER DOS TILES (`'leaflet-layer ' + options.className`). Os
        // pontos ficam em outro pane (o canvas do overlayPane), então os
        // marcadores não são filtrados junto.
        className: cfg.className || '',
      });
      const camadas: L.Layer[] = [base];
      (cfg.overlays || []).forEach((url) => {
        camadas.push(
          L.tileLayer(url, {
            maxNativeZoom: cfg.maxZoom,
            maxZoom: 19,
            className: cfg.className || '',
          })
        );
      });
      tiles[id] = L.layerGroup(camadas);
    });
    tilesRef.current = tiles;
    tiles[basemapRef.current].addTo(map);
    basemapAtivoRef.current = basemapRef.current;

    mapRef.current = map;
    setMapVersion((v) => v + 1);
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      tilesRef.current = null;
      basemapAtivoRef.current = null;
      rendererRef.current = null;
      lastFitRef.current = '';
    };
  }, [mapEl]);

  /**
   * Troca a camada de fundo DIRETO no Leaflet.
   *
   * Imperativo de propósito: a versão anterior fazia isso num useEffect com
   * `[basemapCfg, mapVersion]` nas dependências e, com a remontagem dupla do
   * StrictMode, a camada podia acabar aplicada a um mapa já descartado — o
   * clique mudava o botão e o mapa ficava igual. Aqui o clique age no mapa
   * vivo na hora, e o estado do React serve só para destacar o botão.
   */
  const aplicarBasemap = React.useCallback((id: BasemapId) => {
    basemapRef.current = id;
    const map = mapRef.current;
    const tiles = tilesRef.current;
    if (!map || !tiles) return;
    if (basemapAtivoRef.current === id) return;
    const anterior = basemapAtivoRef.current;
    if (anterior && tiles[anterior]) map.removeLayer(tiles[anterior]);
    tiles[id].addTo(map);
    basemapAtivoRef.current = id;
  }, []);

  const trocarBasemap = (id: BasemapId) => {
    setBasemap(id);
    aplicarBasemap(id);
  };

  /**
   * Reestiliza os marcadores JÁ EXISTENTES quando a camada de fundo muda.
   *
   * setStyle percorre os pontos e troca só o anel e a opacidade — muito mais
   * barato que destruir e recriar milhares de círculos, que era o que o
   * redesenho completo fazia a cada clique no seletor (daí o travamento).
   */
  useEffect(() => {
    const grupo = layerRef.current;
    if (!grupo) return;
    const { anelCor, anelPeso, opacidade } = estiloPorFundo(basemap);
    // A maioria das trocas não muda o estilo do ponto (de "Mapa padrão" para
    // "Ruas (Esri)", por exemplo, os dois são fundos claros). Nesses casos
    // nem percorre os milhares de marcadores.
    const assinatura = `${anelCor}|${anelPeso}|${opacidade}`;
    if (estiloPontoRef.current === assinatura) return;
    estiloPontoRef.current = assinatura;
    grupo.eachLayer((l) => {
      // O grupo também tem os rótulos (L.marker), que não têm setStyle.
      if (l instanceof L.CircleMarker) {
        l.setStyle({ color: anelCor, weight: anelPeso, fillOpacity: opacidade });
      }
    });
    // Sem `pontosNoMapa` nas dependências de propósito: marcador novo já nasce
    // com o estilo da camada atual (ver estiloPorFundo no redesenho), então
    // incluí-lo só repetiria o setStyle em milhares de pontos a cada filtro.
  }, [basemap, mapVersion]);

  // Redesenha os pontos quando o filtro, a cor ou o tema mudam.
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    // Estilo que depende do FUNDO DO MAPA é lido do ref, não das dependências:
    // trocar a camada não pode custar o redesenho dos milhares de marcadores
    // (era a origem do travamento). Um efeito separado, logo abaixo, ajusta o
    // estilo dos marcadores já existentes quando a camada muda.
    const { anelCor, anelPeso, opacidade } = estiloPorFundo(basemapRef.current);
    estiloPontoRef.current = `${anelCor}|${anelPeso}|${opacidade}`;
    const outros = isDark ? OUTROS_COLOR.dark : OUTROS_COLOR.light;
    // Rótulo dentro do ponto (identidade sem depender da cor) só quando há
    // poucos pontos — acima disso vira mancha ilegível.
    const comRotulo = pontosNoMapa.length <= MAX_PONTOS_COM_ROTULO && colorirPor !== 'vendedor';

    pontosNoMapa.forEach((p) => {
      const cat = categoriaDe(p);
      const cor = corDaCategoria.get(cat) || outros;
      const latlng: [number, number] = [p.latitude as number, p.longitude as number];

      const marker = L.circleMarker(latlng, {
        renderer: rendererRef.current || undefined,
        radius: 6,
        color: anelCor,
        weight: anelPeso,
        fillColor: cor,
        fillOpacity: opacidade,
      });

      // Conteúdo como FUNÇÃO: o Leaflet só a chama quando o popup abre. Antes
      // o HTML de todos os pontos era montado de uma vez — milhares de
      // template literals a cada redesenho, por popups que quase nunca abrem.
      marker.bindPopup(() => {
        const dia = p.dia !== null ? `${p.dia} — ${DIA_LABEL[p.dia] || 'Dia ' + p.dia}` : null;
        return `<div style="font-size:12.5px;line-height:1.5;min-width:210px">
           <div style="font-weight:700;margin-bottom:4px">${esc(nomeCliente(p))}</div>
           <div style="opacity:.75">Código ${esc(p.codCliente)}</div>
           <hr style="margin:6px 0;border:none;border-top:1px solid rgba(128,128,128,.35)" />
           <div><b>Vendedor:</b> ${esc(p.vendedor)} (${esc(p.codVendedor)})</div>
           <div><b>Equipe:</b> ${esc(p.equipe)}</div>
           <div><b>Cidade:</b> ${esc(p.municipio)}</div>
           <div><b>Bairro:</b> ${esc(p.bairro)}</div>
           <div><b>Endereço:</b> ${esc(p.endereco)}</div>
           <hr style="margin:6px 0;border:none;border-top:1px solid rgba(128,128,128,.35)" />
           <div><b>Dia:</b> ${esc(dia)}</div>
           <div><b>Semana:</b> ${esc(p.semana)}</div>
           <div><b>Sequência:</b> ${esc(p.sequencia)}</div>
           <div><b>Frequência:</b> ${esc(p.frequencia)}</div>
         </div>`;
      });
      marker.addTo(layer);

      if (comRotulo) {
        const texto =
          colorirPor === 'dia'
            ? p.dia !== null
              ? String(p.dia)
              : '?'
            : (p.semana || '?').replace(/\s/g, '');
        L.marker(latlng, {
          interactive: false,
          keyboard: false,
          icon: L.divIcon({
            className: '',
            html: `<span style="font:700 10px/1 ui-sans-serif,system-ui;color:${anelCor};text-shadow:0 0 2px ${cor}">${esc(
              texto
            )}</span>`,
            iconSize: [22, 10],
            iconAnchor: [11, 5],
          }),
        }).addTo(layer);
      }
    });

    // Enquadra os pontos quando o RECORTE muda — não a cada troca de cor/tema
    // nem ao ligar/desligar uma categoria na legenda (re-enquadrar a cada
    // clique na legenda faria o mapa "pular" embaixo do usuário).
    const fitKey = `${data}|${selectedVendedor}|${selectedEquipe}|${selectedMunicipio}|${selectedDias.join()}|${selectedSemanas.join()}|${query}|${rows.length}`;
    if (fitKey !== lastFitRef.current) {
      lastFitRef.current = fitKey;
      if (pontosNoMapa.length > 0) {
        const bounds = L.latLngBounds(
          pontosNoMapa.map((p) => [p.latitude as number, p.longitude as number] as [number, number])
        );
        map.fitBounds(bounds, { padding: [32, 32], maxZoom: 15 });
      } else {
        map.setView(FALLBACK_CENTER, 4);
      }
    }
    // Leaflet precisa recalcular o tamanho quando o container aparece/muda.
    map.invalidateSize();
  }, [
    // mapVersion (e não mapEl): garante que o redesenho aconteça no mapa vivo
    // mesmo com a remontagem dupla do StrictMode.
    mapVersion,
    pontosNoMapa,
    rows.length,
    categoriaDe,
    corDaCategoria,
    colorirPor,
    isDark,
    data,
    selectedVendedor,
    selectedEquipe,
    selectedMunicipio,
    selectedDias,
    selectedSemanas,
    query,
  ]);

  /* ---------------------------------------------------------------- *
   * Dados dos gráficos
   *
   * TUDO deriva de `filtrados` — o mesmo conjunto que alimenta o mapa e a
   * tabela. Então qualquer filtro (equipe, vendedor, cidade, dia, semana,
   * busca, legenda) move os números junto, sem nova ida ao servidor.
   *
   * Contagem: "cliente" é cod_cliente DISTINTO (a base repete o cliente uma
   * vez por dia/semana de visita, e às vezes entre vendedores); "visita
   * planejada" é a linha em si. Cada gráfico diz qual dos dois está medindo.
   * ---------------------------------------------------------------- */

  /** Clientes distintos, separados entre roteirizados e sem roteiro. */
  const roteirizacao = useMemo(() => {
    const comRota = new Set<string>();
    const todos = new Set<string>();
    filtrados.forEach((p) => {
      const c = p.codCliente;
      if (!c) return;
      todos.add(c);
      if (estaRoteirizado(p)) comRota.add(c);
    });
    const roteirizados = comRota.size;
    const total = todos.size;
    return {
      total,
      roteirizados,
      // Um cliente conta como "sem roteiro" quando NENHUMA das linhas dele
      // tem dia/semana — não basta ter uma linha "-" entre várias válidas.
      semRota: total - roteirizados,
      pct: total > 0 ? roteirizados / total : 0,
    };
  }, [filtrados]);

  /** Clientes distintos por frequência de visita. */
  const porFrequencia = useMemo(() => {
    const porCliente = new Map<string, string>();
    filtrados.forEach((p) => {
      const c = p.codCliente;
      if (!c) return;
      const f = frequenciaLabel(p);
      // Se o cliente aparece com e sem roteiro, vale a frequência real.
      const atual = porCliente.get(c);
      if (!atual || atual === 'Não roteirizado') porCliente.set(c, f);
    });
    const cont = new Map<string, number>();
    porCliente.forEach((f) => cont.set(f, (cont.get(f) || 0) + 1));
    const conhecidas = FREQ_ORDEM.filter((f) => cont.has(f)).map((f) => ({
      freq: f,
      clientes: cont.get(f) || 0,
    }));
    // Qualquer frequência fora da lista conhecida entra depois, por tamanho.
    const extras = Array.from(cont.entries())
      .filter(([f]) => !FREQ_ORDEM.includes(f))
      .sort((a, b) => b[1] - a[1])
      .map(([freq, clientes]) => ({ freq, clientes }));
    return [...conhecidas, ...extras];
  }, [filtrados]);

  /** Visitas planejadas por dia da semana (linhas, não clientes). */
  const porDia = useMemo(() => {
    const cont = new Map<number, number>();
    filtrados.forEach((p) => {
      if (p.dia === null) return;
      cont.set(p.dia, (cont.get(p.dia) || 0) + 1);
    });
    return Array.from(cont.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([dia, visitas]) => ({ dia, label: DIA_CURTO[dia] || String(dia), visitas }));
  }, [filtrados]);

  /** Cidades com mais clientes, separando roteirizados de sem roteiro. */
  const porCidade = useMemo(() => {
    const mapa = new Map<string, { comRota: Set<string>; todos: Set<string> }>();
    filtrados.forEach((p) => {
      const cidade = p.municipio || 'Sem cidade';
      const c = p.codCliente;
      if (!c) return;
      let e = mapa.get(cidade);
      if (!e) {
        e = { comRota: new Set(), todos: new Set() };
        mapa.set(cidade, e);
      }
      e.todos.add(c);
      if (estaRoteirizado(p)) e.comRota.add(c);
    });
    return Array.from(mapa.entries())
      .map(([cidade, e]) => ({
        cidade,
        roteirizados: e.comRota.size,
        semRota: e.todos.size - e.comRota.size,
        total: e.todos.size,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, MAX_CIDADES_GRAFICO);
  }, [filtrados]);

  /* Cores dos gráficos — mesma paleta validada do mapa, com um significado
     fixo em todos eles: azul = roteirizado, amarelo = sem roteiro. Os dois
     são slots da paleta que passam a validação em qualquer combinação. */
  const corOk = isDark ? CAT_COLORS.dark[0] : CAT_COLORS.light[0];
  const corSemRota = isDark ? CAT_COLORS.dark[1] : CAT_COLORS.light[1];
  const rampaDia = isDark ? SEQ_COLORS.dark : SEQ_COLORS.light;

  /** Altura comum dos dois cartões lado a lado, para não ficarem desalinhados.
   *  Cresce com o nº de frequências (barras horizontais precisam de espaço
   *  por categoria); o gráfico de dias apenas acompanha. */
  const alturaGraficoDuplo = Math.max(170, porFrequencia.length * 46);

  const tooltipStyle: React.CSSProperties = {
    background: t.surfaceElevated,
    border: `1px solid ${t.border}`,
    borderRadius: 8,
    color: t.text,
    fontSize: 12,
  };

  /* ---------------------------------------------------------------- *
   * Opções de filtro
   * ---------------------------------------------------------------- */

  const diaOptions = (filtros?.dias ?? []).map((d) => String(d));
  const semanaOptions = filtros?.semanas ?? [];

  const toggleLegenda = (chave: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(chave)) next.delete(chave);
      else next.add(chave);
      return next;
    });
  };

  const colHeaderStyle: React.CSSProperties = {
    padding: '8px 12px',
    textAlign: 'left',
    fontWeight: 600,
    fontSize: 11.5,
    color: t.textMuted,
    borderBottom: `1px solid ${t.border}`,
    whiteSpace: 'nowrap',
    // Cabeçalho preso no topo da área rolável da tabela. Precisa de fundo
    // opaco: sem ele as linhas apareceriam por baixo ao rolar.
    position: 'sticky',
    top: 0,
    zIndex: 1,
    background: t.surface,
  };
  const cellStyle: React.CSSProperties = { padding: '9px 12px', whiteSpace: 'nowrap' };

  const kpiCards: [string, string][] = [
    ['Pontos no filtro', resumo.pontos.toLocaleString('pt-BR')],
    ['No mapa', resumo.noMapa.toLocaleString('pt-BR')],
    ['Clientes distintos', resumo.clientes.toLocaleString('pt-BR')],
    ['Vendedores', resumo.vendedores.toLocaleString('pt-BR')],
    ['Cidades', resumo.cidades.toLocaleString('pt-BR')],
    ['Sem coordenada', resumo.semCoordenada.toLocaleString('pt-BR')],
  ];

  /**
   * Tabela + gráficos memoizados.
   *
   * São a parte cara da tela (até 500 linhas e 4 gráficos recharts). Sem
   * isto, QUALQUER mudança de estado do componente — inclusive trocar a
   * camada do mapa, que não tem nada a ver com eles — remontava tudo, e era
   * isso que travava a tela a cada clique no seletor. Com o useMemo, React
   * reaproveita a mesma árvore e só re-renderiza quando os dados mudam.
   */
  const conteudoPesado = useMemo(
    () => (
      <>
          {/* TABELA — visão alternativa ao mapa (e única para quem está sem coordenada) */}
          <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, overflow: 'hidden' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '12px 16px',
                borderBottom: `1px solid ${t.border}`,
              }}
            >
              <Route size={16} color={t.primary} />
              <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>
                Pontos de roteiro
                <span style={{ fontSize: 11.5, fontWeight: 500, color: t.textMuted }}>
                  {' '}
                  — {filtrados.length.toLocaleString('pt-BR')} no filtro
                  {filtrados.length > 500 ? ' (primeiros 500 na tabela; o Excel traz todos)' : ''}
                </span>
              </div>
            </div>
            {/* Altura FIXA com rolagem só aqui dentro: a listagem não empurra
                mais os gráficos para fora da tela conforme o filtro cresce, e
                a página inteira para de rolar por causa dela. O cabeçalho fica
                grudado no topo (position: sticky) para não se perder a
                referência das colunas ao rolar. */}
            <div style={{ maxHeight: 420, overflowY: 'auto', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, color: t.text }}>
                <thead>
                  <tr>
                    <th style={colHeaderStyle}>Código</th>
                    <th style={colHeaderStyle}>Cliente</th>
                    <th style={colHeaderStyle}>Vendedor</th>
                    <th style={colHeaderStyle}>Equipe</th>
                    <th style={colHeaderStyle}>Cidade</th>
                    <th style={colHeaderStyle}>Dia</th>
                    <th style={colHeaderStyle}>Semana</th>
                    <th style={{ ...colHeaderStyle, textAlign: 'right' }}>Seq.</th>
                    <th style={colHeaderStyle}>Frequência</th>
                    <th style={colHeaderStyle}>Coordenada</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.length === 0 ? (
                    <tr>
                      <td
                        colSpan={10}
                        style={{ ...cellStyle, color: t.textMuted, textAlign: 'center', padding: '24px 12px' }}
                      >
                        Nenhum ponto encontrado com os filtros atuais.
                      </td>
                    </tr>
                  ) : (
                    filtrados.slice(0, 500).map((p, i) => {
                      const cat = categoriaDe(p);
                      const cor = corDaCategoria.get(cat);
                      return (
                        <tr key={`${p.codCliente}-${p.codVendedor}-${p.dia}-${p.semana}-${i}`} style={{ borderTop: `1px solid ${t.border}` }}>
                          <td className="num" style={cellStyle}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                              <span
                                style={{
                                  width: 9,
                                  height: 9,
                                  borderRadius: '50%',
                                  background: cor,
                                  flexShrink: 0,
                                }}
                              />
                              {p.codCliente || '—'}
                            </span>
                          </td>
                          <td style={{ ...cellStyle, whiteSpace: 'normal', minWidth: 190 }}>{nomeCliente(p)}</td>
                          <td style={cellStyle}>{p.vendedor || '—'}</td>
                          <td style={{ ...cellStyle, color: t.textSecondary }}>{p.equipe || '—'}</td>
                          <td style={cellStyle}>{p.municipio || '—'}</td>
                          <td style={cellStyle}>
                            {p.dia !== null ? `${p.dia} · ${DIA_CURTO[p.dia] || '?'}` : '—'}
                          </td>
                          <td className="num" style={cellStyle}>{p.semana || '—'}</td>
                          <td className="num" style={{ ...cellStyle, textAlign: 'right' }}>{p.sequencia ?? '—'}</td>
                          <td style={{ ...cellStyle, color: t.textSecondary }}>{p.frequencia || '—'}</td>
                          <td className="num" style={{ ...cellStyle, color: t.textMuted }}>
                            {p.latitude !== null && p.longitude !== null
                              ? `${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}`
                              : 'sem coordenada'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ============================================================ *
              GRÁFICOS — todos derivados de `filtrados`, o MESMO conjunto do
              mapa e da tabela. Qualquer filtro (equipe, vendedor, cidade,
              dia, semana, busca, legenda) move estes números junto.

              Convenção de cor fixa nos quatro: azul = roteirizado,
              amarelo = sem roteiro. Dia da semana usa a mesma rampa
              sequencial do mapa, para o gráfico e o mapa "conversarem".
           * ============================================================ */}
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <BarChart3 size={16} color={t.primary} />
              <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>
                Panorama da roteirização
              </div>
              <div style={{ fontSize: 11.5, color: t.textMuted }}>
                acompanha os filtros aplicados acima
              </div>
            </div>

            {/* ---- 1. Cobertura: parte-do-todo de 2 categorias ----
                Uma barra segmentada lê melhor que uma rosca aqui: a
                comparação é "quanto falta", e o número em destaque já
                responde a pergunta sem o leitor medir ângulo. */}
            <div
              style={{
                background: t.surface,
                border: `1px solid ${t.border}`,
                borderRadius: 12,
                padding: 16,
                marginBottom: 12,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 2 }}>
                Cobertura de roteirização
              </div>
              <div style={{ fontSize: 11.5, color: t.textMuted, marginBottom: 14 }}>
                Clientes distintos no filtro atual
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: 12,
                  marginBottom: 14,
                }}
              >
                {[
                  ['Clientes', roteirizacao.total.toLocaleString('pt-BR'), t.text, null],
                  [
                    'Roteirizados',
                    roteirizacao.roteirizados.toLocaleString('pt-BR'),
                    t.text,
                    corOk,
                  ],
                  ['Sem roteiro', roteirizacao.semRota.toLocaleString('pt-BR'), t.text, corSemRota],
                  [
                    '% roteirizado',
                    `${(roteirizacao.pct * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`,
                    t.text,
                    null,
                  ],
                ].map(([label, valor, cor, swatch]) => (
                  <div key={label as string}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 10.5,
                        fontWeight: 600,
                        color: t.textMuted,
                        textTransform: 'uppercase',
                        letterSpacing: 0.4,
                        marginBottom: 5,
                      }}
                    >
                      {swatch && (
                        <span
                          style={{
                            width: 9,
                            height: 9,
                            borderRadius: 3,
                            background: swatch as string,
                            flexShrink: 0,
                          }}
                        />
                      )}
                      {label}
                    </div>
                    <div className="num" style={{ fontSize: 22, fontWeight: 700, color: cor as string }}>
                      {valor}
                    </div>
                  </div>
                ))}
              </div>

              {roteirizacao.total > 0 && (
                <div
                  style={{
                    display: 'flex',
                    height: 14,
                    borderRadius: 7,
                    overflow: 'hidden',
                    // Gap de 2px entre os segmentos, na cor da superfície.
                    gap: 2,
                    background: t.surfaceElevated,
                  }}
                  role="img"
                  aria-label={`${roteirizacao.roteirizados} de ${roteirizacao.total} clientes roteirizados`}
                >
                  {roteirizacao.roteirizados > 0 && (
                    <div style={{ width: `${roteirizacao.pct * 100}%`, background: corOk }} />
                  )}
                  {roteirizacao.semRota > 0 && (
                    <div style={{ flex: 1, background: corSemRota }} />
                  )}
                </div>
              )}
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: 12,
              }}
            >
              {/* ---- 2. Frequência de visita ---- */}
              <div
                style={{
                  background: t.surface,
                  border: `1px solid ${t.border}`,
                  borderRadius: 12,
                  padding: 16,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
                  <Repeat size={14} color={t.primary} />
                  <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>
                    Clientes por frequência
                  </div>
                </div>
                <div style={{ fontSize: 11.5, color: t.textMuted, marginBottom: 12 }}>
                  Semanal, quinzenal, mensal e sem roteiro
                </div>
                {porFrequencia.length === 0 ? (
                  <EmptyBlock title="Sem dados no filtro atual" />
                ) : (
                  <div style={{ height: alturaGraficoDuplo }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={porFrequencia}
                        layout="vertical"
                        margin={{ top: 4, right: 56, left: 4, bottom: 4 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke={t.border} horizontal={false} />
                        <XAxis type="number" hide />
                        <YAxis
                          type="category"
                          dataKey="freq"
                          width={108}
                          tick={{ fill: t.textSecondary, fontSize: 11.5 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          cursor={{ fill: `${t.primary}14` }}
                          contentStyle={tooltipStyle}
                          formatter={(v: number) => [v.toLocaleString('pt-BR'), 'Clientes']}
                        />
                        <Bar dataKey="clientes" radius={[0, 4, 4, 0]} barSize={18}>
                          {porFrequencia.map((d) => (
                            <Cell
                              key={d.freq}
                              fill={d.freq === 'Não roteirizado' ? corSemRota : corOk}
                            />
                          ))}
                          {/* Rótulo direto: dispensa o leitor de estimar pelo eixo. */}
                          <LabelList
                            dataKey="clientes"
                            position="right"
                            formatter={(v: number) => v.toLocaleString('pt-BR')}
                            style={{ fill: t.text, fontSize: 11.5, fontWeight: 600 }}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* ---- 3. Carga por dia da semana ----
                  Dia é ORDINAL, então usa a rampa sequencial — a mesma do
                  mapa quando se colore por dia. */}
              <div
                style={{
                  background: t.surface,
                  border: `1px solid ${t.border}`,
                  borderRadius: 12,
                  padding: 16,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
                  <CalendarDays size={14} color={t.primary} />
                  <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>
                    Visitas planejadas por dia
                  </div>
                </div>
                <div style={{ fontSize: 11.5, color: t.textMuted, marginBottom: 12 }}>
                  Linhas do roteiro, não clientes — o mesmo cliente pode repetir em dias diferentes
                </div>
                {porDia.length === 0 ? (
                  <EmptyBlock title="Nenhum dia roteirizado no filtro atual" />
                ) : (
                  <div style={{ height: alturaGraficoDuplo }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={porDia} margin={{ top: 22, right: 8, left: 4, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={t.border} vertical={false} />
                        <XAxis
                          dataKey="label"
                          tick={{ fill: t.textSecondary, fontSize: 11.5 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis hide />
                        <Tooltip
                          cursor={{ fill: `${t.primary}14` }}
                          contentStyle={tooltipStyle}
                          formatter={(v: number) => [v.toLocaleString('pt-BR'), 'Visitas']}
                          labelFormatter={(l: string) => {
                            const d = porDia.find((x) => x.label === l);
                            return d ? DIA_LABEL[d.dia] || l : l;
                          }}
                        />
                        <Bar dataKey="visitas" radius={[4, 4, 0, 0]} maxBarSize={56}>
                          {porDia.map((d, i) => (
                            <Cell key={d.dia} fill={rampaDia[Math.min(i, rampaDia.length - 1)]} />
                          ))}
                          <LabelList
                            dataKey="visitas"
                            position="top"
                            formatter={(v: number) => v.toLocaleString('pt-BR')}
                            style={{ fill: t.text, fontSize: 11.5, fontWeight: 600 }}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>

            {/* ---- 4. Cidades ---- */}
            <div
              style={{
                background: t.surface,
                border: `1px solid ${t.border}`,
                borderRadius: 12,
                padding: 16,
                marginTop: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
                <Building2 size={14} color={t.primary} />
                <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>
                  Clientes por cidade
                  {porCidade.length >= MAX_CIDADES_GRAFICO && (
                    <span style={{ fontSize: 11.5, fontWeight: 500, color: t.textMuted }}>
                      {' '}
                      — {MAX_CIDADES_GRAFICO} maiores
                    </span>
                  )}
                </div>
              </div>
              <div style={{ fontSize: 11.5, color: t.textMuted, marginBottom: 12 }}>
                Cada barra separa quem já tem roteiro de quem ainda não tem
              </div>
              {porCidade.length === 0 ? (
                <EmptyBlock title="Sem cidades no filtro atual" />
              ) : (
                <div style={{ height: Math.max(190, porCidade.length * 30) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={porCidade}
                      layout="vertical"
                      margin={{ top: 4, right: 56, left: 4, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={t.border} horizontal={false} />
                      <XAxis type="number" hide />
                      <YAxis
                        type="category"
                        dataKey="cidade"
                        width={132}
                        tick={{ fill: t.textSecondary, fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        cursor={{ fill: `${t.primary}14` }}
                        contentStyle={tooltipStyle}
                        formatter={(v: number, nome: string) => [v.toLocaleString('pt-BR'), nome]}
                      />
                      <Legend wrapperStyle={{ fontSize: 11.5, color: t.textSecondary }} />
                      <Bar
                        dataKey="roteirizados"
                        name="Roteirizados"
                        stackId="c"
                        fill={corOk}
                        barSize={16}
                      />
                      <Bar
                        dataKey="semRota"
                        name="Sem roteiro"
                        stackId="c"
                        fill={corSemRota}
                        barSize={16}
                        radius={[0, 4, 4, 0]}
                      >
                        <LabelList
                          dataKey="total"
                          position="right"
                          formatter={(v: number) => v.toLocaleString('pt-BR')}
                          style={{ fill: t.text, fontSize: 11, fontWeight: 600 }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
      </>
    ),
    // `basemap` de propósito FORA: trocar a camada não muda nada aqui.
    [filtrados, roteirizacao, porFrequencia, porDia, porCidade, corDaCategoria, categoriaDe, t, isDark]
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <h1 className="num" style={{ margin: 0, fontSize: 24, fontWeight: 700, color: t.text }}>
              Base de Roteiro
            </h1>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 6,
                background: `${t.primary}1F`,
                color: t.primary,
                border: `1px solid ${t.primary}40`,
              }}
            >
              SAR
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: t.textSecondary }}>
            Clientes roteirizados no mapa, por dia de visita, semana do mês, vendedor, equipe e cidade.
          </p>
        </div>
      </div>

      {loading ? (
        <LoadingBlock label="Carregando a base de roteiro..." />
      ) : error ? (
        <ErrorBlock message={error} />
      ) : rows.length === 0 ? (
        <EmptyBlock
          title="Nenhuma base de roteiro importada"
          description='Importe a planilha em Administração › Dados e Exportações, escolhendo o conjunto "Base de Roteiro". Ela precisa trazer latitude e longitude de cada cliente para os pontos aparecerem no mapa.'
        />
      ) : (
        <>
          {/* FILTROS */}
          <div
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'flex-end',
              flexWrap: 'wrap',
              marginBottom: 14,
              background: t.surface,
              border: `1px solid ${t.border}`,
              borderRadius: 12,
              padding: 12,
            }}
          >
            {(resp?.datasDisponiveis.length ?? 0) > 1 && (
              <SingleSelectFilter
                label="Importação"
                options={(resp?.datasDisponiveis ?? []).map((d) => ({
                  value: d,
                  label: new Date(`${d}T12:00:00`).toLocaleDateString('pt-BR'),
                }))}
                value={data}
                onChange={(v) => v && setData(v)}
                allowClear={false}
              />
            )}

            <SingleSelectFilter
              label="Colorir por"
              options={(Object.keys(COLORIR_LABEL) as ColorirPor[]).map((k) => ({
                value: k,
                label: COLORIR_LABEL[k],
              }))}
              value={colorirPor}
              onChange={(v) => setColorirPor((v as ColorirPor) || 'vendedor')}
              allowClear={false}
            />

            {canFilterEquipe && (filtros?.equipes.length ?? 0) > 0 && (
              <SingleSelectFilter
                label="Equipe"
                options={(filtros?.equipes ?? []).map((e) => ({ value: e, label: e }))}
                value={selectedEquipe}
                onChange={setSelectedEquipe}
                placeholder="Todas as equipes"
                allLabel="Todas as equipes"
              />
            )}

            {canFilterVendedor && (
              <SingleSelectFilter
                label="Vendedor"
                options={(filtros?.vendedores ?? []).map((v) => ({
                  value: v.codVendedor,
                  label: `${v.vendedor} (${v.pontos})`,
                }))}
                value={selectedVendedor}
                onChange={setSelectedVendedor}
                placeholder="Todos os vendedores"
                allLabel="Todos os vendedores"
              />
            )}

            {(filtros?.municipios.length ?? 0) > 0 && (
              <SingleSelectFilter
                label="Cidade"
                options={(filtros?.municipios ?? []).map((m) => ({ value: m, label: m }))}
                value={selectedMunicipio}
                onChange={setSelectedMunicipio}
                placeholder="Todas as cidades"
                allLabel="Todas as cidades"
              />
            )}

            {diaOptions.length > 0 && (
              <MultiSelectFilter
                label="Dia"
                options={diaOptions}
                selected={selectedDias}
                onChange={setSelectedDias}
                placeholder="Todos os dias"
              />
            )}

            {semanaOptions.length > 0 && (
              <MultiSelectFilter
                label="Semana"
                options={semanaOptions}
                selected={selectedSemanas}
                onChange={setSelectedSemanas}
                placeholder="Todas as semanas"
              />
            )}

            <div style={{ flex: 1, minWidth: 190 }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 11,
                  fontWeight: 600,
                  color: t.textMuted,
                  marginBottom: 4,
                }}
              >
                <Search size={12} /> Buscar cliente
              </label>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Código, razão social ou endereço"
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: `1px solid ${t.border}`,
                  background: t.surfaceElevated,
                  color: t.text,
                  fontSize: 13,
                }}
              />
            </div>
          </div>

          {/* Dia é ordinal (segunda→sexta): a legenda mostra o significado de 2..6 */}
          {diaOptions.length > 0 && (
            <div style={{ fontSize: 11.5, color: t.textMuted, marginBottom: 14 }}>
              Convenção da planilha no campo “Dia”:{' '}
              {diaOptions.map((d, i) => (
                <span key={d}>
                  {i > 0 ? ' · ' : ''}
                  <strong style={{ color: t.textSecondary }}>{d}</strong> = {DIA_CURTO[Number(d)] || '?'}
                </span>
              ))}
            </div>
          )}

          {/* KPIs */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: 12,
              marginBottom: 14,
            }}
          >
            {kpiCards.map(([label, value]) => (
              <div
                key={label}
                style={{
                  background: t.surface,
                  border: `1px solid ${t.border}`,
                  borderRadius: 12,
                  padding: '12px 14px',
                }}
              >
                <div
                  style={{
                    fontSize: 10.5,
                    fontWeight: 600,
                    color: t.textMuted,
                    marginBottom: 5,
                    textTransform: 'uppercase',
                    letterSpacing: 0.4,
                  }}
                >
                  {label}
                </div>
                <div className="num" style={{ fontSize: 18, fontWeight: 700, color: t.text }}>
                  {value}
                </div>
              </div>
            ))}
          </div>

          {resp?.truncado && (
            <div
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
                background: t.surfaceElevated,
                border: `1px solid ${t.border}`,
                borderRadius: 10,
                padding: '10px 14px',
                marginBottom: 14,
                fontSize: 12.5,
                color: t.textSecondary,
              }}
            >
              <AlertCircle size={16} color={t.primary} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>
                Esta base tem {resp.total.toLocaleString('pt-BR')} pontos e foi cortada no limite do mapa. Filtre por
                equipe, vendedor ou cidade para ver o recorte completo.
              </span>
            </div>
          )}

          {/* MAPA + LEGENDA */}
          <div
            style={{
              background: t.surface,
              border: `1px solid ${t.border}`,
              borderRadius: 12,
              overflow: 'hidden',
              marginBottom: 16,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '12px 16px',
                borderBottom: `1px solid ${t.border}`,
                flexWrap: 'wrap',
              }}
            >
              <MapPin size={16} color={t.primary} />
              <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>
                Mapa dos clientes roteirizados
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: t.textMuted }}>
                <Palette size={12} />
                cor por {COLORIR_LABEL[colorirPor].toLowerCase()}
              </div>

            </div>

            {/* Seletor de camada de fundo — todas sem chave de API. Fica em
                linha própria e rotulada: dentro do cabeçalho ele disputava
                espaço com o título e, em tela estreita, era empurrado para
                fora do alcance do olho. */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                flexWrap: 'wrap',
                padding: '10px 16px',
                borderBottom: `1px solid ${t.border}`,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: t.textMuted,
                  textTransform: 'uppercase',
                  letterSpacing: 0.4,
                }}
              >
                Camada do mapa
              </span>

              <button
                type="button"
                onClick={() => setLegendaVisivel((v) => !v)}
                aria-expanded={legendaVisivel}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  marginLeft: 'auto',
                  padding: '5px 11px',
                  borderRadius: 999,
                  border: `1px solid ${t.border}`,
                  background: legendaVisivel ? `${t.primary}14` : t.surfaceElevated,
                  color: legendaVisivel ? t.primary : t.textSecondary,
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {legendaVisivel ? <EyeOff size={12} /> : <Eye size={12} />}
                {legendaVisivel ? 'Ocultar legenda' : `Legenda (${legenda.length})`}
              </button>
              <div style={{ minWidth: 230 }}>
                <SingleSelectFilter
                  label=""
                  options={BASEMAP_ORDEM.map((id) => ({
                    value: id,
                    label: `${BASEMAPS[id].grupo} · ${BASEMAPS[id].label}`,
                  }))}
                  value={basemap}
                  onChange={(v) => trocarBasemap((v as BasemapId) || 'padrao')}
                  allowClear={false}
                />
              </div>
            </div>

            {/* Legenda: identidade NUNCA fica só na cor — cada item tem
                rótulo e contagem, e o clique esconde/mostra a categoria.
                Isso vale ainda mais agora que cada setor tem tom próprio:
                com dezenas de categorias, tons vizinhos se parecem, e é o
                rótulo (aqui, no popup e na tabela) que diz quem é quem.
                Altura limitada com rolagem própria para a legenda não
                empurrar o mapa para fora da tela. */}
            {legendaVisivel && (
            <div
              style={{
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
                alignContent: 'flex-start',
                maxHeight: 108,
                overflowY: 'auto',
                padding: '10px 16px',
                borderBottom: `1px solid ${t.border}`,
                background: t.bgSecondary,
              }}
            >
              {legenda.map((item) => {
                const off = hidden.has(item.chave);
                return (
                  <button
                    key={item.chave}
                    type="button"
                    onClick={() => toggleLegenda(item.chave)}
                    title={off ? 'Mostrar no mapa' : 'Esconder do mapa'}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '4px 10px',
                      borderRadius: 999,
                      border: `1px solid ${t.border}`,
                      background: t.surface,
                      color: off ? t.textMuted : t.text,
                      opacity: off ? 0.5 : 1,
                      fontSize: 11.5,
                      fontWeight: 600,
                      cursor: 'pointer',
                      textDecoration: off ? 'line-through' : 'none',
                    }}
                  >
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: item.cor,
                        border: `1px solid ${isDark ? '#0B0F17' : '#FFFFFF'}`,
                        flexShrink: 0,
                      }}
                    />
                    <span>{item.rotulo}</span>
                    <span className="num" style={{ color: t.textMuted, fontWeight: 500 }}>
                      {item.total.toLocaleString('pt-BR')}
                    </span>
                  </button>
                );
              })}
            </div>
            )}

            {/* Tema escuro do basemap: inverte os tiles claros do OSM em vez
                de depender de um serviço de mapa com chave de API. A classe
                fica no container de tiles (ver className no L.tileLayer), por
                isso os pontos, popups e controles não são invertidos.
                hue-rotate(180°) desfaz a troca de matiz da inversão, deixando
                água e vegetação com a cor certa em vez de complementar. */}
            <style>{`
              .mapa-tiles-escuro {
                filter: invert(1) hue-rotate(180deg) brightness(0.92) contrast(0.92) saturate(0.75);
              }
              /* Preto e branco: tira a cor do basemap para a COR DOS PONTOS
                 ser a única informação cromática na tela. É a camada mais
                 útil quando se está lendo setor/dia/semana pela cor. */
              .mapa-tiles-cinza {
                filter: grayscale(1) contrast(0.9) brightness(1.05);
              }
              /* Sépia: fundo quente e baixo contraste, em que qualquer cor de
                 ponto salta. Também é só filtro sobre o OSM, sem outro serviço. */
              .mapa-tiles-sepia {
                filter: sepia(0.85) saturate(0.8) contrast(0.92) brightness(1.02);
              }
              /* O rodapé de atribuição do Leaflet é branco fixo e fica
                 ilegível/estourado sobre o mapa escuro. */
              .mapa-escuro .leaflet-control-attribution {
                background: rgba(11, 15, 23, 0.78);
                color: #9AA4B8;
              }
              .mapa-escuro .leaflet-control-attribution a { color: #9AA4B8; }
              /* Botões de zoom seguem o tema (o padrão é branco). */
              .mapa-escuro .leaflet-bar a {
                background: #162032;
                color: #F1F1F6;
                border-bottom-color: #34365A;
              }
              .mapa-escuro .leaflet-bar a:hover { background: #1d2a42; }
            `}</style>

            {/* O container precisa de altura explícita: o Leaflet mede o div. */}
            <div
              ref={setMapEl}
              /* Os controles seguem o FUNDO DO MAPA (escuro ou satélite),
                 não o tema da página: no tema claro com satélite, controles
                 brancos sumiam sobre a imagem. */
              className={fundoEscuro ? 'mapa-escuro' : undefined}
              style={{
                width: '100%',
                height: 'min(62vh, 620px)',
                minHeight: 340,
                background: t.bgSecondary,
              }}
            />

            {resumo.semCoordenada > 0 && (
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                  padding: '10px 16px',
                  borderTop: `1px solid ${t.border}`,
                  fontSize: 12,
                  color: t.textSecondary,
                }}
              >
                <Crosshair size={14} color={t.textMuted} style={{ flexShrink: 0 }} />
                <span>
                  {resumo.semCoordenada.toLocaleString('pt-BR')}{' '}
                  {resumo.semCoordenada === 1 ? 'cliente do filtro está' : 'clientes do filtro estão'} sem
                  latitude/longitude na planilha e não{' '}
                  {resumo.semCoordenada === 1 ? 'aparece' : 'aparecem'} no mapa — eles continuam na tabela abaixo.
                </span>
              </div>
            )}
          </div>

          {conteudoPesado}
        </>
      )}
    </div>
  );
};
