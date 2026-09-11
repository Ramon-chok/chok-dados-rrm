import React, { useState, useMemo } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { ExportExcelButton } from '../../components/common/ExportExcelButton';
import {
  Calendar,
  Users,
  UserCheck,
  CheckCircle2,
  Clock,
  Navigation,
  MapPin,
  TrendingUp,
  AlertTriangle,
  Compass,
  Filter,
  Shield,
  Activity,
  Layers,
} from 'lucide-react';

export interface ClienteRotaItem {
  seq: number;
  codigo: string;
  nome: string;
  cidade: string;
  visitaPrevista: string; // 'Sim' ou 'Não'
  checkIn: string; // '07:42' ou '-'
  positivado: boolean;
  positivacao: 'Positivado' | 'Não Positivado';
  valorPedido: number; // e.g. 14200 (se 0 exibe '-')
  motivoNaoVenda: string; // e.g. 'Estoque cheio' ou '-'
  motivoNaoVisita: string; // e.g. 'Estabelecimento fechado' ou '-'
}

export interface VendedorRaioX {
  codigo: string;
  nome: string;
  equipe: string;
  gerencia: string; // 'TRAD' | 'AS'
  supervisor: string;
  // Positivação Diária
  positivacaoDiaPrevisto: number;
  positivacaoDiaRealizado: number;
  // Positivação Acumulada
  positivacaoAcumPrevisto: number;
  positivacaoAcumRealizado: number;
  // Fora de Rota
  foraRotaDia: number;
  foraRotaAcum: number;
  // Visitas Diárias
  visitasDiaPrevisto: number;
  visitasDiaRealizado: number;
  visitasDiaForaRota: number;
  // Visitas Acumuladas
  visitasAcumPrevisto: number;
  visitasAcumRealizado: number;
  visitasAcumForaRota: number;
  // Check-ins do Dia
  primeiroCheckIn: string;
  ultimoCheckIn: string;
  statusRota: 'Finalizada' | 'Em Andamento' | 'Pendente';
  // Clientes da Rota do Vendedor
  clientesHoje?: ClienteRotaItem[];
}

