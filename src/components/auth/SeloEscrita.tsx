/**
 * Selo do modo de alteração, na faixa do topo.
 *
 * Diz, de relance, o que este perfil pode fazer com os dados agora. Existe
 * porque "acesso total" e "poder alterar" são coisas diferentes nesta
 * plataforma: um Gerente Comercial enxerga tudo, inclusive margens, e não
 * altera nada. Sem o selo, a pessoa só descobriria isso ao tentar salvar.
 *
 * O selo é informativo. A trava é o servidor, que confere o modo de escrita a
 * cada requisição de gravação.
 */
import React from 'react';
import { Eye, KeyRound, PenLine, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

/** Quanto falta da liberação temporária, em texto curto. */
function restante(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return null;
  const horas = Math.floor(ms / 3_600_000);
  const minutos = Math.floor((ms % 3_600_000) / 60_000);
  return horas > 0 ? `${horas} h ${minutos} min` : `${minutos} min`;
}

export const SeloEscrita: React.FC = () => {
  const { t } = useTheme();
  const { estadoEscrita } = useAuth();
  if (!estadoEscrita) return null;

  const { modo, podeAlterar, liberacaoExpiraEm } = estadoEscrita;
  const falta = restante(liberacaoExpiraEm);

  const aparencia = (() => {
    if (modo === 'livre') {
      return {
        icone: <PenLine size={13} />,
        texto: 'Alteração liberada',
        titulo: 'Seu perfil altera qualquer critério ou parâmetro, sem confirmação.',
        cor: '#fff',
      };
    }
    if (modo === 'confirmacao') {
      return {
        icone: <ShieldCheck size={13} />,
        texto: 'Altera com confirmação',
        titulo: 'Cada alteração do seu perfil pede uma confirmação antes de ser aplicada.',
        cor: '#fff',
      };
    }
    if (modo === 'liberacao') {
      return podeAlterar
        ? {
            icone: <KeyRound size={13} />,
            texto: falta ? `Liberado · ${falta}` : 'Liberado',
            titulo: `Liberação de alteração ativa${
              falta ? `, válida por mais ${falta}` : ''
            }. Quando ela expirar, seu perfil volta a ser de visualização.`,
            cor: t.brandTurquesa,
          }
        : {
            icone: <KeyRound size={13} />,
            texto: 'Sem liberação',
            titulo:
              'Seu perfil altera dados apenas com liberação do administrador. Peça a liberação para editar.',
            cor: t.warning,
          };
    }
    return {
      icone: <Eye size={13} />,
      texto: 'Somente visualização',
      titulo: 'Seu perfil consulta os dados; as alterações são feitas por outro perfil.',
      cor: 'rgba(255,255,255,0.85)',
    };
  })();

  return (
    <span
      title={aparencia.titulo}
      className="selo-escrita"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 11px',
        borderRadius: 8,
        border: '1px solid rgba(255,255,255,0.22)',
        background: 'rgba(255,255,255,0.10)',
        color: aparencia.cor,
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {aparencia.icone}
      {aparencia.texto}
    </span>
  );
};
