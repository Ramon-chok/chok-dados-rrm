import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import {
  Award, Users, ShieldCheck, Plus, Edit2, Trash2, Check, Sparkles,
  Code2, Database, Layers, Star, Zap, Globe, Cpu, BarChart3,
  GitBranch, Rocket, Crown, Camera, X, Search, Filter, Download,
  Share2, Heart, Trophy, Lightbulb, Target, TrendingUp, Calendar,
  MapPin, Mail, Linkedin, Github, Copy, CheckCircle2, Info,
} from 'lucide-react';

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  department: string;
  description: string;
  photoUrl?: string;
  avatarInitials: string;
  displayOrder: number;
  status: 'Ativo' | 'Inativo';
  category: 'origin' | 'rrmind' | 'team';
  email?: string;
  linkedin?: string;
  github?: string;
  skills?: string[];
  joinDate?: string;
}

const STORAGE_KEY = 'chok_credits_data';
const IMAGES_STORAGE_KEY = 'chok_credits_images';

const INITIAL_TEAM: TeamMember[] = [
  {
    id: 'origin-1',
    name: 'Laura Fradique',
    role: 'Criadora Original do Sistema',
    department: 'Criação do sistema',
    description:
      'Visionária e idealizadora do sistema original de inteligência comercial da Chok Distribuidora. Responsável pela concepção da plataforma que revolucionou a gestão de dados da força de vendas e democratizou o acesso à informação estratégica em todos os níveis corporativos.',
    avatarInitials: 'LF',
    displayOrder: 1,
    status: 'Ativo',
    category: 'origin',
    skills: ['Visão Estratégica', 'Liderança', 'Inovação'],
    joinDate: '2015-03-01',
  },
  {
    id: 'rrmind-1',
    name: 'Ramon Sanchez',
    role: 'Dev FullStack e Analista de dados',
    department: 'Analista de dados',
    description:
      'Liderança técnica na recriação completa do sistema. Responsável pela nova arquitetura de dados em tempo real, modelagem relacional hierárquica e toda a infraestrutura de inteligência comercial de alta performance.',
    avatarInitials: 'RR',
    displayOrder: 2,
    status: 'Ativo',
    category: 'rrmind',
    skills: ['Arquitetura', 'Backend', 'Cloud', 'DevOps'],
    joinDate: '2024-01-15',
  },
  {
    id: 'rrmind-2',
    name: 'Renan Mestre',
    role: 'Developer Security & FullStack',
    department: 'Analista Comercial',
    description:
      'Responsável pela implementação da interface de alta performance, Design System proprietário, fluxos analíticos avançados e toda a experiência do usuário na plataforma recriada.',
    avatarInitials: 'RS',
    displayOrder: 3,
    status: 'Ativo',
    category: 'rrmind',
    skills: ['React', 'TypeScript', 'UI/UX', 'Design System'],
    joinDate: '2024-01-15',
  },
  {
    id: 'team-1',
    name: 'Roberto Alcantara',
    role: 'Líder de Reestruturação & Estratégia Comercial',
    department: 'Reestruturação & BI',
    description: 'Coordenação executiva da transição digital, remodelagem de indicadores de metas, positivação e política de sortimentos.',
    avatarInitials: 'RA',
    displayOrder: 4,
    status: 'Ativo',
    category: 'team',
  },
  {
    id: 'team-2',
    name: 'Camila Mendonça',
    role: 'Arquiteta de Soluções & Engenharia de Dados',
    department: 'Tecnologia & Dados',
    description: 'Modelagem da infraestrutura de dados em tempo real, pipelines de consolidação hierárquica e integridade relacional.',
    avatarInitials: 'CM',
    displayOrder: 5,
    status: 'Ativo',
    category: 'team',
  },
  {
    id: 'team-3',
    name: 'Lucas Nogueira',
    role: 'Engenheiro Full-Stack & Interface do Usuário',
    department: 'Desenvolvimento',
    description: 'Implementação da interface de alta performance, componentes do Design System e integração dos fluxos analíticos.',
    avatarInitials: 'LN',
    displayOrder: 6,
    status: 'Ativo',
    category: 'team',
  },
  {
    id: 'team-4',
    name: 'Beatriz Vasconcelos',
    role: 'Designer de Produto & UX/UI',
    department: 'Design System',
    description: 'Concepção visual com foco em legibilidade, tipografia de alta densidade e ergonomia de uso para gestores e representantes.',
    avatarInitials: 'BV',
    displayOrder: 7,
    status: 'Ativo',
    category: 'team',
  },
  {
    id: 'team-5',
    name: 'Eduardo Silveira',
    role: 'Especialista de Implantação Comercial & Suporte',
    department: 'Operações de Campo',
    description: 'Validação com supervisores e gerentes regionais, homologação dos cálculos de GAP e treinamento de equipes.',
    avatarInitials: 'ES',
    displayOrder: 8,
    status: 'Ativo',
    category: 'team',
  },
];

const TECH_STACK = [
  { icon: Code2, label: 'React 18', desc: 'Interface Reativa', color: '#61DAFB' },
  { icon: Database, label: 'Supabase', desc: 'Backend em Tempo Real', color: '#3ECF8E' },
  { icon: Layers, label: 'TypeScript', desc: 'Tipagem Estrita', color: '#3178C6' },
  { icon: Cpu, label: 'Vite', desc: 'Build Otimizado', color: '#646CFF' },
  { icon: ShieldCheck, label: 'RBAC', desc: 'Controle de Acesso', color: '#10B981' },
  { icon: BarChart3, label: 'Analytics', desc: 'BI Integrado', color: '#F59E0B' },
];

