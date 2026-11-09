import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { ExportExcelButton } from '../../components/common/ExportExcelButton';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../components/common/DataState';
import { SingleSelectFilter } from '../../components/common/SingleSelectFilter';
import { MultiSelectFilter } from '../../components/common/MultiSelectFilter';
import { BaseRoteiroPonto, BaseRoteiroResponse, fetchBaseRoteiro, getErrorMessage } from '../../lib/api';
import { AlertCircle, Crosshair, MapPin, Palette, Route, Search } from 'lucide-react';

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

/** Quantas categorias nominais recebem matiz próprio antes de virar "Outros". */
const MAX_CAT_CORES = 4;

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
  const canFilterVendedor = role === 'ADMIN' || role === 'GERENTE' || role === 'SUPERVISOR';
  const canFilterEquipe = role === 'ADMIN' || role === 'GERENTE';

  const [data, setData] = useState<string>('');
  const [resp, setResp] = useState<BaseRoteiroResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [colorirPor, setColorirPor] = useState<ColorirPor>('vendedor');
  const [selectedVendedor, setSelectedVendedor] = useState('');
  const [selectedEquipe, setSelectedEquipe] = useState('');
  const [selectedMunicipio, setSelectedMunicipio] = useState('');
  const [selectedDias, setSelectedDias] = useState<string[]>([]);
  const [selectedSemanas, setSelectedSemanas] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  /** Categorias escondidas pelo clique na legenda. */
  const [hidden, setHidden] = useState<Set<string>>(new Set());

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

    // Nominal: 4 matizes fixos na ordem estável; o resto vira "Outros".
    categorias.forEach((c, i) => {
      map.set(c.chave, i < MAX_CAT_CORES ? paleta[i] : outros);
    });
    return map;
  }, [categorias, colorirPor, isDark]);

  /** Categorias que não couberam nos 4 matizes (compartilham o cinza). */
  const categoriasEmOutros = useMemo(
    () => (colorirPor === 'dia' ? [] : categorias.slice(MAX_CAT_CORES).map((c) => c.chave)),
    [categorias, colorirPor]
  );

  const legenda = useMemo(() => {
    const outros = isDark ? OUTROS_COLOR.dark : OUTROS_COLOR.light;
    const itens = categorias.slice(0, colorirPor === 'dia' ? categorias.length : MAX_CAT_CORES).map((c) => ({
      chave: c.chave,
      rotulo: colorirPor === 'dia' && c.chave !== 'Sem dia' ? DIA_LABEL[Number(c.chave)] || c.chave : c.chave,
      cor: corDaCategoria.get(c.chave) || outros,
      total: c.total,
    }));
    if (categoriasEmOutros.length > 0) {
      itens.push({
        chave: '__outros__',
        rotulo: `Outros (${categoriasEmOutros.length})`,
        cor: outros,
        total: categorias.slice(MAX_CAT_CORES).reduce((acc, c) => acc + c.total, 0),
      });
    }
    return itens;
  }, [categorias, categoriasEmOutros, corDaCategoria, colorirPor, isDark]);

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
      if (hidden.has('__outros__') && categoriasEmOutros.includes(cat)) return false;
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
    categoriasEmOutros,
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
  const tileRef = useRef<L.TileLayer | null>(null);
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
    });
    rendererRef.current = L.canvas({ padding: 0.5 });
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      tileRef.current = null;
      rendererRef.current = null;
      lastFitRef.current = '';
    };
  }, [mapEl]);

  // Camada de tiles acompanha o tema (claro/escuro são escolhidos, não um
  // "flip" automático do mesmo mapa).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (tileRef.current) {
      tileRef.current.remove();
      tileRef.current = null;
    }
    const url = isDark
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    const attribution = isDark
      ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
      : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
    tileRef.current = L.tileLayer(url, { attribution, maxZoom: 19 }).addTo(map);
    // mapEl entra nas dependências para a camada ser (re)criada no mesmo
    // commit em que o mapa nasce — o efeito acima roda primeiro.
  }, [isDark, mapEl]);

  // Redesenha os pontos quando o filtro, a cor ou o tema mudam.
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    const anelCor = isDark ? '#0B0F17' : '#FFFFFF';
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
        // Anel na cor da superfície separa pontos sobrepostos.
        color: anelCor,
        weight: 2,
        fillColor: cor,
        fillOpacity: 0.9,
      });

      const dia = p.dia !== null ? `${p.dia} — ${DIA_LABEL[p.dia] || 'Dia ' + p.dia}` : null;
      marker.bindPopup(
        `<div style="font-size:12.5px;line-height:1.5;min-width:210px">
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
         </div>`
      );
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
    mapEl,
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
   * Export / opções de filtro
   * ---------------------------------------------------------------- */

  const handleExport = () => [
    {
      sheetName: 'Base de Roteiro',
      data: filtrados.map((p) => ({
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
      })),
    },
  ];

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
        <ExportExcelButton onPrepareData={handleExport} filename="base-de-roteiro.xlsx" />
      </div>

      {loading ? (
        <LoadingBlock label="Carregando a base de roteiro..." />
      ) : error ? (
        <ErrorBlock message={error} />
      ) : rows.length === 0 ? (
        <EmptyBlock
          title="Nenhuma base de roteiro importada"
          description='Importe a planilha em Administração › Metas & Definições, escolhendo o conjunto "Base de Roteiro". Ela precisa trazer latitude e longitude de cada cliente para os pontos aparecerem no mapa.'
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

            {/* Legenda: identidade nunca fica só na cor — cada item tem rótulo e
                contagem, e o clique esconde/mostra a categoria. */}
            <div
              style={{
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
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
              {categoriasEmOutros.length > 0 && (
                <span style={{ fontSize: 11, color: t.textMuted, alignSelf: 'center' }}>
                  — {categoriasEmOutros.length} {categoriasEmOutros.length === 1 ? 'categoria' : 'categorias'} dividem o
                  cinza; filtre para isolar uma delas.
                </span>
              )}
            </div>

            {/* O container precisa de altura explícita: o Leaflet mede o div. */}
            <div
              ref={setMapEl}
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
            <div style={{ overflowX: 'auto' }}>
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
        </>
      )}
    </div>
  );
};