const MOCK_RAIOX_DATA: VendedorRaioX[] = [
  {
    codigo: '003',
    nome: 'João Souza',
    equipe: 'TRAB ALFA',
    gerencia: 'TRAD',
    supervisor: 'Supervisor A',
    positivacaoDiaPrevisto: 12,
    positivacaoDiaRealizado: 11,
    positivacaoAcumPrevisto: 118,
    positivacaoAcumRealizado: 104,
    foraRotaDia: 2,
    foraRotaAcum: 14,
    visitasDiaPrevisto: 15,
    visitasDiaRealizado: 14,
    visitasDiaForaRota: 2,
    visitasAcumPrevisto: 145,
    visitasAcumRealizado: 132,
    visitasAcumForaRota: 16,
    primeiroCheckIn: '07:42',
    ultimoCheckIn: '17:15',
    statusRota: 'Finalizada',
    clientesHoje: [
      {
        seq: 1,
        codigo: '00021',
        nome: 'Mercado Bom Preço',
        cidade: 'Ribeirão Preto',
        visitaPrevista: 'Sim',
        checkIn: '07:42',
        positivado: true,
        positivacao: 'Positivado',
        valorPedido: 14200,
        motivoNaoVenda: '-',
        motivoNaoVisita: '-',
      },
      {
        seq: 2,
        codigo: '00034',
        nome: 'Atacado Central',
        cidade: 'Ribeirão Preto',
        visitaPrevista: 'Sim',
        checkIn: '08:35',
        positivado: true,
        positivacao: 'Positivado',
        valorPedido: 11800,
        motivoNaoVenda: '-',
        motivoNaoVisita: '-',
      },
      {
        seq: 3,
        codigo: '00145',
        nome: 'Mercadinho Trevo',
        cidade: 'Ribeirão Preto',
        visitaPrevista: 'Sim',
        checkIn: '09:20',
        positivado: true,
        positivacao: 'Positivado',
        valorPedido: 6450,
        motivoNaoVenda: '-',
        motivoNaoVisita: '-',
      },
      {
        seq: 4,
        codigo: '00184',
        nome: 'Padaria São José',
        cidade: 'Ribeirão Preto',
        visitaPrevista: 'Sim',
        checkIn: '10:15',
        positivado: false,
        positivacao: 'Não Positivado',
        valorPedido: 0,
        motivoNaoVenda: 'Estoque abastecido',
        motivoNaoVisita: '-',
      },
      {
        seq: 5,
        codigo: '00210',
        nome: 'Empório Del Rey',
        cidade: 'Ribeirão Preto',
        visitaPrevista: 'Sim',
        checkIn: '11:05',
        positivado: true,
        positivacao: 'Positivado',
        valorPedido: 8900,
        motivoNaoVenda: '-',
        motivoNaoVisita: '-',
      },
      {
        seq: 6,
        codigo: '00297',
        nome: 'Supermercado Progresso',
        cidade: 'Sertãozinho',
        visitaPrevista: 'Sim',
        checkIn: '12:40',
        positivado: true,
        positivacao: 'Positivado',
        valorPedido: 15300,
        motivoNaoVenda: '-',
        motivoNaoVisita: '-',
      },
      {
        seq: 7,
        codigo: '00325',
        nome: 'Mini Mercado Sol',
        cidade: 'Sertãozinho',
        visitaPrevista: 'Sim',
        checkIn: '13:30',
        positivado: true,
        positivacao: 'Positivado',
        valorPedido: 4200,
        motivoNaoVenda: '-',
        motivoNaoVisita: '-',
      },
      {
        seq: 8,
        codigo: '00412',
        nome: 'Empório Bom Gosto',
        cidade: 'Ribeirão Preto',
        visitaPrevista: 'Não',
        checkIn: '14:15',
        positivado: true,
        positivacao: 'Positivado',
        valorPedido: 7800,
        motivoNaoVenda: '-',
        motivoNaoVisita: '-',
      },
      {
        seq: 9,
        codigo: '00488',
        nome: 'Casa de Carnes Boi Gordo',
        cidade: 'Ribeirão Preto',
        visitaPrevista: 'Sim',
        checkIn: '15:10',
        positivado: true,
        positivacao: 'Positivado',
        valorPedido: 5100,
        motivoNaoVenda: '-',
        motivoNaoVisita: '-',
      },
      {
        seq: 10,
        codigo: '00512',
        nome: 'Mercearia Santa Rita',
        cidade: 'Ribeirão Preto',
        visitaPrevista: 'Não',
        checkIn: '15:55',
        positivado: true,
        positivacao: 'Positivado',
        valorPedido: 9200,
        motivoNaoVenda: '-',
        motivoNaoVisita: '-',
      },
      {
        seq: 11,
        codigo: '00558',
        nome: 'Mercado Nova Aliança',
        cidade: 'Sertãozinho',
        visitaPrevista: 'Sim',
        checkIn: '16:40',
        positivado: true,
        positivacao: 'Positivado',
        valorPedido: 6700,
        motivoNaoVenda: '-',
        motivoNaoVisita: '-',
      },
      {
        seq: 12,
        codigo: '00602',
        nome: 'Confeitaria Doce Mel',
        cidade: 'Ribeirão Preto',
        visitaPrevista: 'Sim',
        checkIn: '17:15',
        positivado: true,
        positivacao: 'Positivado',
        valorPedido: 3950,
        motivoNaoVenda: '-',
        motivoNaoVisita: '-',
      },
      {
        seq: 13,
        codigo: '00671',
        nome: 'Distribuidora Sabor',
        cidade: 'Jaboticabal',
        visitaPrevista: 'Sim',
        checkIn: '-',
        positivado: false,
        positivacao: 'Não Positivado',
        valorPedido: 0,
        motivoNaoVenda: '-',
        motivoNaoVisita: 'Estabelecimento fechado',
      },
    ],
  },
  {
    codigo: '004',
    nome: 'Lucas Lima',
    equipe: 'TRAB ALFA',
    gerencia: 'TRAD',
    supervisor: 'Supervisor A',
    positivacaoDiaPrevisto: 14,
    positivacaoDiaRealizado: 12,
    positivacaoAcumPrevisto: 126,
    positivacaoAcumRealizado: 110,
    foraRotaDia: 1,
    foraRotaAcum: 11,
    visitasDiaPrevisto: 16,
    visitasDiaRealizado: 15,
    visitasDiaForaRota: 1,
    visitasAcumPrevisto: 152,
    visitasAcumRealizado: 141,
    visitasAcumForaRota: 13,
    primeiroCheckIn: '07:55',
    ultimoCheckIn: '17:02',
    statusRota: 'Finalizada',
  },
  {
    codigo: '012',
    nome: 'Rafael Costa',
    equipe: 'TRAB ALFA',
    gerencia: 'TRAD',
    supervisor: 'Supervisor A',
    positivacaoDiaPrevisto: 11,
    positivacaoDiaRealizado: 9,
    positivacaoAcumPrevisto: 110,
    positivacaoAcumRealizado: 92,
    foraRotaDia: 2,
    foraRotaAcum: 15,
    visitasDiaPrevisto: 14,
    visitasDiaRealizado: 12,
    visitasDiaForaRota: 2,
    visitasAcumPrevisto: 138,
    visitasAcumRealizado: 120,
    visitasAcumForaRota: 18,
    primeiroCheckIn: '08:12',
    ultimoCheckIn: '16:48',
    statusRota: 'Finalizada',
  },
  {
    codigo: '015',
    nome: 'Bruno Martins',
    equipe: 'TRAB ALFA',
    gerencia: 'TRAD',
    supervisor: 'Supervisor A',
    positivacaoDiaPrevisto: 13,
    positivacaoDiaRealizado: 10,
    positivacaoAcumPrevisto: 115,
    positivacaoAcumRealizado: 98,
    foraRotaDia: 1,
    foraRotaAcum: 9,
    visitasDiaPrevisto: 15,
    visitasDiaRealizado: 13,
    visitasDiaForaRota: 1,
    visitasAcumPrevisto: 142,
    visitasAcumRealizado: 124,
    visitasAcumForaRota: 12,
    primeiroCheckIn: '08:05',
    ultimoCheckIn: '16:40',
    statusRota: 'Finalizada',
  },
  // Equipe TRAB BETA
  {
    codigo: '008',
    nome: 'Mariana Dias',
    equipe: 'TRAB BETA',
    gerencia: 'TRAD',
    supervisor: 'Supervisor B',
    positivacaoDiaPrevisto: 16,
    positivacaoDiaRealizado: 15,
    positivacaoAcumPrevisto: 145,
    positivacaoAcumRealizado: 138,
    foraRotaDia: 3,
    foraRotaAcum: 18,
    visitasDiaPrevisto: 18,
    visitasDiaRealizado: 18,
    visitasDiaForaRota: 3,
    visitasAcumPrevisto: 168,
    visitasAcumRealizado: 160,
    visitasAcumForaRota: 22,
    primeiroCheckIn: '07:25',
    ultimoCheckIn: '17:45',
    statusRota: 'Finalizada',
  },
  {
    codigo: '011',
    nome: 'Felipe Rocha',
    equipe: 'TRAB BETA',
    gerencia: 'TRAD',
    supervisor: 'Supervisor B',
    positivacaoDiaPrevisto: 14,
    positivacaoDiaRealizado: 12,
    positivacaoAcumPrevisto: 130,
    positivacaoAcumRealizado: 114,
    foraRotaDia: 1,
    foraRotaAcum: 12,
    visitasDiaPrevisto: 16,
    visitasDiaRealizado: 14,
    visitasDiaForaRota: 1,
    visitasAcumPrevisto: 148,
    visitasAcumRealizado: 133,
    visitasAcumForaRota: 14,
    primeiroCheckIn: '07:48',
    ultimoCheckIn: '17:05',
    statusRota: 'Finalizada',
  },
  {
    codigo: '018',
    nome: 'Juliana Castro',
    equipe: 'TRAB BETA',
    gerencia: 'TRAD',
    supervisor: 'Supervisor B',
    positivacaoDiaPrevisto: 12,
    positivacaoDiaRealizado: 11,
    positivacaoAcumPrevisto: 118,
    positivacaoAcumRealizado: 102,
    foraRotaDia: 1,
    foraRotaAcum: 8,
    visitasDiaPrevisto: 15,
    visitasDiaRealizado: 13,
    visitasDiaForaRota: 1,
    visitasAcumPrevisto: 139,
    visitasAcumRealizado: 122,
    visitasAcumForaRota: 10,
    primeiroCheckIn: '08:10',
    ultimoCheckIn: '16:30',
    statusRota: 'Finalizada',
  },
  // Equipe TRAB GAMA
  {
    codigo: '007',
    nome: 'André Souza',
    equipe: 'TRAB GAMA',
    gerencia: 'TRAD',
    supervisor: 'Supervisor C',
    positivacaoDiaPrevisto: 13,
    positivacaoDiaRealizado: 11,
    positivacaoAcumPrevisto: 122,
    positivacaoAcumRealizado: 105,
    foraRotaDia: 2,
    foraRotaAcum: 14,
    visitasDiaPrevisto: 15,
    visitasDiaRealizado: 13,
    visitasDiaForaRota: 2,
    visitasAcumPrevisto: 144,
    visitasAcumRealizado: 129,
    visitasAcumForaRota: 16,
    primeiroCheckIn: '07:50',
    ultimoCheckIn: '17:10',
    statusRota: 'Finalizada',
  },
  {
    codigo: '020',
    nome: 'Camila Prado',
    equipe: 'TRAB GAMA',
    gerencia: 'TRAD',
    supervisor: 'Supervisor C',
    positivacaoDiaPrevisto: 15,
    positivacaoDiaRealizado: 14,
    positivacaoAcumPrevisto: 138,
    positivacaoAcumRealizado: 129,
    foraRotaDia: 2,
    foraRotaAcum: 16,
    visitasDiaPrevisto: 18,
    visitasDiaRealizado: 17,
    visitasDiaForaRota: 2,
    visitasAcumPrevisto: 165,
    visitasAcumRealizado: 156,
    visitasAcumForaRota: 19,
    primeiroCheckIn: '07:30',
    ultimoCheckIn: '17:35',
    statusRota: 'Finalizada',
  },
  // Equipe TRAB DELTA (Gerência AS)
  {
    codigo: '001',
    nome: 'Thiago Mendes',
    equipe: 'TRAB DELTA',
    gerencia: 'AS',
    supervisor: 'Supervisor D',
    positivacaoDiaPrevisto: 11,
    positivacaoDiaRealizado: 10,
    positivacaoAcumPrevisto: 112,
    positivacaoAcumRealizado: 99,
    foraRotaDia: 1,
    foraRotaAcum: 10,
    visitasDiaPrevisto: 14,
    visitasDiaRealizado: 13,
    visitasDiaForaRota: 1,
    visitasAcumPrevisto: 136,
    visitasAcumRealizado: 125,
    visitasAcumForaRota: 12,
    primeiroCheckIn: '08:00',
    ultimoCheckIn: '16:50',
    statusRota: 'Finalizada',
  },
  {
    codigo: '005',
    nome: 'Eduardo Santos',
    equipe: 'TRAB DELTA',
    gerencia: 'AS',
    supervisor: 'Supervisor D',
    positivacaoDiaPrevisto: 12,
    positivacaoDiaRealizado: 10,
    positivacaoAcumPrevisto: 116,
    positivacaoAcumRealizado: 101,
    foraRotaDia: 1,
    foraRotaAcum: 12,
    visitasDiaPrevisto: 15,
    visitasDiaRealizado: 13,
    visitasDiaForaRota: 1,
    visitasAcumPrevisto: 140,
    visitasAcumRealizado: 126,
    visitasAcumForaRota: 14,
    primeiroCheckIn: '08:15',
    ultimoCheckIn: '17:05',
    statusRota: 'Finalizada',
  },
];