const TIMELINE = [
  { phase: 'Fase 1', title: 'Concepção & Análise', desc: 'Levantamento de requisitos e arquitetura do sistema original', year: '2015', icon: Lightbulb },
  { phase: 'Fase 2', title: 'Sistema Original', desc: 'Primeira versão funcional criada pela fundadora', year: '2016', icon: Target },
  { phase: 'Fase 3', title: 'Recriação RR Mind', desc: 'Reengenharia completa com nova stack tecnológica', year: '2024', icon: Rocket },
  { phase: 'Fase 4', title: 'Produção & Evolução', desc: 'Sistema em produção com melhorias contínuas', year: '2026', icon: TrendingUp },
];

type FilterCategory = 'all' | 'origin' | 'rrmind' | 'team';

export const CreditosPage: React.FC = () => {
  const { t } = useTheme();
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'ADMIN';

  // ─── Persisted State ──────────────────────────────────────────────
  const [members, setMembers] = useState<TeamMember[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : INITIAL_TEAM;
    } catch {
      return INITIAL_TEAM;
    }
  });

  const [images, setImages] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem(IMAGES_STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(members));
  }, [members]);

  useEffect(() => {
    localStorage.setItem(IMAGES_STORAGE_KEY, JSON.stringify(images));
  }, [images]);

  // ─── UI State ─────────────────────────────────────────────────────
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [animatedIn, setAnimatedIn] = useState(false);
  const [activeTimelineIdx, setActiveTimelineIdx] = useState(3);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<FilterCategory>('all');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [detailMember, setDetailMember] = useState<TeamMember | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // ─── Form State ───────────────────────────────────────────────────
  const [formName, setFormName] = useState('');
  const [formRole, setFormRole] = useState('');
  const [formDepartment, setFormDepartment] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formCategory, setFormCategory] = useState<'origin' | 'rrmind' | 'team'>('team');
  const [formEmail, setFormEmail] = useState('');
  const [formLinkedin, setFormLinkedin] = useState('');
  const [formSkills, setFormSkills] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const firstInputRef = useRef<HTMLInputElement>(null);

  // ─── Effects ──────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => setAnimatedIn(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isModalOpen) {
      setTimeout(() => firstInputRef.current?.focus(), 100);
    }
  }, [isModalOpen]);

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // ESC key to close modals
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isModalOpen) setIsModalOpen(false);
        if (detailMember) setDetailMember(null);
        if (confirmDelete) setConfirmDelete(null);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isModalOpen, detailMember, confirmDelete]);

  // ─── Derived Data ─────────────────────────────────────────────────
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
  }, []);

  const originMember = useMemo(() => members.find((m) => m.category === 'origin'), [members]);
  const rrMindMembers = useMemo(
    () => members.filter((m) => m.category === 'rrmind' && m.status === 'Ativo'),
    [members]
  );
  const teamMembers = useMemo(
    () => members.filter((m) => m.category === 'team' && m.status === 'Ativo'),
    [members]
  );

  const filteredTeamMembers = useMemo(() => {
    let list = teamMembers;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.role.toLowerCase().includes(q) ||
          m.department.toLowerCase().includes(q)
      );
    }
    return list;
  }, [teamMembers, searchQuery]);

  const stats = useMemo(
    () => ({
      total: members.filter((m) => m.status === 'Ativo').length,
      origin: members.filter((m) => m.category === 'origin' && m.status === 'Ativo').length,
      rrmind: rrMindMembers.length,
      team: teamMembers.length,
    }),
    [members, rrMindMembers, teamMembers]
  );

  // ─── Handlers ─────────────────────────────────────────────────────
  const handleImageUpload = useCallback(
    (memberId: string, file: File) => {
      if (file.size > 3 * 1024 * 1024) {
        showToast('Imagem muito grande (máx. 3MB).', 'error');
        return;
      }
      if (!file.type.startsWith('image/')) {
        showToast('Selecione um arquivo de imagem válido.', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setImages((prev) => ({ ...prev, [memberId]: reader.result as string }));
        showToast('Foto atualizada com sucesso!');
      };
      reader.onerror = () => showToast('Erro ao carregar imagem.', 'error');
      reader.readAsDataURL(file);
    },
    [showToast]
  );

  const removeImage = useCallback(
    (memberId: string) => {
      setImages((prev) => {
        const copy = { ...prev };
        delete copy[memberId];
        return copy;
      });
      showToast('Foto removida.');
    },
    [showToast]
  );

  const resetForm = () => {
    setFormName('');
    setFormRole('');
    setFormDepartment('');
    setFormDesc('');
    setFormCategory('team');
    setFormEmail('');
    setFormLinkedin('');
    setFormSkills('');
    setFormErrors({});
  };

  const openAddModal = () => {
    setEditingMember(null);
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (member: TeamMember) => {
    setEditingMember(member);
    setFormName(member.name);
    setFormRole(member.role);
    setFormDepartment(member.department);
    setFormDesc(member.description);
    setFormCategory(member.category);
    setFormEmail(member.email || '');
    setFormLinkedin(member.linkedin || '');
    setFormSkills((member.skills || []).join(', '));
    setFormErrors({});
    setIsModalOpen(true);
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formName.trim()) errors.name = 'Nome é obrigatório';
    if (!formRole.trim()) errors.role = 'Cargo é obrigatório';
    if (!formDepartment.trim()) errors.department = 'Departamento é obrigatório';
    if (formEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formEmail)) {
      errors.email = 'Email inválido';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const skillsArr = formSkills
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (editingMember) {
      setMembers((prev) =>
        prev.map((m) =>
          m.id === editingMember.id
            ? {
                ...m,
                name: formName.trim(),
                role: formRole.trim(),
                department: formDepartment.trim(),
                description: formDesc.trim(),
                category: formCategory,
                email: formEmail.trim() || undefined,
                linkedin: formLinkedin.trim() || undefined,
                skills: skillsArr.length ? skillsArr : undefined,
              }
            : m
        )
      );
      showToast('Membro atualizado com sucesso!');
    } else {
      const initials = formName
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0].toUpperCase())
        .join('');

      const newMember: TeamMember = {
        id: `member-${Date.now()}`,
        name: formName.trim(),
        role: formRole.trim(),
        department: formDepartment.trim(),
        description: formDesc.trim(),
        avatarInitials: initials || 'NM',
        displayOrder: members.length + 1,
        status: 'Ativo',
        category: formCategory,
        email: formEmail.trim() || undefined,
        linkedin: formLinkedin.trim() || undefined,
        skills: skillsArr.length ? skillsArr : undefined,
        joinDate: new Date().toISOString().split('T')[0],
      };
      setMembers((prev) => [...prev, newMember]);
      showToast('Novo membro adicionado!');
    }
    setIsModalOpen(false);
  };

  const handleDeleteMember = (id: string) => {
    setMembers((prev) => prev.filter((m) => m.id !== id));
    setConfirmDelete(null);
    showToast('Membro removido.', 'info');
  };

  const handleCopy = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      showToast('Copiado para a área de transferência!');
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      showToast('Erro ao copiar.', 'error');
    }
  };

  const handleExportCredits = () => {
    const content = members
      .filter((m) => m.status === 'Ativo')
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map(
        (m) =>
          `${m.name}\n${m.role}\n${m.department}\n${m.description}\n${'─'.repeat(60)}`
      )
      .join('\n\n');
    const blob = new Blob([`CRÉDITOS — PLATAFORMA CHOK\n\n${content}`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `creditos-chok-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Créditos exportados!');
  };

  const handleShare = async () => {
    const shareData = {
      title: 'Créditos — Plataforma Chok',
      text: 'Conheça a equipe por trás da Plataforma de Inteligência Comercial Chok',
      url: window.location.href,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        showToast('Link copiado!');
      }
    } catch {
      /* usuário cancelou */
    }
  };

  // ─── Reusable Components ──────────────────────────────────────────
  const PhotoAvatar = ({
    memberId,
    initials,
    size = 108,
    gradient = `linear-gradient(135deg, ${t.primary}, #8B0000)`,
    fontSize = 34,
    editable = false,
    onClickAvatar,
  }: {
    memberId: string;
    initials: string;
    size?: number;
    gradient?: string;
    fontSize?: number;
    editable?: boolean;
    onClickAvatar?: () => void;
  }) => {
    const image = images[memberId];
    return (
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <div
          onClick={onClickAvatar}
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            background: image ? `url(${image}) center/cover no-repeat` : gradient,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: `${fontSize}px`,
            fontWeight: 700,
            boxShadow: `0 8px 28px rgba(227, 6, 19, 0.3)`,
            border: `3px solid rgba(255,255,255,0.15)`,
            transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
            cursor: onClickAvatar ? 'pointer' : 'default',
          }}
        >
          {!image && initials}
        </div>
        {isAdmin && editable && (
          <>
            <label
              style={{
                position: 'absolute',
                bottom: 2,
                right: 2,
                width: 30,
                height: 30,
                borderRadius: '50%',
                background: t.primary,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                border: `2px solid ${t.surface}`,
                transition: 'transform 0.2s',
                zIndex: 2,
              }}
              title="Alterar foto"
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.1)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            >
              <Camera size={13} />
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageUpload(memberId, file);
                  e.target.value = '';
                }}
              />
            </label>
            {image && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeImage(memberId);
                }}
                style={{
                  position: 'absolute',
                  top: 2,
                  right: 2,
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: 'rgba(0,0,0,0.7)',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 2,
                }}
                title="Remover foto"
              >
                <X size={12} />
              </button>
            )}
          </>
        )}
      </div>
    );
  };

  const SectionLabel = ({ icon: Icon, children }: { icon: any; children: React.ReactNode }) => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '11.5px',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: t.primary,
        marginBottom: '20px',
      }}
    >
      <Icon size={15} color={t.primary} />
      <span>{children}</span>
    </div>
  );

  // ─── Render ───────────────────────────────────────────────────────
  return (
    <div
      style={{
        maxWidth: '1200px',
        opacity: animatedIn ? 1 : 0,
        transform: animatedIn ? 'translateY(0)' : 'translateY(12px)',
        transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* ═══════════════════════════════════════════════════
          HEADER
      ═══════════════════════════════════════════════════ */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ flex: 1, minWidth: 280 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '10px',
                background: `linear-gradient(135deg, ${t.primary}, #ff4444)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 14px rgba(227, 6, 19, 0.35)',
                position: 'relative',
              }}
            >
              <Sparkles size={20} color="#fff" />
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '10px',
                  background: `linear-gradient(135deg, ${t.primary}, #ff4444)`,
                  filter: 'blur(12px)',
                  opacity: 0.4,
                  zIndex: -1,
                }}
              />
            </div>
            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: '24px',
                  fontWeight: 800,
                  color: t.text,
                  letterSpacing: '-0.02em',
                }}
              >
                Créditos & Institucional
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                <Trophy size={11} color={t.textMuted} />
                <span style={{ fontSize: '11px', color: t.textMuted, fontWeight: 500 }}>
                  {stats.total} profissionais reconhecidos
                </span>
              </div>
            </div>
          </div>
          <p
            style={{
              margin: 0,
              fontSize: '13.5px',
              color: t.textSecondary,
              maxWidth: 620,
              lineHeight: 1.5,
            }}
          >
            Reconhecimento aos profissionais que idealizaram, criaram e recriaram o ecossistema de
            inteligência comercial da Chok Distribuidora.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={handleShare}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 14px',
              borderRadius: '10px',
              border: `1px solid ${t.border}`,
              background: t.surfaceElevated,
              color: t.textSecondary,
              fontSize: '12.5px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            title="Compartilhar"
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = t.primary + '60';
              e.currentTarget.style.color = t.primary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = t.border;
              e.currentTarget.style.color = t.textSecondary;
            }}
          >
            <Share2 size={14} />
            <span>Compartilhar</span>
          </button>
          <button
            onClick={handleExportCredits}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 14px',
              borderRadius: '10px',
              border: `1px solid ${t.border}`,
              background: t.surfaceElevated,
              color: t.textSecondary,
              fontSize: '12.5px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            title="Exportar"
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = t.primary + '60';
              e.currentTarget.style.color = t.primary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = t.border;
              e.currentTarget.style.color = t.textSecondary;
            }}
          >
            <Download size={14} />
            <span>Exportar</span>
          </button>
          {isAdmin && (
            <button
              onClick={openAddModal}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                borderRadius: '10px',
                border: 'none',
                background: `linear-gradient(135deg, ${t.primary}, #cc0011)`,
                color: '#fff',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(227, 6, 19, 0.35)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(227, 6, 19, 0.45)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(227, 6, 19, 0.35)';
              }}
            >
              <Plus size={16} />
              <span>Adicionar Membro</span>
            </button>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════
          STATS CARDS
      ═══════════════════════════════════════════════════ */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
          marginBottom: '28px',
        }}
      >
        {[
          { label: 'Total de Créditos', value: stats.total, icon: Users, color: t.primary },
          { label: 'Fundadora', value: stats.origin, icon: Crown, color: '#d4af37' },
          { label: 'RR Mind', value: stats.rrmind, icon: Rocket, color: '#6366f1' },
          { label: 'Equipe Complementar', value: stats.team, icon: HeartIconWrap, color: '#10b981' },
        ].map((stat, idx) => {
          const Icon = stat.icon === HeartIconWrap ? Heart : stat.icon;
          return (
            <div
              key={idx}
              style={{
                background: t.surface,
                border: `1px solid ${t.border}`,
                borderRadius: '12px',
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = stat.color + '50';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = t.border;
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '10px',
                  background: `${stat.color}15`,
                  border: `1px solid ${stat.color}30`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon size={17} color={stat.color} />
              </div>
              <div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: t.text, lineHeight: 1 }}>
                  {stat.value}
                </div>
                <div
                  style={{
                    fontSize: '10.5px',
                    color: t.textMuted,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginTop: '3px',
                    fontWeight: 600,
                  }}
                >
                  {stat.label}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ═══════════════════════════════════════════════════
          ORIGIN — CRIADORA
      ═══════════════════════════════════════════════════ */}
      {originMember && (
        <div
          style={{
            background: t.surface,
            border: `1px solid ${t.border}`,
            borderRadius: '16px',
            marginBottom: '28px',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '4px',
              background: `linear-gradient(90deg, #d4af37, #ff6b35, #d4af37)`,
            }}
          />
          <div style={{ padding: '28px 32px 32px' }}>
            <SectionLabel icon={Crown}>Origem & Criação do Sistema</SectionLabel>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '130px 1fr auto',
                gap: '28px',
                alignItems: 'center',
              }}
              className="founder-grid"
            >
              <PhotoAvatar
                memberId={originMember.id}
                initials={originMember.avatarInitials}
                size={118}
                gradient={`linear-gradient(135deg, #d4af37, #b8860b, #8B6914)`}
                fontSize={38}
                editable
                onClickAvatar={() => setDetailMember(originMember)}
              />

              <div>
                <h2
                  style={{
                    margin: '0 0 6px',
                    fontSize: '22px',
                    fontWeight: 800,
                    color: t.text,
                    letterSpacing: '-0.01em',
                  }}
                >
                  {originMember.name}
                </h2>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#b8860b',
                    background: 'rgba(212, 175, 55, 0.1)',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    marginBottom: '14px',
                  }}
                >
                  <Star size={13} fill="#b8860b" />
                  {originMember.role}
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: '14px',
                    color: t.textSecondary,
                    lineHeight: 1.7,
                    maxWidth: '680px',
                  }}
                >
                  {originMember.description}
                </p>
              </div>

              {isAdmin && (
                <button
                  onClick={() => openEditModal(originMember)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: `1px solid ${t.border}`,
                    background: t.surfaceElevated,
                    color: t.textSecondary,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12.5px',
                    transition: 'all 0.2s',
                  }}
                >
                  <Edit2 size={14} />
                  Editar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════
          TIMELINE — INTERATIVA
      ═══════════════════════════════════════════════════ */}
      <div
        style={{
          background: t.surface,
          border: `1px solid ${t.border}`,
          borderRadius: '14px',
          padding: '24px 28px',
          marginBottom: '28px',
        }}
      >
        <SectionLabel icon={GitBranch}>Jornada de Evolução do Sistema</SectionLabel>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '0',
            position: 'relative',
          }}
          className="timeline-grid"
        >
          {TIMELINE.map((item, idx) => {
            const isActive = idx <= activeTimelineIdx;
            const isCurrent = idx === activeTimelineIdx;
            const Icon = item.icon;
            return (
              <div
                key={idx}
                style={{
                  position: 'relative',
                  padding: '0 12px',
                  textAlign: 'center',
                  cursor: 'pointer',
                }}
                onClick={() => setActiveTimelineIdx(idx)}
                onMouseEnter={() => setHoveredCard(`tl-${idx}`)}
                onMouseLeave={() => setHoveredCard(null)}
              >
                {idx < TIMELINE.length - 1 && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '18px',
                      left: '50%',
                      right: '-50%',
                      height: '2px',
                      background:
                        idx < activeTimelineIdx
                          ? `linear-gradient(90deg, ${t.primary}, ${t.primary})`
                          : t.border,
                      zIndex: 0,
                      transition: 'all 0.4s ease',
                    }}
                  />
                )}

                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: isActive
                      ? `linear-gradient(135deg, ${t.primary}, #cc0011)`
                      : t.surfaceElevated,
                    border: `2px solid ${isActive ? t.primary : t.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 12px',
                    position: 'relative',
                    zIndex: 1,
                    transition: 'all 0.3s ease',
                    boxShadow: isActive ? `0 2px 12px rgba(227, 6, 19, 0.3)` : 'none',
                    transform: hoveredCard === `tl-${idx}` ? 'scale(1.1)' : 'scale(1)',
                  }}
                >
                  <Icon size={15} color={isActive ? '#fff' : t.textMuted} />
                  {isCurrent && (
                    <div
                      style={{
                        position: 'absolute',
                        inset: -4,
                        borderRadius: '50%',
                        border: `2px solid ${t.primary}40`,
                        animation: 'pulse 2s infinite',
                      }}
                    />
                  )}
                </div>

                <div
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: isActive ? t.primary : t.textMuted,
                    marginBottom: '2px',
                    transition: 'color 0.3s',
                  }}
                >
                  {item.phase} · {item.year}
                </div>
                <div
                  style={{
                    fontSize: '12.5px',
                    fontWeight: 600,
                    color: isActive ? t.text : t.textSecondary,
                    marginBottom: '4px',
                    transition: 'color 0.3s',
                  }}
                >
                  {item.title}
                </div>
                <div style={{ fontSize: '11px', color: t.textMuted, lineHeight: 1.4 }}>
                  {item.desc}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════
          RR MIND
      ═══════════════════════════════════════════════════ */}
      <div
        style={{
          background: t.surface,
          border: `1px solid ${t.border}`,
          borderRadius: '16px',
          marginBottom: '28px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '4px',
            background: `linear-gradient(90deg, ${t.primary}, #6366f1, ${t.primary})`,
          }}
        />
        <div style={{ padding: '28px 32px 32px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '24px',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Rocket size={16} color={t.primary} />
              <span
                style={{
                  fontSize: '11.5px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: t.primary,
                }}
              >
                RR Mind · Recriação do Sistema
              </span>
            </div>
            <div
              style={{
                fontSize: '11px',
                color: t.textMuted,
                background: t.surfaceElevated,
                padding: '4px 12px',
                borderRadius: '20px',
                border: `1px solid ${t.border}`,
              }}
            >
              Reengenharia Completa · Nova Stack · Nova Arquitetura
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
              gap: '20px',
            }}
            className="rrmind-grid"
          >
            {rrMindMembers.map((member) => (
              <div
                key={member.id}
                onMouseEnter={() => setHoveredCard(member.id)}
                onMouseLeave={() => setHoveredCard(null)}
                style={{
                  background:
                    hoveredCard === member.id
                      ? `linear-gradient(135deg, rgba(227, 6, 19, 0.03), rgba(99, 102, 241, 0.03))`
                      : t.surfaceElevated,
                  border: `1.5px solid ${hoveredCard === member.id ? t.primary + '40' : t.border}`,
                  borderRadius: '14px',
                  padding: '24px',
                  transition: 'all 0.3s ease',
                  transform: hoveredCard === member.id ? 'translateY(-2px)' : 'none',
                  boxShadow: hoveredCard === member.id ? '0 8px 24px rgba(0,0,0,0.08)' : 'none',
                  cursor: 'pointer',
                }}
                onClick={() => setDetailMember(member)}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '18px',
                    marginBottom: '16px',
                  }}
                >
                  <PhotoAvatar
                    memberId={member.id}
                    initials={member.avatarInitials}
                    size={80}
                    gradient={`linear-gradient(135deg, ${t.primary}, #6366f1)`}
                    fontSize={26}
                    editable
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: 700, color: t.text }}>
                      {member.name}
                    </h3>
                    <div
                      style={{
                        fontSize: '12.5px',
                        fontWeight: 600,
                        color: t.primary,
                        marginBottom: '4px',
                      }}
                    >
                      {member.role}
                    </div>
                    <div style={{ fontSize: '11px', color: t.textMuted, fontWeight: 500 }}>
                      {member.department}
                    </div>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditModal(member);
                      }}
                      style={{
                        padding: '6px',
                        background: 'none',
                        border: 'none',
                        color: t.textMuted,
                        cursor: 'pointer',
                        opacity: hoveredCard === member.id ? 1 : 0,
                        transition: 'opacity 0.2s',
                      }}
                      title="Editar"
                    >
                      <Edit2 size={14} />
                    </button>
                  )}
                </div>

                <p style={{ margin: 0, fontSize: '13px', color: t.textSecondary, lineHeight: 1.65 }}>
                  {member.description}
                </p>

                {member.skills && member.skills.length > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '6px',
                      marginTop: '14px',
                      paddingTop: '14px',
                      borderTop: `1px dashed ${t.border}`,
                    }}
                  >
                    {member.skills.map((skill, i) => (
                      <span
                        key={i}
                        style={{
                          fontSize: '10.5px',
                          fontWeight: 600,
                          padding: '3px 9px',
                          borderRadius: '12px',
                          background: `${t.primary}12`,
                          color: t.primary,
                          border: `1px solid ${t.primary}25`,
                        }}
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════
          TECH STACK
      ═══════════════════════════════════════════════════ */}
      <div
        style={{
          background: t.surface,
          border: `1px solid ${t.border}`,
          borderRadius: '14px',
          padding: '24px 28px',
          marginBottom: '28px',
        }}
      >
        <SectionLabel icon={Zap}>Stack Tecnológica</SectionLabel>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
            gap: '12px',
          }}
        >
          {TECH_STACK.map((tech, idx) => {
            const Icon = tech.icon;
            const isHovered = hoveredCard === `tech-${idx}`;
            return (
              <div
                key={idx}
                onMouseEnter={() => setHoveredCard(`tech-${idx}`)}
                onMouseLeave={() => setHoveredCard(null)}
                style={{
                  background: isHovered ? `${tech.color}08` : t.surfaceElevated,
                  border: `1px solid ${isHovered ? tech.color + '40' : t.border}`,
                  borderRadius: '10px',
                  padding: '16px 14px',
                  textAlign: 'center',
                  transition: 'all 0.25s ease',
                  transform: isHovered ? 'translateY(-3px)' : 'none',
                  cursor: 'default',
                  boxShadow: isHovered ? `0 6px 16px ${tech.color}20` : 'none',
                }}
              >
                <Icon
                  size={24}
                  color={isHovered ? tech.color : t.primary}
                  style={{ marginBottom: '8px', transition: 'color 0.25s' }}
                />
                <div
                  style={{
                    fontSize: '12.5px',
                    fontWeight: 600,
                    color: t.text,
                    marginBottom: '2px',
                  }}
                >
                  {tech.label}
                </div>
                <div style={{ fontSize: '10.5px', color: t.textMuted }}>{tech.desc}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════
          EQUIPE COMPLEMENTAR — COM BUSCA
      ═══════════════════════════════════════════════════ */}
      <div style={{ marginBottom: '28px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={17} color={t.primary} />
            <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: t.text }}>
              Equipe de Reestruturação & Engenharia
            </h2>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: t.textMuted,
                background: t.surfaceElevated,
                padding: '2px 8px',
                borderRadius: '10px',
                border: `1px solid ${t.border}`,
              }}
            >
              {filteredTeamMembers.length}
            </span>
          </div>

          <div style={{ position: 'relative', minWidth: 240 }}>
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: t.textMuted,
                pointerEvents: 'none',
              }}
            />
            <input
              type="text"
              placeholder="Buscar por nome, cargo, área..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '8px 12px 8px 34px',
                borderRadius: '8px',
                border: `1px solid ${t.border}`,
                background: t.surface,
                color: t.text,
                fontSize: '12.5px',
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = t.primary + '60')}
              onBlur={(e) => (e.currentTarget.style.borderColor = t.border)}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: t.textMuted,
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {filteredTeamMembers.length === 0 ? (
          <div
            style={{
              background: t.surface,
              border: `1px dashed ${t.border}`,
              borderRadius: '12px',
              padding: '40px 20px',
              textAlign: 'center',
              color: t.textMuted,
            }}
          >
            <Search size={28} style={{ opacity: 0.4, marginBottom: 10 }} />
            <div style={{ fontSize: '13.5px', fontWeight: 600, color: t.textSecondary }}>
              Nenhum membro encontrado
            </div>
            <div style={{ fontSize: '12px', marginTop: 4 }}>
              Tente ajustar sua busca ou remover os filtros
            </div>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '16px',
            }}
          >
            {filteredTeamMembers.map((member) => (
              <div
                key={member.id}
                onMouseEnter={() => setHoveredCard(member.id)}
                onMouseLeave={() => setHoveredCard(null)}
                onClick={() => setDetailMember(member)}
                style={{
                  background: t.surface,
                  border: `1px solid ${hoveredCard === member.id ? t.primary + '30' : t.border}`,
                  borderRadius: '12px',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                  transition: 'all 0.25s ease',
                  transform: hoveredCard === member.id ? 'translateY(-2px)' : 'none',
                  boxShadow: hoveredCard === member.id ? '0 4px 16px rgba(0,0,0,0.06)' : 'none',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '14px' }}>
                  <div
                    style={{
                      width: '46px',
                      height: '46px',
                      borderRadius: '50%',
                      background:
                        hoveredCard === member.id
                          ? `linear-gradient(135deg, ${t.primary}20, ${t.primary}10)`
                          : t.surfaceElevated,
                      border: `1.5px solid ${hoveredCard === member.id ? t.primary + '40' : t.border}`,
                      color: t.primary,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '15px',
                      fontWeight: 700,
                      flexShrink: 0,
                      transition: 'all 0.25s ease',
                    }}
                  >
                    {member.avatarInitials}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '14.5px',
                        fontWeight: 600,
                        color: t.text,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {member.name}
                    </div>
                    <div style={{ fontSize: '12px', color: t.primary, fontWeight: 500 }}>
                      {member.role}
                    </div>
                  </div>

                  {isAdmin && (
                    <div
                      style={{
                        display: 'flex',
                        gap: '2px',
                        opacity: hoveredCard === member.id ? 1 : 0,
                        transition: 'opacity 0.2s',
                      }}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(member);
                        }}
                        style={{
                          padding: '5px',
                          background: 'none',
                          border: 'none',
                          color: t.textMuted,
                          cursor: 'pointer',
                        }}
                        title="Editar"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDelete(member.id);
                        }}
                        style={{
                          padding: '5px',
                          background: 'none',
                          border: 'none',
                          color: t.primaryHover || '#cc0000',
                          cursor: 'pointer',
                        }}
                        title="Remover"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>

                <div
                  style={{
                    fontSize: '10.5px',
                    fontWeight: 600,
                    color: t.textMuted,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: '8px',
                  }}
                >
                  {member.department}
                </div>

                <p
                  style={{
                    margin: 0,
                    fontSize: '12.5px',
                    color: t.textSecondary,
                    lineHeight: 1.55,
                    flex: 1,
                  }}
                >
                  {member.description}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════
          FOOTER INFO
      ═══════════════════════════════════════════════════ */}
      <div
        style={{
          background: t.surfaceElevated,
          border: `1px solid ${t.border}`,
          borderRadius: '12px',
          padding: '20px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '8px',
              background: `linear-gradient(135deg, ${t.primary}, #cc0011)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Globe size={16} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: t.text }}>
              Plataforma de Inteligência Comercial Chok
            </div>
            <div style={{ fontSize: '11.5px', color: t.textMuted }}>
              v2.4.0 · Arquitetura RBAC · Isolamento Hierárquico · Recriado por RR Mind
            </div>
          </div>
        </div>

        <div style={{ fontSize: '11.5px', color: t.textSecondary }}>
          © 2026 Chok Distribuidora. Todos os direitos reservados.
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════
          MODAL — ADD/EDIT
      ═══════════════════════════════════════════════════ */}
      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
            animation: 'fadeIn 0.2s ease',
          }}
          onClick={(e) => e.target === e.currentTarget && setIsModalOpen(false)}
        >
          <div
            style={{
              background: t.surface,
              border: `1px solid ${t.border}`,
              borderRadius: '16px',
              width: '100%',
              maxWidth: '560px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
              animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <div
              style={{
                padding: '20px 24px',
                borderBottom: `1px solid ${t.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                position: 'sticky',
                top: 0,
                background: t.surface,
                zIndex: 2,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '8px',
                    background: `linear-gradient(135deg, ${t.primary}, #cc0011)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {editingMember ? <Edit2 size={15} color="#fff" /> : <Plus size={15} color="#fff" />}
                </div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: t.text }}>
                  {editingMember ? 'Editar Membro' : 'Adicionar Novo Membro'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{
                  padding: '6px',
                  background: 'none',
                  border: 'none',
                  color: t.textMuted,
                  cursor: 'pointer',
                  borderRadius: '6px',
                }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveMember} style={{ padding: '24px' }}>
              <FormField
                label="Nome Completo *"
                error={formErrors.name}
                theme={t}
              >
                <input
                  ref={firstInputRef}
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex: Ana Paula Silva"
                  style={inputStyle(t, !!formErrors.name)}
                />
              </FormField>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <FormField label="Cargo / Função *" error={formErrors.role} theme={t}>
                  <input
                    type="text"
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value)}
                    style={inputStyle(t, !!formErrors.role)}
                  />
                </FormField>

                <FormField label="Categoria" theme={t}>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as any)}
                    style={inputStyle(t)}
                  >
                    <option value="origin">Origem / Criador</option>
                    <option value="rrmind">RR Mind</option>
                    <option value="team">Equipe Complementar</option>
                  </select>
                </FormField>
              </div>

              <FormField
                label="Área / Departamento *"
                error={formErrors.department}
                theme={t}
              >
                <input
                  type="text"
                  value={formDepartment}
                  onChange={(e) => setFormDepartment(e.target.value)}
                  style={inputStyle(t, !!formErrors.department)}
                />
              </FormField>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <FormField label="Email (opcional)" error={formErrors.email} theme={t}>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="nome@chok.com.br"
                    style={inputStyle(t, !!formErrors.email)}
                  />
                </FormField>
                <FormField label="LinkedIn (opcional)" theme={t}>
                  <input
                    type="url"
                    value={formLinkedin}
                    onChange={(e) => setFormLinkedin(e.target.value)}
                    placeholder="linkedin.com/in/..."
                    style={inputStyle(t)}
                  />
                </FormField>
              </div>

              <FormField label="Habilidades (separadas por vírgula)" theme={t}>
                <input
                  type="text"
                  value={formSkills}
                  onChange={(e) => setFormSkills(e.target.value)}
                  placeholder="React, TypeScript, Design"
                  style={inputStyle(t)}
                />
              </FormField>

              <FormField label="Descrição das Responsabilidades" theme={t}>
                <textarea
                  rows={3}
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  style={{
                    ...inputStyle(t),
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    minHeight: '80px',
                  }}
                />
                <div
                  style={{
                    fontSize: '10.5px',
                    color: t.textMuted,
                    marginTop: '4px',
                    textAlign: 'right',
                  }}
                >
                  {formDesc.length} caracteres
                </div>
              </FormField>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '8px',
                    border: `1px solid ${t.border}`,
                    background: t.surfaceElevated,
                    color: t.textSecondary,
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 500,
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '10px 24px',
                    borderRadius: '8px',
                    border: 'none',
                    background: `linear-gradient(135deg, ${t.primary}, #cc0011)`,
                    color: '#fff',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '13px',
                    boxShadow: '0 2px 10px rgba(227, 6, 19, 0.3)',
                  }}
                >
                  {editingMember ? 'Salvar Alterações' : 'Adicionar Membro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════
          MODAL — DETALHE DO MEMBRO
      ═══════════════════════════════════════════════════ */}
      {detailMember && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
            animation: 'fadeIn 0.2s ease',
          }}
          onClick={(e) => e.target === e.currentTarget && setDetailMember(null)}
        >
          <div
            style={{
              background: t.surface,
              border: `1px solid ${t.border}`,
              borderRadius: '16px',
              width: '100%',
              maxWidth: '480px',
              overflow: 'hidden',
              boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
              animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <div
              style={{
                height: '80px',
                background: `linear-gradient(135deg, ${t.primary}, #6366f1)`,
                position: 'relative',
              }}
            >
              <button
                onClick={() => setDetailMember(null)}
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  padding: '6px',
                  background: 'rgba(0,0,0,0.3)',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '0 24px 24px', marginTop: -50 }}>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <PhotoAvatar
                  memberId={detailMember.id}
                  initials={detailMember.avatarInitials}
                  size={100}
                  gradient={`linear-gradient(135deg, ${t.primary}, #6366f1)`}
                  fontSize={32}
                />
              </div>

              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: t.text }}>
                  {detailMember.name}
                </h2>
                <div
                  style={{
                    fontSize: '13px',
                    color: t.primary,
                    fontWeight: 600,
                    marginTop: 4,
                  }}
                >
                  {detailMember.role}
                </div>
                <div
                  style={{
                    fontSize: '11.5px',
                    color: t.textMuted,
                    marginTop: 2,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    fontWeight: 600,
                  }}
                >
                  {detailMember.department}
                </div>
              </div>

              <p
                style={{
                  margin: '20px 0',
                  fontSize: '13.5px',
                  color: t.textSecondary,
                  lineHeight: 1.65,
                  textAlign: 'center',
                }}
              >
                {detailMember.description}
              </p>

              {detailMember.skills && detailMember.skills.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '6px',
                    justifyContent: 'center',
                    marginBottom: 16,
                  }}
                >
                  {detailMember.skills.map((skill, i) => (
                    <span
                      key={i}
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '4px 10px',
                        borderRadius: '12px',
                        background: `${t.primary}12`,
                        color: t.primary,
                        border: `1px solid ${t.primary}25`,
                      }}
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              )}

              {(detailMember.email || detailMember.linkedin) && (
                <div
                  style={{
                    display: 'flex',
                    gap: '8px',
                    justifyContent: 'center',
                    paddingTop: 16,
                    borderTop: `1px solid ${t.border}`,
                  }}
                >
                  {detailMember.email && (
                    <button
                      onClick={() => handleCopy(detailMember.email!, 'email')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 14px',
                        borderRadius: '8px',
                        border: `1px solid ${t.border}`,
                        background: t.surfaceElevated,
                        color: t.textSecondary,
                        fontSize: '12px',
                        cursor: 'pointer',
                      }}
                    >
                      {copiedField === 'email' ? (
                        <CheckCircle2 size={13} color="#10b981" />
                      ) : (
                        <Mail size={13} />
                      )}
                      {copiedField === 'email' ? 'Copiado!' : 'Email'}
                    </button>
                  )}
                  {detailMember.linkedin && (
                    <a
                      href={detailMember.linkedin.startsWith('http') ? detailMember.linkedin : `https://${detailMember.linkedin}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 14px',
                        borderRadius: '8px',
                        border: `1px solid ${t.border}`,
                        background: t.surfaceElevated,
                        color: t.textSecondary,
                        fontSize: '12px',
                        textDecoration: 'none',
                      }}
                    >
                      <Linkedin size={13} />
                      LinkedIn
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════
          MODAL — CONFIRMAÇÃO DE EXCLUSÃO
      ═══════════════════════════════════════════════════ */}
      {confirmDelete && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px',
            animation: 'fadeIn 0.2s ease',
          }}
          onClick={(e) => e.target === e.currentTarget && setConfirmDelete(null)}
        >
          <div
            style={{
              background: t.surface,
              border: `1px solid ${t.border}`,
              borderRadius: '14px',
              padding: '24px',
              width: '100%',
              maxWidth: '400px',
              boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
              animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 14,
              }}
            >
              <Trash2 size={20} color="#ef4444" />
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 700, color: t.text }}>
              Remover membro?
            </h3>
            <p style={{ margin: 0, fontSize: '13px', color: t.textSecondary, lineHeight: 1.55 }}>
              Esta ação não pode ser desfeita. O membro será removido permanentemente dos créditos.
            </p>
            <div
              style={{
                display: 'flex',
                gap: '10px',
                justifyContent: 'flex-end',
                marginTop: 20,
              }}
            >
              <button
                onClick={() => setConfirmDelete(null)}
                style={{
                  padding: '9px 16px',
                  borderRadius: '8px',
                  border: `1px solid ${t.border}`,
                  background: t.surfaceElevated,
                  color: t.textSecondary,
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 500,
                }}
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeleteMember(confirmDelete)}
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#ef4444',
                  color: '#fff',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                Remover
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════
          TOAST
      ═══════════════════════════════════════════════════ */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            background: t.surface,
            border: `1px solid ${
              toast.type === 'success' ? '#10b981' : toast.type === 'error' ? '#ef4444' : t.border
            }`,
            borderLeft: `4px solid ${
              toast.type === 'success' ? '#10b981' : toast.type === 'error' ? '#ef4444' : t.primary
            }`,
            borderRadius: '10px',
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
            zIndex: 10001,
            minWidth: 240,
            animation: 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {toast.type === 'success' && <CheckCircle2 size={17} color="#10b981" />}
          {toast.type === 'error' && <X size={17} color="#ef4444" />}
          {toast.type === 'info' && <Info size={17} color={t.primary} />}
          <span style={{ fontSize: '13px', color: t.text, fontWeight: 500 }}>{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            style={{
              background: 'none',
              border: 'none',
              color: t.textMuted,
              cursor: 'pointer',
              padding: '2px',
              marginLeft: 'auto',
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.15); opacity: 0.2; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(30px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @media (max-width: 760px) {
          .founder-grid {
            grid-template-columns: 1fr !important;
            text-align: center;
          }
          .founder-grid > div { margin: 0 auto; }
          .rrmind-grid { grid-template-columns: 1fr !important; }
          .timeline-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 20px !important;
          }
        }
      `}</style>
    </div>
  );
};

// ─── Helper Components & Functions ─────────────────────────────────
const HeartIconWrap = Heart; // apenas para evitar warning de linter

const FormField: React.FC<{
  label: string;
  error?: string;
  theme: any;
  children: React.ReactNode;
}> = ({ label, error, theme, children }) => (
  <div style={{ marginBottom: '14px' }}>
    <label
      style={{
        display: 'block',
        fontSize: '12px',
        fontWeight: 600,
        color: theme.textSecondary,
        marginBottom: '6px',
      }}
    >
      {label}
    </label>
    {children}
    {error && (
      <div
        style={{
          fontSize: '11px',
          color: '#ef4444',
          marginTop: '4px',
          fontWeight: 500,
        }}
      >
        {error}
      </div>
    )}
  </div>
);

const inputStyle = (t: any, hasError = false): React.CSSProperties => ({
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 14px',
  borderRadius: '8px',
  border: `1px solid ${hasError ? '#ef4444' : t.border}`,
  background: t.surfaceElevated,
  color: t.text,
  fontSize: '13.5px',
  outline: 'none',
  transition: 'border-color 0.2s',
});