import React, { useState, useMemo } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { ExportExcelButton } from '../../components/common/ExportExcelButton';
import {
  Target,
  Filter,
  Shield,
  Calendar,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Layers,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

export type TipoObjetivo = 'Faseamento' | 'Faseamento II' | 'Desconcentração' | 'Desafios';

export interface ObjetivoRegistro {
  id: string;
  tipo: TipoObjetivo;
  descricao: string;
  detalhe?: string;
  meta: number;
  realizado: number;
  formato: 'moeda' | 'quantidade';
  dataInicio: string; // DD/MM/AAAA
  dataFinal: string; // DD/MM/AAAA
  gerencia: string; // 'TRAD' | 'AS'
  equipe: string;
  vendedorCodigo?: string;
  vendedorNome?: string;
  status: 'Em Andamento' | 'Superado' | 'Atenção';
}

// Base de dados íntegra - Todos os registros preservados
const MOCK_OBJETIVOS: ObjetivoRegistro[] = [
  // FASEAMENTO
  {
    id: 'obj-1',
    tipo: 'Faseamento',
    descricao: 'Faseamento 1ª Quinzena - Alimentos',
    detalhe: 'Atingir 50% da cota mensal de Alimentos até dia 15',
    meta: 420000,
    realizado: 438500,
    formato: 'moeda',
    dataInicio: '01/09/2026',
    dataFinal: '15/09/2026',
    gerencia: 'TRAD',
    equipe: 'TRAB ALFA',
    vendedorCodigo: '003',
    vendedorNome: 'João Souza',
    status: 'Superado',
  },
  {
    id: 'obj-2',
    tipo: 'Faseamento',
    descricao: 'Faseamento 1ª Quinzena - Bebidas & Mercearia',
    detalhe: 'Garantir faturamento inicial nos clientes de grande giro',
    meta: 380000,
    realizado: 345200,
    formato: 'moeda',
    dataInicio: '01/09/2026',
    dataFinal: '15/09/2026',
    gerencia: 'TRAD',
    equipe: 'TRAB ALFA',
    vendedorCodigo: '004',
    vendedorNome: 'Lucas Lima',
    status: 'Em Andamento',
  },
  {
    id: 'obj-3',
    tipo: 'Faseamento',
    descricao: 'Faseamento 1ª Quinzena - Consolidado TRAB BETA',
    detalhe: 'Meta de abertura da primeira quinzena para a equipe Beta',
    meta: 890000,
    realizado: 924000,
    formato: 'moeda',
    dataInicio: '01/09/2026',
    dataFinal: '15/09/2026',
    gerencia: 'TRAD',
    equipe: 'TRAB BETA',
    vendedorCodigo: '011',
    vendedorNome: 'Felipe Rocha',
    status: 'Superado',
  },

  // FASEAMENTO II
  {
    id: 'obj-4',
    tipo: 'Faseamento II',
    descricao: 'Faseamento II - Fechamento 2ª Quinzena',
    detalhe: 'Atingimento da cota restante e alavancagem de fim de mês',
    meta: 480000,
    realizado: 395000,
    formato: 'moeda',
    dataInicio: '16/09/2026',
    dataFinal: '30/09/2026',
    gerencia: 'TRAD',
    equipe: 'TRAB ALFA',
    vendedorCodigo: '003',
    vendedorNome: 'João Souza',
    status: 'Em Andamento',
  },
  {
    id: 'obj-5',
    tipo: 'Faseamento II',
    descricao: 'Faseamento II - Alavancagem TRAB BETA',
    detalhe: 'Aceleração de pedidos na segunda metade do mês',
    meta: 620000,
    realizado: 590000,
    formato: 'moeda',
    dataInicio: '16/09/2026',
    dataFinal: '30/09/2026',
    gerencia: 'TRAD',
    equipe: 'TRAB BETA',
    vendedorCodigo: '008',
    vendedorNome: 'Mariana Dias',
    status: 'Em Andamento',
  },
  {
    id: 'obj-6',
    tipo: 'Faseamento II',
    descricao: 'Faseamento II - Recuperação de Clientes Inativos',
    detalhe: 'Fechamento de cota com foco em clientes sem compra recente',
    meta: 350000,
    realizado: 268000,
    formato: 'moeda',
    dataInicio: '16/09/2026',
    dataFinal: '30/09/2026',
    gerencia: 'TRAD',
    equipe: 'TRAB ALFA',
    vendedorCodigo: '012',
    vendedorNome: 'Rafael Costa',
    status: 'Atenção',
  },

  // DESCONCENTRAÇÃO
  {
    id: 'obj-7',
    tipo: 'Desconcentração',
    descricao: 'Desconcentração de Vendas - Mix Secundário',
    detalhe: 'Limite máximo de 25% de faturamento concentrado no TOP 3 clientes',
    meta: 180,
    realizado: 194,
    formato: 'quantidade',
    dataInicio: '01/09/2026',
    dataFinal: '30/09/2026',
    gerencia: 'TRAD',
    equipe: 'TRAB ALFA',
    vendedorCodigo: '003',
    vendedorNome: 'João Souza',
    status: 'Superado',
  },
  {
    id: 'obj-8',
    tipo: 'Desconcentração',
    descricao: 'Desconcentração de Linha Arcor & Heinz',
    detalhe: 'Aumentar dispersão de SKUs em clientes do pequeno e médio varejo',
    meta: 220,
    realizado: 205,
    formato: 'quantidade',
    dataInicio: '01/09/2026',
    dataFinal: '30/09/2026',
    gerencia: 'TRAD',
    equipe: 'TRAB ALFA',
    vendedorCodigo: '004',
    vendedorNome: 'Lucas Lima',
    status: 'Em Andamento',
  },
  {
    id: 'obj-9',
    tipo: 'Desconcentração',
    descricao: 'Desconcentração de Clientes TRAB GAMA',
    detalhe: 'Capilarização de vendas nas cidades periféricas',
    meta: 250,
    realizado: 268,
    formato: 'quantidade',
    dataInicio: '01/09/2026',
    dataFinal: '30/09/2026',
    gerencia: 'TRAD',
    equipe: 'TRAB GAMA',
    vendedorCodigo: '020',
    vendedorNome: 'Camila Prado',
    status: 'Superado',
  },

  // DESAFIOS
  {
    id: 'obj-10',
    tipo: 'Desafios',
    descricao: 'Desafio Campanha de Primavera - Chocolates',
    detalhe: 'Superar meta de volume nas linhas sazonais com bonificação',
    meta: 150000,
    realizado: 168400,
    formato: 'moeda',
    dataInicio: '05/09/2026',
    dataFinal: '25/09/2026',
    gerencia: 'TRAD',
    equipe: 'TRAB ALFA',
    vendedorCodigo: '003',
    vendedorNome: 'João Souza',
    status: 'Superado',
  },
  {
    id: 'obj-11',
    tipo: 'Desafios',
    descricao: 'Desafio Positivação Recorde de Confeitaria',
    detalhe: 'Positivar no mínimo 45 novos estabelecimentos de padaria',
    meta: 45,
    realizado: 38,
    formato: 'quantidade',
    dataInicio: '01/09/2026',
    dataFinal: '20/09/2026',
    gerencia: 'TRAD',
    equipe: 'TRAB ALFA',
    vendedorCodigo: '015',
    vendedorNome: 'Bruno Martins',
    status: 'Em Andamento',
  },
  {
    id: 'obj-12',
    tipo: 'Desafios',
    descricao: 'Desafio Líder de Vendas Nestle Food Service',
    detalhe: 'Meta de aceleração de embalagens institucionais',
    meta: 210000,
    realizado: 178900,
    formato: 'moeda',
    dataInicio: '01/09/2026',
    dataFinal: '30/09/2026',
    gerencia: 'AS',
    equipe: 'TRAB DELTA',
    vendedorCodigo: '001',
    vendedorNome: 'Thiago Mendes',
    status: 'Atenção',
  },
];

// Definição canônica de cada objetivo único
interface ObjetivoUnicoConsolidado {
  id: string;
  tipo: TipoObjetivo;
  nome: string;
  descricao: string;
  meta: number;
  realizado: number;
  formato: 'moeda' | 'quantidade';
  pct: number;
  dataInicio: string;
  dataFinal: string;
  status: 'Em Andamento' | 'Superado' | 'Atenção';
  registrosContabilizados: number;
  registros: ObjetivoRegistro[];
}

export const ObjetivosPage: React.FC = () => {
  const { t } = useTheme();
  const { currentUser } = useAuth();

  const isAdmin = !currentUser || currentUser.role === 'ADMIN';
  const isGerente = currentUser?.role === 'GERENTE';
  const isSupervisor = currentUser?.role === 'SUPERVISOR';
  const isVendedor = currentUser?.role === 'VENDEDOR';

  // 1. Filtro de Gerência
  const userGerencia = isGerente || isSupervisor || isVendedor ? currentUser?.manager || 'TRAD' : 'TODAS';
  const [selectedGerencia, setSelectedGerencia] = useState<string>(userGerencia);

  // 2. Filtro de Equipe
  const userTeam = isSupervisor || isVendedor ? currentUser?.team || 'TRAB ALFA' : 'TODAS';
  const [selectedEquipe, setSelectedEquipe] = useState<string>(userTeam);

  // 3. Filtro de Vendedor
  const userSellerCode = isVendedor ? currentUser?.sellerCode || '003' : 'TODOS';
  const [selectedVendedor, setSelectedVendedor] = useState<string>(userSellerCode);

  // 4. Filtro de Tipo de Objetivo
  const [selectedTipo, setSelectedTipo] = useState<string>('TODOS');

  // Estado para expandir registros contribuintes sem duplicar linhas
  const [expandedObjetivo, setExpandedObjetivo] = useState<string | null>(null);

  // Gerências disponíveis segundo permissão
  const availableGerencias = useMemo(() => {
    if (isAdmin) {
      return ['TODAS', 'TRAD', 'AS'];
    }
    return [currentUser?.manager || 'TRAD'];
  }, [isAdmin, currentUser]);

  // Equipes disponíveis segundo permissão e gerência selecionada
  const availableEquipes = useMemo(() => {
    if (isSupervisor || isVendedor) {
      return [currentUser?.team || 'TRAB ALFA'];
    }

    const targetGerencia = isAdmin ? selectedGerencia : currentUser?.manager || 'TRAD';

    if (targetGerencia === 'TRAD') {
      return ['TODAS', 'TRAB ALFA', 'TRAB BETA', 'TRAB GAMA'];
    }
    if (targetGerencia === 'AS') {
      return ['TODAS', 'TRAB DELTA'];
    }
    // TODAS as gerências (apenas para Admin)
    return ['TODAS', 'TRAB ALFA', 'TRAB BETA', 'TRAB GAMA', 'TRAB DELTA'];
  }, [isAdmin, isSupervisor, isVendedor, currentUser, selectedGerencia]);

  // Vendedores disponíveis segundo permissão, gerência e equipe selecionada
  const availableVendedores = useMemo(() => {
    if (isVendedor) {
      return [{ codigo: currentUser.sellerCode || '003', nome: currentUser.name || 'João Souza' }];
    }

    if (isSupervisor) {
      return [
        { codigo: '003', nome: 'João Souza' },
        { codigo: '004', nome: 'Lucas Lima' },
        { codigo: '012', nome: 'Rafael Costa' },
        { codigo: '015', nome: 'Bruno Martins' },
      ];
    }

    // Gerente ou Admin
    const all = [
      { codigo: '003', nome: 'João Souza', equipe: 'TRAB ALFA', gerencia: 'TRAD' },
      { codigo: '004', nome: 'Lucas Lima', equipe: 'TRAB ALFA', gerencia: 'TRAD' },
      { codigo: '012', nome: 'Rafael Costa', equipe: 'TRAB ALFA', gerencia: 'TRAD' },
      { codigo: '015', nome: 'Bruno Martins', equipe: 'TRAB ALFA', gerencia: 'TRAD' },
      { codigo: '008', nome: 'Mariana Dias', equipe: 'TRAB BETA', gerencia: 'TRAD' },
      { codigo: '011', nome: 'Felipe Rocha', equipe: 'TRAB BETA', gerencia: 'TRAD' },
      { codigo: '020', nome: 'Camila Prado', equipe: 'TRAB GAMA', gerencia: 'TRAD' },
      { codigo: '001', nome: 'Thiago Mendes', equipe: 'TRAB DELTA', gerencia: 'AS' },
    ];

    const currentG = isAdmin ? selectedGerencia : currentUser?.manager || 'TRAD';

    return all.filter((v) => {
      if (currentG !== 'TODAS' && v.gerencia !== currentG) return false;
      if (selectedEquipe !== 'TODAS' && v.equipe !== selectedEquipe) return false;
      return true;
    });
  }, [isVendedor, isSupervisor, isAdmin, currentUser, selectedGerencia, selectedEquipe]);

  // Filtragem dos registros brutos respeitando estritamente a hierarquia RBAC
  const filteredRegistros = useMemo(() => {
    return MOCK_OBJETIVOS.filter((item) => {
      // 1. RBAC estrito do perfil
      if (isGerente) {
        const myGerencia = currentUser.manager || 'TRAD';
        if (item.gerencia !== myGerencia) return false;
      }
      if (isSupervisor) {
        const myTeam = currentUser.team || 'TRAB ALFA';
        if (item.equipe !== myTeam) return false;
      }
      if (isVendedor) {
        const myCode = currentUser.sellerCode || '003';
        if (item.vendedorCodigo !== myCode) return false;
      }

      // 2. Filtros interativos
      if (selectedGerencia !== 'TODAS' && item.gerencia !== selectedGerencia) {
        return false;
      }
      if (selectedEquipe !== 'TODAS' && item.equipe !== selectedEquipe) {
        return false;
      }
      if (selectedVendedor !== 'TODOS' && item.vendedorCodigo !== selectedVendedor) {
        return false;
      }
      if (selectedTipo !== 'TODOS' && item.tipo !== selectedTipo) {
        return false;
      }

      return true;
    });
  }, [isGerente, isSupervisor, isVendedor, currentUser, selectedGerencia, selectedEquipe, selectedVendedor, selectedTipo]);

  // CONSOLIDAÇÃO CIRÚRGICA: CADA OBJETIVO APARECE UMA ÚNICA VEZ NA VISUALIZAÇÃO
  const objetivosUnicos = useMemo<ObjetivoUnicoConsolidado[]>(() => {
    // Lista ordenada dos tipos canônicos de objetivos
    const tiposOrdem: TipoObjetivo[] = ['Faseamento', 'Faseamento II', 'Desconcentração', 'Desafios'];

    const grupos: Record<TipoObjetivo, ObjetivoRegistro[]> = {
      Faseamento: [],
      'Faseamento II': [],
      Desconcentração: [],
      Desafios: [],
    };

    filteredRegistros.forEach((reg) => {
      if (grupos[reg.tipo]) {
        grupos[reg.tipo].push(reg);
      }
    });

    const resultado: ObjetivoUnicoConsolidado[] = [];

    tiposOrdem.forEach((tipo) => {
      const items = grupos[tipo];
      // Se não há registros após filtros e o usuário filtrou por um tipo específico diferente, não exibe
      if (selectedTipo !== 'TODOS' && selectedTipo !== tipo) {
        return;
      }

      // Se há filtro de vendedor ou equipe e não há registros para esse vendedor naquele objetivo, podemos manter ou ocultar
      if (items.length === 0 && (selectedVendedor !== 'TODOS' || selectedEquipe !== 'TODAS' || selectedTipo !== 'TODOS')) {
        return;
      }

      const totalMeta = items.reduce((acc, i) => acc + i.meta, 0);
      const totalRealizado = items.reduce((acc, i) => acc + i.realizado, 0);
      const formato = items[0]?.formato || (tipo === 'Desconcentração' ? 'quantidade' : 'moeda');
      const pct = totalMeta > 0 ? (totalRealizado / totalMeta) * 100 : 0;

      // Datas canônicas do ciclo
      let dataInicio = '01/09/2026';
      let dataFinal = '30/09/2026';
      let descricaoPadrao = '';

      if (tipo === 'Faseamento') {
        dataInicio = '01/09/2026';
        dataFinal = '15/09/2026';
        descricaoPadrao = 'Faseamento 1ª Quinzena';
      } else if (tipo === 'Faseamento II') {
        dataInicio = '16/09/2026';
        dataFinal = '30/09/2026';
        descricaoPadrao = 'Faseamento II - Fechamento 2ª Quinzena';
      } else if (tipo === 'Desconcentração') {
        dataInicio = '01/09/2026';
        dataFinal = '30/09/2026';
        descricaoPadrao = 'Desconcentração de Vendas & Mix';
      } else if (tipo === 'Desafios') {
        dataInicio = '01/09/2026';
        dataFinal = '30/09/2026';
        descricaoPadrao = 'Desafios & Campanhas Comerciais';
      }

      const status: 'Superado' | 'Em Andamento' | 'Atenção' =
        pct >= 100 ? 'Superado' : pct >= 80 ? 'Em Andamento' : 'Atenção';

      resultado.push({
        id: `tipo-${tipo}`,
        tipo,
        nome: tipo,
        descricao: descricaoPadrao,
        meta: totalMeta,
        realizado: totalRealizado,
        formato,
        pct,
        dataInicio,
        dataFinal,
        status,
        registrosContabilizados: items.length,
        registros: items,
      });
    });

    return resultado;
  }, [filteredRegistros, selectedTipo, selectedVendedor, selectedEquipe]);

  // Métricas de topo (KPIs) consolidadas
  const summary = useMemo(() => {
    const moedaItems = filteredRegistros.filter((i) => i.formato === 'moeda');
    const totalMetaMoeda = moedaItems.reduce((acc, i) => acc + i.meta, 0);
    const totalRealizadoMoeda = moedaItems.reduce((acc, i) => acc + i.realizado, 0);
    const pctGeral = totalMetaMoeda > 0 ? (totalRealizadoMoeda / totalMetaMoeda) * 100 : 0;
    const superados = objetivosUnicos.filter((o) => o.pct >= 100).length;

    return {
      totalMetaMoeda,
      totalRealizadoMoeda,
      pctGeral,
      totalObjetivos: objetivosUnicos.length,
      superados,
    };
  }, [filteredRegistros, objetivosUnicos]);

  const formatVal = (val: number, formato: 'moeda' | 'quantidade') => {
    if (formato === 'moeda') {
      return `R$ ${val.toLocaleString('pt-BR')}`;
    }
    return `${val.toLocaleString('pt-BR')} un.`;
  };

  const getTipoBadgeColor = (tipo: TipoObjetivo) => {
    switch (tipo) {
      case 'Faseamento':
        return { bg: 'rgba(59, 130, 246, 0.12)', color: t.accentBlue, border: 'rgba(59, 130, 246, 0.3)' };
      case 'Faseamento II':
        return { bg: 'rgba(147, 51, 234, 0.12)', color: t.accentPurple, border: 'rgba(147, 51, 234, 0.3)' };
      case 'Desconcentração':
        return { bg: 'rgba(234, 179, 8, 0.12)', color: '#eab308', border: 'rgba(234, 179, 8, 0.3)' };
      case 'Desafios':
        return { bg: 'rgba(227, 6, 19, 0.12)', color: t.primary, border: 'rgba(227, 6, 19, 0.3)' };
      default:
        return { bg: t.bgSecondary, color: t.textMuted, border: t.border };
    }
  };

  const handleExportExcel = () => {
    const data = objetivosUnicos.map((item) => ({
      Objetivo: item.nome,
      'Descrição / Finalidade': item.descricao,
      Meta: formatVal(item.meta, item.formato),
      Realizado: formatVal(item.realizado, item.formato),
      '% Atingimento': `${item.pct.toFixed(1)}%`,
      'Data de Início': item.dataInicio,
      'Data Final': item.dataFinal,
      Status: item.status,
      'Registros Contabilizados': item.registrosContabilizados,
    }));

    return [{ sheetName: 'Objetivos Comerciais', data }];
  };

  return (
    <div style={{ paddingBottom: '40px' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '14px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <h1 className="num" style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: t.text }}>
              Objetivos Comerciais
            </h1>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '6px',
                background: 'rgba(227, 6, 19, 0.12)',
                color: t.primary,
                border: '1px solid rgba(227, 6, 19, 0.25)',
              }}
            >
              Comercial
            </span>
          </div>
          <div style={{ fontSize: '12.5px', color: t.textMuted }}>
            Acompanhamento consolidado de metas, faseamento, desconcentração e desafios de vendas
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ExportExcelButton
            filename="Objetivos_Comerciais.xlsx"
            onPrepareData={handleExportExcel}
            label="Exportar Objetivos"
          />
        </div>
      </div>

      {/* Scope Banner if restricted by profile */}
      {(isGerente || isSupervisor || isVendedor) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: 'rgba(59, 130, 246, 0.08)',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            borderRadius: '10px',
            padding: '10px 14px',
            marginBottom: '18px',
            fontSize: '12.5px',
            color: t.text,
          }}
        >
          <Shield size={16} color={t.accentBlue} />
          <span>
            {isGerente && (
              <>
                <strong>Perfil Gerência:</strong> Visualização e filtros restritos exclusivamente aos objetivos da Gerência{' '}
                <strong>{currentUser?.manager || 'TRAD'}</strong> e suas equipes associadas.
              </>
            )}
            {isSupervisor && (
              <>
                <strong>Perfil Supervisor:</strong> Visualização e filtros restritos à equipe{' '}
                <strong>{currentUser?.team || 'TRAB ALFA'}</strong> e aos vendedores liderados.
              </>
            )}
            {isVendedor && (
              <>
                <strong>Perfil Vendedor:</strong> Visualização individual restrita aos seus próprios objetivos (
                <strong>{currentUser?.name || 'Vendedor'}</strong> · Código <strong>{currentUser?.sellerCode || '003'}</strong>).
              </>
            )}
          </span>
        </div>
      )}

      {/* Filters Bar */}
      <div
        style={{
          background: t.surface,
          border: `1px solid ${t.border}`,
          borderRadius: '12px',
          padding: '14px 18px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: t.textSecondary }}>
          <Filter size={15} />
          <span>Filtros:</span>
        </div>

        {/* Gerência Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: t.textMuted }}>Gerência:</span>
          <select
            value={selectedGerencia}
            disabled={!isAdmin}
            onChange={(e) => {
              setSelectedGerencia(e.target.value);
              setSelectedEquipe('TODAS');
              setSelectedVendedor('TODOS');
            }}
            style={{
              background: !isAdmin ? t.surfaceElevated : t.bgSecondary,
              border: `1px solid ${t.border}`,
              borderRadius: '8px',
              padding: '6px 12px',
              color: t.text,
              fontSize: '13px',
              fontWeight: 500,
              outline: 'none',
              cursor: !isAdmin ? 'not-allowed' : 'pointer',
              opacity: !isAdmin ? 0.85 : 1,
            }}
          >
            {availableGerencias.map((g) => (
              <option key={g} value={g}>
                {g === 'TODAS' ? 'Todas as Gerências' : `Gerência ${g}`}
              </option>
            ))}
          </select>
        </div>

        {/* Equipe Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: t.textMuted }}>Equipe:</span>
          <select
            value={selectedEquipe}
            disabled={isSupervisor || isVendedor}
            onChange={(e) => {
              setSelectedEquipe(e.target.value);
              setSelectedVendedor('TODOS');
            }}
            style={{
              background: isSupervisor || isVendedor ? t.surfaceElevated : t.bgSecondary,
              border: `1px solid ${t.border}`,
              borderRadius: '8px',
              padding: '6px 12px',
              color: t.text,
              fontSize: '13px',
              fontWeight: 500,
              outline: 'none',
              cursor: isSupervisor || isVendedor ? 'not-allowed' : 'pointer',
              opacity: isSupervisor || isVendedor ? 0.85 : 1,
            }}
          >
            {availableEquipes.map((eq) => (
              <option key={eq} value={eq}>
                {eq === 'TODAS' ? (isGerente ? 'Todas as Equipes da Gerência' : 'Todas as Equipes') : eq}
              </option>
            ))}
          </select>
        </div>

        {/* Vendedor Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: t.textMuted }}>Vendedor:</span>
          <select
            value={selectedVendedor}
            disabled={isVendedor}
            onChange={(e) => setSelectedVendedor(e.target.value)}
            style={{
              background: isVendedor ? t.surfaceElevated : t.bgSecondary,
              border: `1px solid ${t.border}`,
              borderRadius: '8px',
              padding: '6px 12px',
              color: t.text,
              fontSize: '13px',
              fontWeight: 500,
              outline: 'none',
              cursor: isVendedor ? 'not-allowed' : 'pointer',
              opacity: isVendedor ? 0.85 : 1,
            }}
          >
            {!isVendedor && (
              <option value="TODOS">
                {isSupervisor ? 'Todos os Vendedores da Equipe' : 'Todos os Vendedores'}
              </option>
            )}
            {availableVendedores.map((v) => (
              <option key={v.codigo} value={v.codigo}>
                {v.codigo} - {v.nome}
              </option>
            ))}
          </select>
        </div>

        {/* Tipo de Objetivo Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: t.textMuted }}>Objetivo:</span>
          <select
            value={selectedTipo}
            onChange={(e) => setSelectedTipo(e.target.value)}
            style={{
              background: t.bgSecondary,
              border: `1px solid ${t.border}`,
              borderRadius: '8px',
              padding: '6px 12px',
              color: t.text,
              fontSize: '13px',
              fontWeight: 500,
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="TODOS">Todos os Objetivos</option>
            <option value="Faseamento">Faseamento</option>
            <option value="Faseamento II">Faseamento II</option>
            <option value="Desconcentração">Desconcentração</option>
            <option value="Desafios">Desafios</option>
          </select>
        </div>

        {/* Reset button for Admin/Gerente */}
        {(selectedTipo !== 'TODOS' || (isAdmin && (selectedGerencia !== 'TODAS' || selectedEquipe !== 'TODAS' || selectedVendedor !== 'TODOS')) || (isGerente && (selectedEquipe !== 'TODAS' || selectedVendedor !== 'TODOS')) || (isSupervisor && selectedVendedor !== 'TODOS')) && (
          <button
            onClick={() => {
              setSelectedTipo('TODOS');
              if (isAdmin) {
                setSelectedGerencia('TODAS');
                setSelectedEquipe('TODAS');
                setSelectedVendedor('TODOS');
              } else if (isGerente) {
                setSelectedEquipe('TODAS');
                setSelectedVendedor('TODOS');
              } else if (isSupervisor) {
                setSelectedVendedor('TODOS');
              }
            }}
            style={{
              background: 'transparent',
              border: `1px solid ${t.border}`,
              borderRadius: '8px',
              padding: '6px 12px',
              color: t.textSecondary,
              fontSize: '12px',
              cursor: 'pointer',
              marginLeft: 'auto',
            }}
          >
            Limpar Filtros
          </button>
        )}
      </div>

      {/* Summary KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '14px',
          marginBottom: '22px',
        }}
      >
        <div
          style={{
            background: t.surface,
            border: `1px solid ${t.border}`,
            borderRadius: '12px',
            padding: '16px 18px',
          }}
        >
          <div style={{ fontSize: '13px', color: t.textSecondary, marginBottom: '6px' }}>Meta Total (R$)</div>
          <div className="num" style={{ fontSize: '24px', fontWeight: 800, color: t.text }}>
            R$ {summary.totalMetaMoeda.toLocaleString('pt-BR')}
          </div>
          <div style={{ fontSize: '12px', color: t.textMuted, marginTop: '4px' }}>Objetivos financeiros consolidados</div>
        </div>

        <div
          style={{
            background: t.surface,
            border: `1px solid ${t.border}`,
            borderRadius: '12px',
            padding: '16px 18px',
          }}
        >
          <div style={{ fontSize: '13px', color: t.textSecondary, marginBottom: '6px' }}>Realizado Total (R$)</div>
          <div className="num" style={{ fontSize: '24px', fontWeight: 800, color: t.text }}>
            R$ {summary.totalRealizadoMoeda.toLocaleString('pt-BR')}
          </div>
          <div style={{ fontSize: '12px', color: t.textMuted, marginTop: '4px' }}>Volume total já alcançado</div>
        </div>

        <div
          style={{
            background: t.surface,
            border: `1px solid ${t.border}`,
            borderRadius: '12px',
            padding: '16px 18px',
          }}
        >
          <div style={{ fontSize: '13px', color: t.textSecondary, marginBottom: '6px' }}>% Atingimento Geral</div>
          <div className="num" style={{ fontSize: '24px', fontWeight: 800, color: summary.pctGeral >= 100 ? '#22c55e' : t.primary }}>
            {summary.pctGeral.toFixed(1)}%
          </div>
          <div style={{ fontSize: '12px', color: t.textMuted, marginTop: '4px' }}>Relação Realizado / Meta</div>
        </div>

        <div
          style={{
            background: t.surface,
            border: `1px solid ${t.border}`,
            borderRadius: '12px',
            padding: '16px 18px',
          }}
        >
          <div style={{ fontSize: '13px', color: t.textSecondary, marginBottom: '6px' }}>Objetivos Ativos</div>
          <div className="num" style={{ fontSize: '24px', fontWeight: 800, color: t.text }}>
            {summary.totalObjetivos}
          </div>
          <div style={{ fontSize: '12px', color: '#22c55e', fontWeight: 600, marginTop: '4px' }}>
            {summary.superados} superados (≥ 100%)
          </div>
        </div>
      </div>

      {/* Main Objectives Table - Cada objetivo aparece UMA ÚNICA VEZ */}
      <div
        style={{
          background: t.surface,
          border: `1px solid ${t.border}`,
          borderRadius: '12px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: `1px solid ${t.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: t.text }}>
              Tabela de Desempenho dos Objetivos
            </h3>
            <div style={{ fontSize: '12px', color: t.textMuted, marginTop: '2px' }}>
              Visualização consolidada: cada objetivo aparece uma única vez com suas metas, atingimento e período
            </div>
          </div>
          <div style={{ fontSize: '12.5px', color: t.textSecondary }}>
            Objetivos exibidos: <strong style={{ color: t.text }}>{objetivosUnicos.length}</strong>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: t.bgSecondary, borderBottom: `1px solid ${t.border}` }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: t.textMuted, fontWeight: 600, width: '180px' }}>
                  Objetivo
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: t.textMuted, fontWeight: 600 }}>
                  Descrição
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'right', color: t.textMuted, fontWeight: 600 }}>
                  Meta
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'right', color: t.textMuted, fontWeight: 600 }}>
                  Realizado
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'center', color: t.textMuted, fontWeight: 600, width: '130px' }}>
                  %
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'center', color: t.textMuted, fontWeight: 600 }}>
                  Data de Início
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'center', color: t.textMuted, fontWeight: 600 }}>
                  Data Final
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'center', color: t.textMuted, fontWeight: 600 }}>
                  Status
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'center', color: t.textMuted, fontWeight: 600, width: '90px' }}>
                  Detalhes
                </th>
              </tr>
            </thead>
            <tbody>
              {objetivosUnicos.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '36px 16px', textAlign: 'center', color: t.textMuted }}>
                    Nenhum objetivo localizado para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                objetivosUnicos.map((item) => {
                  const badgeStyle = getTipoBadgeColor(item.tipo);
                  const isExpanded = expandedObjetivo === item.id;

                  return (
                    <React.Fragment key={item.id}>
                      <tr
                        style={{
                          borderBottom: isExpanded ? 'none' : `1px solid ${t.border}`,
                          background: isExpanded ? t.bgSecondary : 'transparent',
                          transition: 'background 0.15s ease',
                        }}
                      >
                        {/* Objetivo */}
                        <td style={{ padding: '14px 16px' }}>
                          <span
                            style={{
                              fontSize: '12px',
                              fontWeight: 700,
                              padding: '4px 10px',
                              borderRadius: '6px',
                              background: badgeStyle.bg,
                              color: badgeStyle.color,
                              border: `1px solid ${badgeStyle.border}`,
                              display: 'inline-block',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {item.nome}
                          </span>
                        </td>

                        {/* Descrição */}
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: 600, color: t.text }}>{item.descricao}</div>
                          <div style={{ fontSize: '11.5px', color: t.textMuted, marginTop: '2px' }}>
                            Consolidado de {item.registrosContabilizados} {item.registrosContabilizados === 1 ? 'registro' : 'registros'} da operação
                          </div>
                        </td>

                        {/* Meta */}
                        <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 600, color: t.text }}>
                          {formatVal(item.meta, item.formato)}
                        </td>

                        {/* Realizado */}
                        <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 600, color: t.text }}>
                          {formatVal(item.realizado, item.formato)}
                        </td>

                        {/* % */}
                        <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                            <span
                              className="num"
                              style={{
                                fontWeight: 700,
                                fontSize: '13px',
                                color: item.pct >= 100 ? '#22c55e' : item.pct >= 80 ? '#eab308' : t.primary,
                              }}
                            >
                              {item.pct.toFixed(1)}%
                            </span>
                            {/* Progress bar */}
                            <div
                              style={{
                                width: '80px',
                                height: '5px',
                                borderRadius: '4px',
                                background: t.border,
                                overflow: 'hidden',
                              }}
                            >
                              <div
                                style={{
                                  width: `${Math.min(item.pct, 100)}%`,
                                  height: '100%',
                                  background: item.pct >= 100 ? '#22c55e' : item.pct >= 80 ? '#eab308' : t.primary,
                                  borderRadius: '4px',
                                }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Data Início */}
                        <td style={{ padding: '14px 16px', textAlign: 'center', color: t.textSecondary, fontSize: '12.5px' }}>
                          {item.dataInicio}
                        </td>

                        {/* Data Final */}
                        <td style={{ padding: '14px 16px', textAlign: 'center', color: t.textSecondary, fontSize: '12.5px' }}>
                          {item.dataFinal}
                        </td>

                        {/* Status */}
                        <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              padding: '3px 8px',
                              borderRadius: '6px',
                              background:
                                item.status === 'Superado'
                                  ? 'rgba(34, 197, 94, 0.12)'
                                  : item.status === 'Em Andamento'
                                  ? 'rgba(59, 130, 246, 0.12)'
                                  : 'rgba(239, 68, 68, 0.12)',
                              color:
                                item.status === 'Superado'
                                  ? '#22c55e'
                                  : item.status === 'Em Andamento'
                                  ? t.accentBlue
                                  : '#ef4444',
                            }}
                          >
                            {item.status}
                          </span>
                        </td>

                        {/* Ação de Ver Composição */}
                        <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                          <button
                            onClick={() => setExpandedObjetivo(isExpanded ? null : item.id)}
                            style={{
                              background: 'transparent',
                              border: `1px solid ${t.border}`,
                              borderRadius: '6px',
                              padding: '4px 8px',
                              fontSize: '11px',
                              fontWeight: 600,
                              color: isExpanded ? t.primary : t.textSecondary,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <span>{isExpanded ? 'Recolher' : 'Ver'}</span>
                            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          </button>
                        </td>
                      </tr>

                      {/* Linha de Composição dos Registros (expandível, sem duplicar a linha principal do objetivo) */}
                      {isExpanded && (
                        <tr style={{ background: t.bgSecondary, borderBottom: `1px solid ${t.border}` }}>
                          <td colSpan={9} style={{ padding: '12px 20px 16px 20px' }}>
                            <div
                              style={{
                                background: t.surface,
                                border: `1px solid ${t.border}`,
                                borderRadius: '8px',
                                padding: '12px 14px',
                              }}
                            >
                              <div style={{ fontSize: '12px', fontWeight: 700, color: t.textSecondary, marginBottom: '8px' }}>
                                Composição dos Registros de {item.nome} ({item.registros.length} {item.registros.length === 1 ? 'registro cadastrado' : 'registros cadastrados'}):
                              </div>
                              <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                                  <thead>
                                    <tr style={{ borderBottom: `1px solid ${t.border}`, color: t.textMuted }}>
                                      <th style={{ padding: '6px 10px', textAlign: 'left' }}>Item / Detalhe</th>
                                      <th style={{ padding: '6px 10px', textAlign: 'left' }}>Gerência</th>
                                      <th style={{ padding: '6px 10px', textAlign: 'left' }}>Equipe</th>
                                      <th style={{ padding: '6px 10px', textAlign: 'left' }}>Vendedor</th>
                                      <th style={{ padding: '6px 10px', textAlign: 'right' }}>Meta</th>
                                      <th style={{ padding: '6px 10px', textAlign: 'right' }}>Realizado</th>
                                      <th style={{ padding: '6px 10px', textAlign: 'center' }}>%</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {item.registros.map((sub) => {
                                      const subPct = sub.meta > 0 ? (sub.realizado / sub.meta) * 100 : 0;
                                      return (
                                        <tr key={sub.id} style={{ borderBottom: `1px solid ${t.border}` }}>
                                          <td style={{ padding: '6px 10px', fontWeight: 500, color: t.text }}>
                                            {sub.descricao}
                                          </td>
                                          <td style={{ padding: '6px 10px', color: t.textSecondary }}>{sub.gerencia}</td>
                                          <td style={{ padding: '6px 10px', color: t.textSecondary }}>{sub.equipe}</td>
                                          <td style={{ padding: '6px 10px', color: t.textSecondary }}>
                                            {sub.vendedorNome || '-'}
                                          </td>
                                          <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>
                                            {formatVal(sub.meta, sub.formato)}
                                          </td>
                                          <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>
                                            {formatVal(sub.realizado, sub.formato)}
                                          </td>
                                          <td style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 700, color: subPct >= 100 ? '#22c55e' : t.primary }}>
                                            {subPct.toFixed(1)}%
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