export const RaioXPage: React.FC = () => {
  const { t } = useTheme();
  const { currentUser } = useAuth();

  // Selected date
  const [selectedDate, setSelectedDate] = useState('2026-09-10');

  // Hierarchy filter states
  const [selectedEquipe, setSelectedEquipe] = useState<string>(() => {
    if (currentUser?.role === 'SUPERVISOR') {
      return currentUser.team || 'TRAB ALFA';
    }
    if (currentUser?.role === 'VENDEDOR') {
      return currentUser.team || 'TRAB ALFA';
    }
    return 'TODAS';
  });

  const [selectedVendedor, setSelectedVendedor] = useState<string>(() => {
    if (currentUser?.role === 'VENDEDOR') {
      return currentUser.sellerCode || '003';
    }
    return 'TODOS';
  });

  const isVendedorScope = currentUser?.role === 'VENDEDOR';
  const isSupervisorScope = currentUser?.role === 'SUPERVISOR';
  const isGerenteScope = currentUser?.role === 'GERENTE';

  // Allowed teams based on role
  const availableEquipes = useMemo(() => {
    if (!currentUser || currentUser.role === 'ADMIN') {
      return ['TODAS', 'TRAB ALFA', 'TRAB BETA', 'TRAB GAMA', 'TRAB DELTA'];
    }
    if (currentUser.role === 'GERENTE') {
      const myGerencia = currentUser.manager || 'TRAD';
      if (myGerencia === 'TRAD') {
        return ['TODAS', 'TRAB ALFA', 'TRAB BETA', 'TRAB GAMA'];
      }
      if (myGerencia === 'AS') {
        return ['TODAS', 'TRAB DELTA'];
      }
      return ['TODAS'];
    }
    if (currentUser.role === 'SUPERVISOR') {
      return [currentUser.team || 'TRAB ALFA'];
    }
    if (currentUser.role === 'VENDEDOR') {
      return [currentUser.team || 'TRAB ALFA'];
    }
    return ['TODAS'];
  }, [currentUser]);

  // Allowed sellers based on role and selected team
  const availableVendedores = useMemo(() => {
    if (currentUser?.role === 'VENDEDOR') {
      return MOCK_RAIOX_DATA.filter((v) => v.codigo === (currentUser.sellerCode || '003'));
    }
    if (currentUser?.role === 'SUPERVISOR') {
      const myTeam = currentUser.team || 'TRAB ALFA';
      return MOCK_RAIOX_DATA.filter((v) => v.equipe === myTeam);
    }
    if (currentUser?.role === 'GERENTE') {
      const myGerencia = currentUser.manager || 'TRAD';
      const base = MOCK_RAIOX_DATA.filter((v) => v.gerencia === myGerencia);
      if (selectedEquipe === 'TODAS') return base;
      return base.filter((v) => v.equipe === selectedEquipe);
    }
    // Admin
    if (selectedEquipe === 'TODAS') {
      return MOCK_RAIOX_DATA;
    }
    return MOCK_RAIOX_DATA.filter((v) => v.equipe === selectedEquipe);
  }, [currentUser, selectedEquipe]);

  // Filtered dataset strictly respecting RBAC
  const filteredData = useMemo(() => {
    return MOCK_RAIOX_DATA.filter((v) => {
      // 1. RBAC baseline security
      if (currentUser?.role === 'GERENTE') {
        const myGerencia = currentUser.manager || 'TRAD';
        if (v.gerencia !== myGerencia) return false;
      }
      if (currentUser?.role === 'SUPERVISOR') {
        const myTeam = currentUser.team || 'TRAB ALFA';
        if (v.equipe !== myTeam) return false;
      }
      if (currentUser?.role === 'VENDEDOR') {
        const myCode = currentUser.sellerCode || '003';
        if (v.codigo !== myCode) return false;
      }

      // 2. User interactive filter application
      if (selectedEquipe !== 'TODAS' && v.equipe !== selectedEquipe) {
        return false;
      }
      if (selectedVendedor !== 'TODOS' && v.codigo !== selectedVendedor) {
        return false;
      }

      return true;
    });
  }, [currentUser, selectedEquipe, selectedVendedor]);

  // Aggregations for the indicators
  const totals = useMemo(() => {
    const prevDia = filteredData.reduce((acc, v) => acc + v.positivacaoDiaPrevisto, 0);
    const realDia = filteredData.reduce((acc, v) => acc + v.positivacaoDiaRealizado, 0);
    const prevAcum = filteredData.reduce((acc, v) => acc + v.positivacaoAcumPrevisto, 0);
    const realAcum = filteredData.reduce((acc, v) => acc + v.positivacaoAcumRealizado, 0);

    const foraRotaDia = filteredData.reduce((acc, v) => acc + v.foraRotaDia, 0);
    const foraRotaAcum = filteredData.reduce((acc, v) => acc + v.foraRotaAcum, 0);

    const visPrevDia = filteredData.reduce((acc, v) => acc + v.visitasDiaPrevisto, 0);
    const visRealDia = filteredData.reduce((acc, v) => acc + v.visitasDiaRealizado, 0);
    const visForaRotaDia = filteredData.reduce((acc, v) => acc + v.visitasDiaForaRota, 0);

    const visPrevAcum = filteredData.reduce((acc, v) => acc + v.visitasAcumPrevisto, 0);
    const visRealAcum = filteredData.reduce((acc, v) => acc + v.visitasAcumRealizado, 0);
    const visForaRotaAcum = filteredData.reduce((acc, v) => acc + v.visitasAcumForaRota, 0);

    // Check-in times: earliest first check-in and latest last check-in
    let primeiroCheckIn = '--:--';
    let ultimoCheckIn = '--:--';

    if (filteredData.length > 0) {
      const sortedFirst = [...filteredData].sort((a, b) => a.primeiroCheckIn.localeCompare(b.primeiroCheckIn));
      const sortedLast = [...filteredData].sort((a, b) => b.ultimoCheckIn.localeCompare(a.ultimoCheckIn));
      primeiroCheckIn = sortedFirst[0].primeiroCheckIn;
      ultimoCheckIn = sortedLast[0].ultimoCheckIn;
    }

    return {
      prevDia,
      realDia,
      pctDia: prevDia > 0 ? (realDia / prevDia) * 100 : 0,
      prevAcum,
      realAcum,
      pctAcum: prevAcum > 0 ? (realAcum / prevAcum) * 100 : 0,
      foraRotaDia,
      foraRotaAcum,
      visPrevDia,
      visRealDia,
      visPctDia: visPrevDia > 0 ? (visRealDia / visPrevDia) * 100 : 0,
      visForaRotaDia,
      visPrevAcum,
      visRealAcum,
      visPctAcum: visPrevAcum > 0 ? (visRealAcum / visPrevAcum) * 100 : 0,
      visForaRotaAcum,
      primeiroCheckIn,
      ultimoCheckIn,
    };
  }, [filteredData]);

  // Formatter for date display
  const formattedSelectedDate = useMemo(() => {
    if (!selectedDate) return '';
    const [year, month, day] = selectedDate.split('-');
    return `${day}/${month}/${year}`;
  }, [selectedDate]);

  // Clientes da rota do Vendedor ordenados estritamente pela sequência da rota
  const vendedorClientesSorted = useMemo(() => {
    if (!isVendedorScope || !filteredData[0]?.clientesHoje) return [];
    return [...filteredData[0].clientesHoje].sort((a, b) => a.seq - b.seq);
  }, [isVendedorScope, filteredData]);

  // Export to Excel
  const handleExportData = () => {
    if (isVendedorScope && vendedorClientesSorted.length > 0) {
      const data = vendedorClientesSorted.map((c) => ({
        'Código do Cliente': c.codigo,
        'Nome do Cliente': c.nome,
        Cidade: c.cidade,
        'Visita Prevista': c.visitaPrevista,
        'Check-in': c.checkIn && c.checkIn !== '-' ? c.checkIn : '-',
        Positivação: c.positivacao,
        'Valor do Pedido': c.valorPedido > 0 ? `R$ ${c.valorPedido.toLocaleString('pt-BR')}` : '-',
        'Motivo de Não Venda': c.motivoNaoVenda && c.motivoNaoVenda !== '-' ? c.motivoNaoVenda : '-',
        'Motivo de Não Visita': c.motivoNaoVisita && c.motivoNaoVisita !== '-' ? c.motivoNaoVisita : '-',
      }));
      return [{ sheetName: 'Sequência da Rota', data }];
    }

    const data = filteredData.map((v) => ({
      Data: formattedSelectedDate,
      Código: v.codigo,
      Vendedor: v.nome,
      Equipe: v.equipe,
      Supervisor: v.supervisor,
      'Posit. Dia Previsto': v.positivacaoDiaPrevisto,
      'Posit. Dia Realizado': v.positivacaoDiaRealizado,
      'Posit. Dia Atingimento %': Number(((v.positivacaoDiaRealizado / v.positivacaoDiaPrevisto) * 100).toFixed(1)),
      'Posit. Acum Previsto': v.positivacaoAcumPrevisto,
      'Posit. Acum Realizado': v.positivacaoAcumRealizado,
      'Posit. Acum Atingimento %': Number(((v.positivacaoAcumRealizado / v.positivacaoAcumPrevisto) * 100).toFixed(1)),
      'Fora de Rota Dia': v.foraRotaDia,
      'Fora de Rota Acumulado': v.foraRotaAcum,
      'Visitas Dia Previstas': v.visitasDiaPrevisto,
      'Visitas Dia Realizadas': v.visitasDiaRealizado,
      'Visitas Dia Fora Rota': v.visitasDiaForaRota,
      'Visitas Acum Previstas': v.visitasAcumPrevisto,
      'Visitas Acum Realizadas': v.visitasAcumRealizado,
      'Visitas Acum Fora Rota': v.visitasAcumForaRota,
      '1º Check-in': v.primeiroCheckIn,
      'Último Check-in': v.ultimoCheckIn,
      Status: v.statusRota,
    }));

    return [{ sheetName: 'Raio-X Operacional', data }];
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
              Raio-X da Operação
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
              SAR
            </span>
          </div>
          <div style={{ fontSize: '12.5px', color: t.textMuted }}>
            Acompanhamento diário da operação de vendas e roteirização · Data de Análise:{' '}
            <strong style={{ color: t.text }}>{formattedSelectedDate}</strong>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <ExportExcelButton
            filename={`RaioX_Operacao_${selectedDate}.xlsx`}
            onPrepareData={handleExportData}
            label="Exportar Raio-X"
          />
        </div>
      </div>

      {/* Scope Banner if restricted by profile */}
      {(isGerenteScope || isSupervisorScope || isVendedorScope) && (
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
            {isGerenteScope && (
              <>
                <strong>Perfil Gerência:</strong> Visualização restrita aos vendedores da Gerência{' '}
                <strong>{currentUser?.manager || 'TRAD'}</strong> e suas equipes associadas.
              </>
            )}
            {isSupervisorScope && (
              <>
                <strong>Perfil Supervisor:</strong> Visualização restrita à equipe{' '}
                <strong>{currentUser?.team || 'TRAB ALFA'}</strong> e aos respectivos vendedores liderados.
              </>
            )}
            {isVendedorScope && (
              <>
                <strong>Perfil Vendedor:</strong> Visualização individual restrita aos seus próprios indicadores e rota (
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
          <span>Filtros do Raio-X:</span>
        </div>

        {/* Date Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: t.textMuted }}>Data de Análise:</span>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: t.bgSecondary,
              border: `1px solid ${t.border}`,
              borderRadius: '8px',
              padding: '6px 10px',
            }}
          >
            <Calendar size={14} color={t.primary} />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                border: 'none',
                background: 'transparent',
                color: t.text,
                fontSize: '13px',
                fontWeight: 600,
                outline: 'none',
                fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            />
          </div>
        </div>

        {/* Equipe Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: t.textMuted }}>Equipe:</span>
          <select
            value={selectedEquipe}
            disabled={isSupervisorScope || isVendedorScope}
            onChange={(e) => {
              setSelectedEquipe(e.target.value);
              setSelectedVendedor('TODOS');
            }}
            style={{
              background: isSupervisorScope || isVendedorScope ? t.surfaceElevated : t.bgSecondary,
              border: `1px solid ${t.border}`,
              borderRadius: '8px',
              padding: '6px 12px',
              color: t.text,
              fontSize: '13px',
              fontWeight: 500,
              outline: 'none',
              cursor: isSupervisorScope || isVendedorScope ? 'not-allowed' : 'pointer',
              opacity: isSupervisorScope || isVendedorScope ? 0.85 : 1,
            }}
          >
            {availableEquipes.map((eq) => (
              <option key={eq} value={eq}>
                {eq === 'TODAS' ? (isGerenteScope ? 'Todas as Equipes da Gerência' : 'Todas as Equipes') : eq}
              </option>
            ))}
          </select>
        </div>

        {/* Vendedor Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: t.textMuted }}>Vendedor:</span>
          <select
            value={selectedVendedor}
            disabled={isVendedorScope}
            onChange={(e) => setSelectedVendedor(e.target.value)}
            style={{
              background: isVendedorScope ? t.surfaceElevated : t.bgSecondary,
              border: `1px solid ${t.border}`,
              borderRadius: '8px',
              padding: '6px 12px',
              color: t.text,
              fontSize: '13px',
              fontWeight: 500,
              outline: 'none',
              cursor: isVendedorScope ? 'not-allowed' : 'pointer',
              opacity: isVendedorScope ? 0.85 : 1,
            }}
          >
            {!isVendedorScope && (
              <option value="TODOS">
                {isSupervisorScope ? 'Todos os Vendedores da Equipe' : 'Todos os Vendedores'}
              </option>
            )}
            {availableVendedores.map((v) => (
              <option key={v.codigo} value={v.codigo}>
                {v.codigo} - {v.nome}
              </option>
            ))}
          </select>
        </div>

        {/* Reset button for Admin/Gerente/Supervisor */}
        {((!isSupervisorScope && !isVendedorScope && (selectedEquipe !== 'TODAS' || selectedVendedor !== 'TODOS')) ||
          (isSupervisorScope && selectedVendedor !== 'TODOS')) && (
          <button
            onClick={() => {
              if (!isSupervisorScope && !isVendedorScope) {
                setSelectedEquipe('TODAS');
                setSelectedVendedor('TODOS');
              } else if (isSupervisorScope) {
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

      {/* 1. SEÇÃO POSITIVAÇÃO & FORA DE ROTA */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <CheckCircle2 size={18} color={t.primary} />
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: t.text }}>
            Positivação & Fora de Rota
          </h2>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '14px',
          }}
        >
          {/* Card: Positivação Diária */}
          <div
            style={{
              background: t.surface,
              border: `1px solid ${t.border}`,
              borderRadius: '12px',
              padding: '16px 18px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: t.textSecondary }}>
                  Positivação Diária
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 7px',
                    borderRadius: '6px',
                    background: totals.pctDia >= 100 ? 'rgba(34, 197, 94, 0.12)' : 'rgba(227, 6, 19, 0.12)',
                    color: totals.pctDia >= 100 ? '#22c55e' : t.primary,
                  }}
                >
                  {totals.pctDia.toFixed(1)}% ating.
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '6px' }}>
                <span className="num" style={{ fontSize: '26px', fontWeight: 800, color: t.text }}>
                  {totals.realDia}
                </span>
                <span style={{ fontSize: '13px', color: t.textMuted }}>
                  / Previsto: <strong style={{ color: t.textSecondary }}>{totals.prevDia}</strong>
                </span>
              </div>

              {/* Progress bar */}
              <div
                style={{
                  width: '100%',
                  height: '6px',
                  borderRadius: '3px',
                  background: t.border,
                  overflow: 'hidden',
                  marginBottom: '8px',
                }}
              >
                <div
                  style={{
                    width: `${Math.min(totals.pctDia, 100)}%`,
                    height: '100%',
                    background: totals.pctDia >= 100 ? '#22c55e' : t.primary,
                    borderRadius: '3px',
                  }}
                />
              </div>
            </div>

            <div style={{ paddingTop: '8px', borderTop: `1px solid ${t.border}`, fontSize: '12px', color: t.textMuted }}>
              Clientes positivados no dia em relação ao previsto
            </div>
          </div>

          {/* Card: Positivação Acumulada */}
          <div
            style={{
              background: t.surface,
              border: `1px solid ${t.border}`,
              borderRadius: '12px',
              padding: '16px 18px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: t.textSecondary }}>
                  Positivação Acumulada
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 7px',
                    borderRadius: '6px',
                    background: totals.pctAcum >= 100 ? 'rgba(34, 197, 94, 0.12)' : 'rgba(227, 6, 19, 0.12)',
                    color: totals.pctAcum >= 100 ? '#22c55e' : t.primary,
                  }}
                >
                  {totals.pctAcum.toFixed(1)}% ating.
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '6px' }}>
                <span className="num" style={{ fontSize: '26px', fontWeight: 800, color: t.text }}>
                  {totals.realAcum}
                </span>
                <span style={{ fontSize: '13px', color: t.textMuted }}>
                  / Previsto: <strong style={{ color: t.textSecondary }}>{totals.prevAcum}</strong>
                </span>
              </div>

              {/* Progress bar */}
              <div
                style={{
                  width: '100%',
                  height: '6px',
                  borderRadius: '3px',
                  background: t.border,
                  overflow: 'hidden',
                  marginBottom: '8px',
                }}
              >
                <div
                  style={{
                    width: `${Math.min(totals.pctAcum, 100)}%`,
                    height: '100%',
                    background: totals.pctAcum >= 100 ? '#22c55e' : t.primary,
                  }}
                />
              </div>
            </div>

            <div style={{ paddingTop: '8px', borderTop: `1px solid ${t.border}`, fontSize: '12px', color: t.textMuted }}>
              Acumulado no mês até a data selecionada
            </div>
          </div>

          {/* Card: Fora de Rota — Diário */}
          <div
            style={{
              background: t.surface,
              border: `1px solid ${t.border}`,
              borderRadius: '12px',
              padding: '16px 18px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: t.textSecondary }}>
                  Fora de Rota — Diário
                </span>
                <Navigation size={15} color={totals.foraRotaDia > 0 ? t.primary : t.textMuted} />
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '8px' }}>
                <span
                  className="num"
                  style={{
                    fontSize: '26px',
                    fontWeight: 800,
                    color: totals.foraRotaDia > 0 ? t.primary : t.text,
                  }}
                >
                  {totals.foraRotaDia}
                </span>
                <span style={{ fontSize: '12.5px', color: t.textMuted }}>clientes fora do roteiro</span>
              </div>
            </div>

            <div style={{ paddingTop: '8px', borderTop: `1px solid ${t.border}`, fontSize: '12px', color: t.textMuted }}>
              Atendimentos realizados fora da sequência planejada
            </div>
          </div>

          {/* Card: Fora de Rota — Acumulado */}
          <div
            style={{
              background: t.surface,
              border: `1px solid ${t.border}`,
              borderRadius: '12px',
              padding: '16px 18px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: t.textSecondary }}>
                  Fora de Rota — Acumulado
                </span>
                <Layers size={15} color={t.textMuted} />
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '8px' }}>
                <span className="num" style={{ fontSize: '26px', fontWeight: 800, color: t.text }}>
                  {totals.foraRotaAcum}
                </span>
                <span style={{ fontSize: '12.5px', color: t.textMuted }}>positivações no ciclo</span>
              </div>
            </div>

            <div style={{ paddingTop: '8px', borderTop: `1px solid ${t.border}`, fontSize: '12px', color: t.textMuted }}>
              Volume total fora de rota acumulado até a data
            </div>
          </div>
        </div>
      </div>

      {/* 2. SEÇÃO VISITAS & CHECK-INS */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <MapPin size={18} color={t.accentBlue} />
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: t.text }}>
            Visitas & Horários de Check-in
          </h2>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '14px',
          }}
        >
          {/* Card: Visitas Diárias */}
          <div
            style={{
              background: t.surface,
              border: `1px solid ${t.border}`,
              borderRadius: '12px',
              padding: '16px 18px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: t.textSecondary }}>
                  Visitas Diárias
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 7px',
                    borderRadius: '6px',
                    background: 'rgba(59, 130, 246, 0.12)',
                    color: t.accentBlue,
                  }}
                >
                  {totals.visPctDia.toFixed(1)}% real.
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '6px' }}>
                <span className="num" style={{ fontSize: '26px', fontWeight: 800, color: t.text }}>
                  {totals.visRealDia}
                </span>
                <span style={{ fontSize: '13px', color: t.textMuted }}>
                  / Previstas: <strong style={{ color: t.textSecondary }}>{totals.visPrevDia}</strong>
                </span>
              </div>

              <div style={{ fontSize: '12px', color: t.textSecondary, marginBottom: '6px' }}>
                Fora de Rota:{' '}
                <strong style={{ color: totals.visForaRotaDia > 0 ? t.primary : t.text }}>
                  {totals.visForaRotaDia}
                </strong>
              </div>
            </div>

            <div style={{ paddingTop: '8px', borderTop: `1px solid ${t.border}`, fontSize: '12px', color: t.textMuted }}>
              Previstas, Realizadas e Fora de Rota no dia
            </div>
          </div>

          {/* Card: Visitas Acumuladas */}
          <div
            style={{
              background: t.surface,
              border: `1px solid ${t.border}`,
              borderRadius: '12px',
              padding: '16px 18px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: t.textSecondary }}>
                  Visitas Acumuladas
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 7px',
                    borderRadius: '6px',
                    background: 'rgba(59, 130, 246, 0.12)',
                    color: t.accentBlue,
                  }}
                >
                  {totals.visPctAcum.toFixed(1)}% real.
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '6px' }}>
                <span className="num" style={{ fontSize: '26px', fontWeight: 800, color: t.text }}>
                  {totals.visRealAcum}
                </span>
                <span style={{ fontSize: '13px', color: t.textMuted }}>
                  / Previstas: <strong style={{ color: t.textSecondary }}>{totals.visPrevAcum}</strong>
                </span>
              </div>

              <div style={{ fontSize: '12px', color: t.textSecondary, marginBottom: '6px' }}>
                Fora de Rota Acumulado:{' '}
                <strong style={{ color: totals.visForaRotaAcum > 0 ? t.primary : t.text }}>
                  {totals.visForaRotaAcum}
                </strong>
              </div>
            </div>

            <div style={{ paddingTop: '8px', borderTop: `1px solid ${t.border}`, fontSize: '12px', color: t.textMuted }}>
              Total de visitas no ciclo e aderência ao plano
            </div>
          </div>

          {/* Card: 1º Check-in */}
          <div
            style={{
              background: t.surface,
              border: `1px solid ${t.border}`,
              borderRadius: '12px',
              padding: '16px 18px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: t.textSecondary }}>
                  1º Check-in do Dia
                </span>
                <Clock size={15} color={t.textMuted} />
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '8px' }}>
                <span className="num" style={{ fontSize: '26px', fontWeight: 800, color: t.accentBlue }}>
                  {totals.primeiroCheckIn}
                </span>
                <span style={{ fontSize: '12.5px', color: t.textMuted }}>início da rota</span>
              </div>
            </div>

            <div style={{ paddingTop: '8px', borderTop: `1px solid ${t.border}`, fontSize: '12px', color: t.textMuted }}>
              Horário do primeiro atendimento registrado no dia
            </div>
          </div>

          {/* Card: Último Check-in */}
          <div
            style={{
              background: t.surface,
              border: `1px solid ${t.border}`,
              borderRadius: '12px',
              padding: '16px 18px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: t.textSecondary }}>
                  Último Check-in do Dia
                </span>
                <Clock size={15} color={t.textMuted} />
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '8px' }}>
                <span className="num" style={{ fontSize: '26px', fontWeight: 800, color: t.accentBlue }}>
                  {totals.ultimoCheckIn}
                </span>
                <span style={{ fontSize: '12.5px', color: t.textMuted }}>encerramento da rota</span>
              </div>
            </div>

            <div style={{ paddingTop: '8px', borderTop: `1px solid ${t.border}`, fontSize: '12px', color: t.textMuted }}>
              Horário da última visita registrada no dia
            </div>
          </div>
        </div>
      </div>

      {/* 3. DETALHAMENTO: TABELA DE ROTEIRIZAÇÃO */}
      {/* Se Vendedor: Tabela da sequência das rotas estritamente na ordem das 9 colunas e ordenada pela sequência */}
      {isVendedorScope && (
        <div
          style={{
            background: t.surface,
            border: `1px solid ${t.border}`,
            borderRadius: '12px',
            overflow: 'hidden',
            marginBottom: '20px',
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
                Sequência de Visitas da sua Rota (Hoje: {formattedSelectedDate})
              </h3>
              <div style={{ fontSize: '12px', color: t.textMuted, marginTop: '2px' }}>
                Ordem operacional planejada para a rota do vendedor, status de positivação e check-ins
              </div>
            </div>
            <div style={{ fontSize: '12.5px', color: t.textSecondary }}>
              Total de Clientes na Rota:{' '}
              <strong style={{ color: t.text }}>{vendedorClientesSorted.length}</strong>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: t.bgSecondary, borderBottom: `1px solid ${t.border}` }}>
                  {/* 1. Código do Cliente */}
                  <th style={{ padding: '12px 14px', textAlign: 'left', color: t.textMuted, fontWeight: 600 }}>
                    Código do Cliente
                  </th>
                  {/* 2. Nome do Cliente */}
                  <th style={{ padding: '12px 14px', textAlign: 'left', color: t.textMuted, fontWeight: 600 }}>
                    Nome do Cliente
                  </th>
                  {/* 3. Cidade */}
                  <th style={{ padding: '12px 14px', textAlign: 'left', color: t.textMuted, fontWeight: 600 }}>
                    Cidade
                  </th>
                  {/* 4. Visita Prevista */}
                  <th style={{ padding: '12px 14px', textAlign: 'center', color: t.textMuted, fontWeight: 600 }}>
                    Visita Prevista
                  </th>
                  {/* 5. Check-in */}
                  <th style={{ padding: '12px 14px', textAlign: 'center', color: t.textMuted, fontWeight: 600 }}>
                    Check-in
                  </th>
                  {/* 6. Positivação */}
                  <th style={{ padding: '12px 14px', textAlign: 'center', color: t.textMuted, fontWeight: 600 }}>
                    Positivação
                  </th>
                  {/* 7. Valor do Pedido */}
                  <th style={{ padding: '12px 14px', textAlign: 'right', color: t.textMuted, fontWeight: 600 }}>
                    Valor do Pedido
                  </th>
                  {/* 8. Motivo de Não Venda */}
                  <th style={{ padding: '12px 14px', textAlign: 'left', color: t.textMuted, fontWeight: 600 }}>
                    Motivo de Não Venda
                  </th>
                  {/* 9. Motivo de Não Visita */}
                  <th style={{ padding: '12px 14px', textAlign: 'left', color: t.textMuted, fontWeight: 600 }}>
                    Motivo de Não Visita
                  </th>
                </tr>
              </thead>
              <tbody>
                {vendedorClientesSorted.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ padding: '30px 14px', textAlign: 'center', color: t.textMuted }}>
                      Nenhum cliente cadastrado na rota para esta data.
                    </td>
                  </tr>
                ) : (
                  vendedorClientesSorted.map((c) => (
                    <tr
                      key={c.codigo}
                      style={{
                        borderBottom: `1px solid ${t.border}`,
                      }}
                    >
                      {/* 1. Código do Cliente */}
                      <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontWeight: 600, color: t.text }}>
                        {c.codigo}
                      </td>

                      {/* 2. Nome do Cliente */}
                      <td style={{ padding: '12px 14px', fontWeight: 600, color: t.text }}>
                        {c.nome}
                      </td>

                      {/* 3. Cidade */}
                      <td style={{ padding: '12px 14px', color: t.textSecondary }}>
                        {c.cidade}
                      </td>

                      {/* 4. Visita Prevista */}
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: '6px',
                            background: c.visitaPrevista === 'Sim' ? 'rgba(34, 197, 94, 0.12)' : 'rgba(227, 6, 19, 0.12)',
                            color: c.visitaPrevista === 'Sim' ? '#22c55e' : t.primary,
                          }}
                        >
                          {c.visitaPrevista}
                        </span>
                      </td>

                      {/* 5. Check-in */}
                      <td
                        style={{
                          padding: '12px 14px',
                          textAlign: 'center',
                          fontFamily: 'monospace',
                          fontWeight: 600,
                          color: c.checkIn && c.checkIn !== '-' ? t.text : t.textMuted,
                        }}
                      >
                        {c.checkIn && c.checkIn !== '-' ? c.checkIn : '-'}
                      </td>

                      {/* 6. Positivação */}
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <span
                          style={{
                            fontSize: '11.5px',
                            fontWeight: 600,
                            padding: '3px 8px',
                            borderRadius: '6px',
                            background: c.positivacao === 'Positivado' ? 'rgba(34, 197, 94, 0.12)' : 'rgba(156, 163, 175, 0.15)',
                            color: c.positivacao === 'Positivado' ? '#22c55e' : t.textMuted,
                          }}
                        >
                          {c.positivacao}
                        </span>
                      </td>

                      {/* 7. Valor do Pedido */}
                      <td
                        style={{
                          padding: '12px 14px',
                          textAlign: 'right',
                          fontWeight: 600,
                          color: c.valorPedido > 0 ? t.text : t.textMuted,
                        }}
                      >
                        {c.valorPedido > 0 ? `R$ ${c.valorPedido.toLocaleString('pt-BR')}` : '-'}
                      </td>

                      {/* 8. Motivo de Não Venda */}
                      <td
                        style={{
                          padding: '12px 14px',
                          color: c.motivoNaoVenda && c.motivoNaoVenda !== '-' ? t.text : t.textMuted,
                          fontSize: '12.5px',
                        }}
                      >
                        {c.motivoNaoVenda && c.motivoNaoVenda !== '-' ? c.motivoNaoVenda : '-'}
                      </td>

                      {/* 9. Motivo de Não Visita */}
                      <td
                        style={{
                          padding: '12px 14px',
                          color: c.motivoNaoVisita && c.motivoNaoVisita !== '-' ? t.text : t.textMuted,
                          fontSize: '12.5px',
                        }}
                      >
                        {c.motivoNaoVisita && c.motivoNaoVisita !== '-' ? c.motivoNaoVisita : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Se Admin, Gerente ou Supervisor: Exibe a tabela consolidada de acompanhamento por vendedor */}
      {!isVendedorScope && (
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
                Acompanhamento Individual por Vendedor
              </h3>
              <div style={{ fontSize: '12px', color: t.textMuted, marginTop: '2px' }}>
                Positivação diária e acumulada, fora de rota, visitas e horários de check-in
              </div>
            </div>
            <div style={{ fontSize: '12.5px', color: t.textSecondary }}>
              Vendedores listados: <strong style={{ color: t.text }}>{filteredData.length}</strong>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: t.bgSecondary, borderBottom: `1px solid ${t.border}` }}>
                  <th style={{ padding: '10px 14px', textAlign: 'left', color: t.textMuted, fontWeight: 600 }}>
                    Vendedor / Equipe
                  </th>
                  <th style={{ padding: '10px 14px', textAlign: 'center', color: t.textMuted, fontWeight: 600 }}>
                    Posit. Diária (Prev / Real)
                  </th>
                  <th style={{ padding: '10px 14px', textAlign: 'center', color: t.textMuted, fontWeight: 600 }}>
                    Posit. Acumulada
                  </th>
                  <th style={{ padding: '10px 14px', textAlign: 'center', color: t.textMuted, fontWeight: 600 }}>
                    Fora Rota (Dia / Acum)
                  </th>
                  <th style={{ padding: '10px 14px', textAlign: 'center', color: t.textMuted, fontWeight: 600 }}>
                    Visitas (Prev / Real / Fora)
                  </th>
                  <th style={{ padding: '10px 14px', textAlign: 'center', color: t.textMuted, fontWeight: 600 }}>
                    1º Check-in
                  </th>
                  <th style={{ padding: '10px 14px', textAlign: 'center', color: t.textMuted, fontWeight: 600 }}>
                    Último Check-in
                  </th>
                  <th style={{ padding: '10px 14px', textAlign: 'center', color: t.textMuted, fontWeight: 600 }}>
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((v) => {
                  const pctDia = v.positivacaoDiaPrevisto > 0 ? (v.positivacaoDiaRealizado / v.positivacaoDiaPrevisto) * 100 : 0;
                  const pctAcum = v.positivacaoAcumPrevisto > 0 ? (v.positivacaoAcumRealizado / v.positivacaoAcumPrevisto) * 100 : 0;

                  return (
                    <tr
                      key={v.codigo}
                      style={{
                        borderBottom: `1px solid ${t.border}`,
                      }}
                    >
                      {/* Vendedor / Equipe */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: 600, color: t.text }}>{v.nome}</div>
                        <div style={{ fontSize: '11.5px', color: t.textMuted }}>
                          Cód: {v.codigo} · {v.equipe}
                        </div>
                      </td>

                      {/* Positivação Diária */}
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <div style={{ fontWeight: 600, color: t.text }}>
                          {v.positivacaoDiaRealizado} / {v.positivacaoDiaPrevisto}
                        </div>
                        <div
                          style={{
                            fontSize: '11.5px',
                            fontWeight: 700,
                            color: pctDia >= 100 ? '#22c55e' : t.primary,
                          }}
                        >
                          {pctDia.toFixed(1)}%
                        </div>
                      </td>

                      {/* Positivação Acumulada */}
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <div style={{ fontWeight: 600, color: t.text }}>
                          {v.positivacaoAcumRealizado} / {v.positivacaoAcumPrevisto}
                        </div>
                        <div
                          style={{
                            fontSize: '11.5px',
                            fontWeight: 700,
                            color: pctAcum >= 100 ? '#22c55e' : t.primary,
                          }}
                        >
                          {pctAcum.toFixed(1)}%
                        </div>
                      </td>

                      {/* Fora de Rota */}
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <div style={{ fontWeight: 600, color: v.foraRotaDia > 0 ? t.primary : t.text }}>
                          {v.foraRotaDia} dia
                        </div>
                        <div style={{ fontSize: '11.5px', color: t.textMuted }}>
                          {v.foraRotaAcum} acum.
                        </div>
                      </td>

                      {/* Visitas */}
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <div style={{ fontWeight: 600, color: t.text }}>
                          {v.visitasDiaRealizado} / {v.visitasDiaPrevisto}
                        </div>
                        <div style={{ fontSize: '11.5px', color: t.textMuted }}>
                          Fora: {v.visitasDiaForaRota}
                        </div>
                      </td>

                      {/* 1º Check-in */}
                      <td style={{ padding: '12px 14px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 600, color: t.text }}>
                        {v.primeiroCheckIn}
                      </td>

                      {/* Último Check-in */}
                      <td style={{ padding: '12px 14px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 600, color: t.text }}>
                        {v.ultimoCheckIn}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <span
                          style={{
                            fontSize: '11.5px',
                            fontWeight: 600,
                            padding: '3px 8px',
                            borderRadius: '6px',
                            background:
                              v.statusRota === 'Finalizada'
                                ? 'rgba(34, 197, 94, 0.12)'
                                : 'rgba(59, 130, 246, 0.12)',
                            color: v.statusRota === 'Finalizada' ? '#22c55e' : t.accentBlue,
                          }}
                        >
                          {v.statusRota}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
