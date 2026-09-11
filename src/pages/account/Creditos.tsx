import React, { useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import {
  Award,
  Users,
  ShieldCheck,
  Plus,
  Edit2,
  Trash2,
  Check,
  Sparkles,
  ExternalLink,
  Code2,
  Database,
  Layers,
  HeartHandshake,
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
}

const INITIAL_TEAM: TeamMember[] = [
  {
    id: 'founder-1',
    name: 'Dra. Maria Helena Chok',
    role: 'Fundadora & Presidente do Conselho',
    department: 'Diretoria Executiva',
    description:
      'Visionária e fundadora da Chok Distribuidora, idealizou a modernização analítica corporativa e a democratização dos dados para toda a força de vendas.',
    avatarInitials: 'MC',
    displayOrder: 1,
    status: 'Ativo',
  },
  {
    id: 'team-1',
    name: 'Roberto Alcantara',
    role: 'Líder de Reestruturação & Estratégia Comercial',
    department: 'Reestruturação & BI',
    description:
      'Coordenação executiva da transição digital, remodelagem de indicadores de metas, positivação e política de sortimentos.',
    avatarInitials: 'RA',
    displayOrder: 2,
    status: 'Ativo',
  },
  {
    id: 'team-2',
    name: 'Camila Mendonça',
    role: 'Arquiteta de Soluções & Engenharia de Dados',
    department: 'Tecnologia & Dados',
    description:
      'Modelagem da infraestrutura de dados em tempo real, pipelines de consolidação hierárquica e integridade relacional.',
    avatarInitials: 'CM',
    displayOrder: 3,
    status: 'Ativo',
  },
  {
    id: 'team-3',
    name: 'Lucas Nogueira',
    role: 'Engenheiro Full-Stack & Interface do Usuário',
    department: 'Desenvolvimento',
    description:
      'Implementação da interface de alta performance, componentes do Design System e integração dos fluxos analíticos.',
    avatarInitials: 'LN',
    displayOrder: 4,
    status: 'Ativo',
  },
  {
    id: 'team-4',
    name: 'Beatriz Vasconcelos',
    role: 'Designer de Produto & UX/UI',
    department: 'Design System',
    description:
      'Concepção visual com foco em legibilidade, tipografia de alta densidade e ergonomia de uso para gestores e representantes.',
    avatarInitials: 'BV',
    displayOrder: 5,
    status: 'Ativo',
  },
  {
    id: 'team-5',
    name: 'Eduardo Silveira',
    role: 'Especialista de Implantação Comercial & Suporte',
    department: 'Operações de Campo',
    description:
      'Validação com supervisores e gerentes regionais, homologação dos cálculos de GAP e treinamento de equipes.',
    avatarInitials: 'ES',
    displayOrder: 6,
    status: 'Ativo',
  },
];

export const CreditosPage: React.FC = () => {
  const { t } = useTheme();
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'ADMIN';

  const [members, setMembers] = useState<TeamMember[]>(INITIAL_TEAM);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [formName, setFormName] = useState('');
  const [formRole, setFormRole] = useState('');
  const [formDepartment, setFormDepartment] = useState('');
  const [formDesc, setFormDesc] = useState('');

  const founder = members.find((m) => m.displayOrder === 1) || members[0];
  const restructuringTeam = members.filter((m) => m.id !== founder.id && m.status === 'Ativo');

  const openAddModal = () => {
    setEditingMember(null);
    setFormName('');
    setFormRole('');
    setFormDepartment('Reestruturação');
    setFormDesc('');
    setIsModalOpen(true);
  };

  const openEditModal = (member: TeamMember) => {
    setEditingMember(member);
    setFormName(member.name);
    setFormRole(member.role);
    setFormDepartment(member.department);
    setFormDesc(member.description);
    setIsModalOpen(true);
  };

  const handleSaveMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    if (editingMember) {
      setMembers((prev) =>
        prev.map((m) =>
          m.id === editingMember.id
            ? {
                ...m,
                name: formName,
                role: formRole,
                department: formDepartment,
                description: formDesc,
              }
            : m
        )
      );
    } else {
      const initials = formName
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0].toUpperCase())
        .join('');

      const newMember: TeamMember = {
        id: `team-${Date.now()}`,
        name: formName,
        role: formRole,
        department: formDepartment,
        description: formDesc,
        avatarInitials: initials || 'EX',
        displayOrder: members.length + 1,
        status: 'Ativo',
      };
      setMembers((prev) => [...prev, newMember]);
    }
    setIsModalOpen(false);
  };

  const handleDeleteMember = (id: string) => {
    if (confirm('Tem certeza que deseja remover este membro da equipe de créditos?')) {
      setMembers((prev) => prev.filter((m) => m.id !== id));
    }
  };

  return (
    <div style={{ maxWidth: '1040px' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '28px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <h1 className="num" style={{ margin: '0 0 6px', fontSize: '24px', fontWeight: 700, color: t.text }}>
            Créditos & Institucional da Plataforma
          </h1>
          <p style={{ margin: 0, fontSize: '13.5px', color: t.textSecondary }}>
            Reconhecimento institucional à liderança, arquitetos e profissionais responsáveis pela criação e evolução do ecossistema de inteligência comercial.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={openAddModal}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 16px',
              borderRadius: '8px',
              border: 'none',
              background: t.primary,
              color: '#fff',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 2px 10px rgba(227, 6, 19, 0.3)',
            }}
          >
            <Plus size={16} />
            <span>Adicionar Membro da Equipe</span>
          </button>
        )}
      </div>

      {/* FOUNDER SPOTLIGHT SECTION (Requirement 42, 43) */}
      <div
        style={{
          background: t.surface,
          border: `1px solid ${t.border}`,
          borderRadius: '16px',
          padding: '32px',
          marginBottom: '36px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '12px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: t.primary,
            marginBottom: '18px',
          }}
        >
          <Award size={16} color={t.primary} />
          <span>Liderança & Legado Corporativo</span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '120px 1fr auto',
            gap: '24px',
            alignItems: 'center',
          }}
          className="founder-grid"
        >
          {/* Avatar / Photo */}
          <div
            style={{
              width: '108px',
              height: '108px',
              borderRadius: '50%',
              background: `linear-gradient(135deg, ${t.primary}, #8B0000)`,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '34px',
              fontWeight: 700,
              boxShadow: '0 8px 24px rgba(227, 6, 19, 0.35)',
              border: '3px solid rgba(255,255,255,0.2)',
            }}
          >
            {founder.avatarInitials}
          </div>

          {/* Details */}
          <div>
            <h2 style={{ margin: '0 0 6px', fontSize: '22px', fontWeight: 700, color: t.text }}>
              {founder.name}
            </h2>
            <div
              style={{
                fontSize: '14.5px',
                fontWeight: 600,
                color: t.primary,
                marginBottom: '12px',
              }}
            >
              {founder.role}
            </div>
            <p
              style={{
                margin: 0,
                fontSize: '14px',
                color: t.textSecondary,
                lineHeight: 1.6,
                maxWidth: '740px',
              }}
            >
              {founder.description}
            </p>
          </div>

          {isAdmin && (
            <div>
              <button
                onClick={() => openEditModal(founder)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: `1px solid ${t.border}`,
                  background: t.surfaceElevated,
                  color: t.textSecondary,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12.5px',
                }}
              >
                <Edit2 size={14} />
                <span>Editar</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* RESTRUCTURING & DEVELOPMENT TEAM (Requirement 44, 45) */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
          <Users size={18} color={t.primary} />
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: t.text }}>
            Equipe de Reestruturação & Engenharia
          </h2>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '18px',
          }}
        >
          {restructuringTeam.map((member) => (
            <div
              key={member.id}
              style={{
                background: t.surface,
                border: `1px solid ${t.border}`,
                borderRadius: '12px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '14px' }}>
                <div
                  style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '50%',
                    background: t.surfaceElevated,
                    border: `1.5px solid ${t.border}`,
                    color: t.primary,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '15px',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {member.avatarInitials}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: t.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {member.name}
                  </div>
                  <div style={{ fontSize: '12.5px', color: t.primary, fontWeight: 500 }}>
                    {member.role}
                  </div>
                </div>

                {isAdmin && (
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      onClick={() => openEditModal(member)}
                      style={{
                        padding: '5px',
                        background: 'none',
                        border: 'none',
                        color: t.textMuted,
                        cursor: 'pointer',
                      }}
                      title="Editar membro"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteMember(member.id)}
                      style={{
                        padding: '5px',
                        background: 'none',
                        border: 'none',
                        color: t.primaryHover,
                        cursor: 'pointer',
                      }}
                      title="Remover membro"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>

              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: t.textMuted,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  marginBottom: '8px',
                }}
              >
                {member.department}
              </div>

              <p style={{ margin: 0, fontSize: '12.5px', color: t.textSecondary, lineHeight: 1.5, flex: 1 }}>
                {member.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* PLATFORM ARCHITECTURE SPECS */}
      <div
        style={{
          background: t.surfaceElevated,
          border: `1px solid ${t.border}`,
          borderRadius: '12px',
          padding: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <div style={{ fontSize: '13.5px', fontWeight: 600, color: t.text }}>
            Plataforma de Inteligência de Dados & Negócios Chok
          </div>
          <div style={{ fontSize: '12px', color: t.textMuted }}>
            Versão de Produção 2.4.0 · Arquitetura Segura RBAC com Isolamento Hierárquico
          </div>
        </div>

        <div style={{ fontSize: '12px', color: t.textSecondary }}>
          © 2026 Chok Distribuidora. Todos os direitos reservados.
        </div>
      </div>

      {/* MODAL FOR ADMIN TO ADD/EDIT MEMBERS (Requirement 46) */}
      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
        >
          <div
            style={{
              background: t.surface,
              border: `1px solid ${t.border}`,
              borderRadius: '14px',
              padding: '24px',
              width: '100%',
              maxWidth: '500px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
            }}
          >
            <h3 style={{ margin: '0 0 16px', fontSize: '17px', fontWeight: 700, color: t.text }}>
              {editingMember ? 'Editar Membro da Equipe' : 'Adicionar Novo Membro'}
            </h3>

            <form onSubmit={handleSaveMember}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: t.textSecondary, marginBottom: '4px' }}>
                  Nome Completo
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: `1px solid ${t.border}`,
                    background: t.surfaceElevated,
                    color: t.text,
                    fontSize: '13.5px',
                  }}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: t.textSecondary, marginBottom: '4px' }}>
                  Cargo / Função
                </label>
                <input
                  type="text"
                  required
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: `1px solid ${t.border}`,
                    background: t.surfaceElevated,
                    color: t.text,
                    fontSize: '13.5px',
                  }}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: t.textSecondary, marginBottom: '4px' }}>
                  Área / Departamento
                </label>
                <input
                  type="text"
                  required
                  value={formDepartment}
                  onChange={(e) => setFormDepartment(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: `1px solid ${t.border}`,
                    background: t.surfaceElevated,
                    color: t.text,
                    fontSize: '13.5px',
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: t.textSecondary, marginBottom: '4px' }}>
                  Descrição das Responsabilidades
                </label>
                <textarea
                  rows={3}
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: `1px solid ${t.border}`,
                    background: t.surfaceElevated,
                    color: t.text,
                    fontSize: '13px',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '6px',
                    border: `1px solid ${t.border}`,
                    background: t.surfaceElevated,
                    color: t.textSecondary,
                    cursor: 'pointer',
                    fontSize: '13px',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 18px',
                    borderRadius: '6px',
                    border: 'none',
                    background: t.primary,
                    color: '#fff',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '13px',
                  }}
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 760px) {
          .founder-grid {
            grid-template-columns: 1fr !important;
            text-align: center;
          }
          .founder-grid > div {
            margin: 0 auto;
          }
        }
      `}</style>
    </div>
  );
};
