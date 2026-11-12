/**
 * Peças visuais da tela Visual Fabricantes.
 *
 * Ficam separadas do arquivo da tela porque todas obedecem à mesma regra de
 * leitura, que é o ponto central do PRD: **ausência é diferente de zero**.
 * Por isso quase todo componente daqui aceita `null` e desenha um traço com
 * explicação, em vez de desenhar "0" e deixar o leitor concluir que não houve
 * venda, margem ou meta.
 *
 * O visual segue o mesmo vocabulário das outras telas (cartões em `t.surface`,
 * cantos de 12px, selo de variação arredondado, `className="num"` nos números),
 * para esta tela não parecer um corpo estranho dentro da plataforma.
 */
import React from 'react';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Info, Minus } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { Delta } from '../../lib/visualFabricantes';

// ─────────────────────────────────────────────────────────────────────────────
// Formatação
// ─────────────────────────────────────────────────────────────────────────────
export const fmtBRL = (v: number) => `R$ ${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
export const fmtBRL2 = (v: number) =>
  `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const fmtInt = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
export const fmtPct = (v: number) =>
  `${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

export type Formato = 'brl' | 'int' | 'pct';

/**
 * O traço é deliberado: um valor indisponível NUNCA vira 0 na tela.
 * Quem lê precisa distinguir "não houve" de "não sabemos".
 */
export const TRACO = '—';

export function formatar(valor: number | null | undefined, formato: Formato): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return TRACO;
  if (formato === 'brl') return fmtBRL(valor);
  if (formato === 'pct') return fmtPct(valor);
  return fmtInt(valor);
}

/** dd/mm/aaaa a partir de uma data ISO, sem passar por fuso horário. */
export function dataBR(iso: string | null | undefined): string {
  if (!iso) return TRACO;
  const [ano, mes, dia] = iso.slice(0, 10).split('-');
  return dia && mes && ano ? `${dia}/${mes}/${ano}` : iso;
}

// ─────────────────────────────────────────────────────────────────────────────
// Selo de variação (RF-011, RN-05)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Mostra diferença e percentual. Quando A é zero ou ausente, não inventa
 * crescimento: exibe "sem base comparável", que é o que o PRD exige.
 */
export const SeloVariacao: React.FC<{ delta?: Delta; formato: Formato; tamanho?: 'sm' | 'md' }> = ({
  delta,
  formato,
  tamanho = 'sm',
}) => {
  const { t } = useTheme();
  if (!delta || delta.diferenca === null || delta.diferenca === undefined) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          padding: tamanho === 'md' ? '5px 10px' : '3px 8px',
          borderRadius: 20,
          background: t.surfaceElevated,
          border: `1px solid ${t.border}`,
          color: t.textMuted,
          fontSize: tamanho === 'md' ? 12.5 : 11.5,
          fontWeight: 600,
          whiteSpace: 'nowrap',
        }}
        title="O período anterior não tem base comparável: ausência de dado não é queda."
      >
        <Minus size={tamanho === 'md' ? 14 : 12} />
        sem base comparável
      </span>
    );
  }

  const diferenca = delta.diferenca;
  const neutro = diferenca === 0;
  const positivo = diferenca > 0;
  const cor = neutro ? t.textMuted : positivo ? t.success : t.danger;
  const Icone = neutro ? Minus : positivo ? ArrowUpRight : ArrowDownRight;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: tamanho === 'md' ? '5px 10px' : '3px 8px',
        borderRadius: 20,
        background: `${cor}1A`,
        border: `1px solid ${cor}3D`,
        color: cor,
        fontSize: tamanho === 'md' ? 13.5 : 11.5,
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
    >
      <Icone size={tamanho === 'md' ? 15 : 13} />
      <span className="num">{formatar(diferenca, formato)}</span>
      {delta.variacao !== null && delta.variacao !== undefined && (
        <span className="num" style={{ fontWeight: 500, opacity: 0.85 }}>
          ({delta.variacao > 0 ? '+' : ''}
          {fmtPct(delta.variacao)})
        </span>
      )}
    </span>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Cartão de indicador
// ─────────────────────────────────────────────────────────────────────────────
export const CartaoIndicador: React.FC<{
  rotulo: string;
  valor: number | null;
  formato: Formato;
  icone?: React.ReactNode;
  delta?: Delta;
  /** Texto curto sob o número: regra de cálculo ou origem. */
  nota?: string;
  /** Mostrado no lugar do número quando ele é nulo. */
  motivoIndisponivel?: string;
  destaque?: boolean;
}> = ({ rotulo, valor, formato, icone, delta, nota, motivoIndisponivel, destaque }) => {
  const { t } = useTheme();
  const indisponivel = valor === null || valor === undefined;

  return (
    <div
      style={{
        background: t.surface,
        border: `1px solid ${destaque ? t.borderActive : t.border}`,
        borderRadius: 12,
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: t.textSecondary }}>
        {icone}
        <span style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '0.02em' }}>{rotulo}</span>
      </div>

      <div
        className="num"
        style={{
          fontSize: destaque ? 26 : 21,
          fontWeight: 700,
          color: indisponivel ? t.textMuted : t.text,
          lineHeight: 1.15,
          wordBreak: 'break-word',
        }}
      >
        {formatar(valor, formato)}
      </div>

      {indisponivel && motivoIndisponivel && (
        <div style={{ fontSize: 11, color: t.warning, lineHeight: 1.45 }}>{motivoIndisponivel}</div>
      )}
      {delta && <div><SeloVariacao delta={delta} formato={formato} /></div>}
      {nota && <div style={{ fontSize: 10.5, color: t.textMuted, lineHeight: 1.45 }}>{nota}</div>}
    </div>
  );
};

export const GradeCartoes: React.FC<{ min?: number; children: React.ReactNode }> = ({ min = 210, children }) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: `repeat(auto-fit, minmax(min(${min}px, 100%), 1fr))`,
      gap: 12,
    }}
  >
    {children}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Faixas de aviso e de origem
// ─────────────────────────────────────────────────────────────────────────────
/** Avisos de cobertura, precedência e sobreposição — ficam JUNTO dos números. */
export const FaixaAvisos: React.FC<{ avisos: string[]; tom?: 'aviso' | 'info' }> = ({ avisos, tom = 'aviso' }) => {
  const { t } = useTheme();
  if (!avisos.length) return null;
  const cor = tom === 'aviso' ? t.warning : t.accentBlue;
  const Icone = tom === 'aviso' ? AlertTriangle : Info;

  return (
    <div
      style={{
        background: `${cor}12`,
        border: `1px solid ${cor}3D`,
        borderRadius: 10,
        padding: '12px 14px',
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
        marginBottom: 14,
      }}
    >
      <Icone size={16} color={cor} style={{ flexShrink: 0, marginTop: 1 }} />
      <ul style={{ margin: 0, paddingLeft: 16, display: 'grid', gap: 5 }}>
        {avisos.map((a) => (
          <li key={a} style={{ fontSize: 12.5, color: t.text, lineHeight: 1.5 }}>
            {a}
          </li>
        ))}
      </ul>
    </div>
  );
};

/** Rodapé de rastreabilidade: de qual importação veio cada bloco. */
export const Fontes: React.FC<{ fontes?: Record<string, string>; extra?: string }> = ({ fontes, extra }) => {
  const { t } = useTheme();
  const itens = Object.entries(fontes || {});
  if (!itens.length && !extra) return null;
  return (
    <div style={{ marginTop: 12, fontSize: 11, color: t.textMuted, lineHeight: 1.6 }}>
      {itens.length > 0 && (
        <>
          <strong style={{ color: t.textSecondary }}>Origem: </strong>
          {itens.map(([k, v], i) => (
            <span key={k}>
              {i > 0 && ' · '}
              {k} = {v}
            </span>
          ))}
        </>
      )}
      {extra && <div style={{ marginTop: 4 }}>{extra}</div>}
    </div>
  );
};

/** Bloco de "não dá para responder isso com a base atual". */
export const BlocoIndisponivel: React.FC<{ titulo?: string; motivo: string }> = ({
  titulo = 'Informação indisponível',
  motivo,
}) => {
  const { t } = useTheme();
  return (
    <div
      style={{
        border: `1px dashed ${t.warning}55`,
        background: `${t.warning}0A`,
        borderRadius: 12,
        padding: '22px 20px',
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
      }}
    >
      <AlertTriangle size={20} color={t.warning} style={{ flexShrink: 0, marginTop: 2 }} />
      <div>
        <div style={{ fontWeight: 700, color: t.text, marginBottom: 6, fontSize: 13.5 }}>{titulo}</div>
        <div style={{ fontSize: 12.5, color: t.textSecondary, lineHeight: 1.6, maxWidth: 640 }}>{motivo}</div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Seções e tabelas
// ─────────────────────────────────────────────────────────────────────────────
export const Secao: React.FC<{
  titulo: string;
  descricao?: string;
  acoes?: React.ReactNode;
  children: React.ReactNode;
}> = ({ titulo, descricao, acoes, children }) => {
  const { t } = useTheme();
  return (
    <section
      style={{
        background: t.surface,
        border: `1px solid ${t.border}`,
        borderRadius: 12,
        padding: '16px 18px',
        marginBottom: 16,
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 14,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: t.text }}>{titulo}</h3>
          {descricao && (
            <p style={{ margin: '4px 0 0', fontSize: 12, color: t.textMuted, lineHeight: 1.55, maxWidth: 760 }}>
              {descricao}
            </p>
          )}
        </div>
        {acoes && <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>{acoes}</div>}
      </div>
      {children}
    </section>
  );
};

/** Tabela com rolagem controlada — no celular rola só a tabela, não a página. */
export const Tabela: React.FC<{ children: React.ReactNode; minWidth?: number }> = ({ children, minWidth = 680 }) => {
  const { t } = useTheme();
  return (
    <div style={{ overflowX: 'auto', border: `1px solid ${t.border}`, borderRadius: 10 }}>
      <table style={{ width: '100%', minWidth, borderCollapse: 'collapse', fontSize: 12.5 }}>{children}</table>
    </div>
  );
};

export const Th: React.FC<{ children: React.ReactNode; align?: 'left' | 'right' | 'center'; width?: number }> = ({
  children,
  align = 'left',
  width,
}) => {
  const { t } = useTheme();
  return (
    <th
      scope="col"
      style={{
        textAlign: align,
        padding: '10px 12px',
        background: t.surfaceElevated,
        color: t.textSecondary,
        fontWeight: 600,
        fontSize: 11.5,
        borderBottom: `1px solid ${t.border}`,
        whiteSpace: 'nowrap',
        width,
      }}
    >
      {children}
    </th>
  );
};

export const Td: React.FC<{
  children: React.ReactNode;
  align?: 'left' | 'right' | 'center';
  numero?: boolean;
  forte?: boolean;
}> = ({ children, align = 'left', numero, forte }) => {
  const { t } = useTheme();
  return (
    <td
      className={numero ? 'num' : undefined}
      style={{
        textAlign: align,
        padding: '9px 12px',
        borderBottom: `1px solid ${t.border}`,
        color: forte ? t.text : t.textSecondary,
        fontWeight: forte ? 700 : 500,
      }}
    >
      {children}
    </td>
  );
};

/** Selo de movimento entre A e B (entrou / saiu / cresceu / caiu). */
export const SeloMovimento: React.FC<{ movimento: string }> = ({ movimento }) => {
  const { t } = useTheme();
  const mapa: Record<string, { rotulo: string; cor: string }> = {
    entrou: { rotulo: 'entrou em B', cor: t.accentBlue },
    saiu: { rotulo: 'saiu em B', cor: t.danger },
    cresceu: { rotulo: 'cresceu', cor: t.success },
    caiu: { rotulo: 'caiu', cor: t.warning },
    estavel: { rotulo: 'estável', cor: t.textMuted },
  };
  const item = mapa[movimento] || mapa.estavel;
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 20,
        fontSize: 10.5,
        fontWeight: 700,
        background: `${item.cor}1A`,
        border: `1px solid ${item.cor}3D`,
        color: item.cor,
        whiteSpace: 'nowrap',
      }}
    >
      {item.rotulo}
    </span>
  );
};

/** Barra proporcional usada nos rankings. */
export const BarraProporcao: React.FC<{ valor: number; maximo: number; destaque?: boolean }> = ({
  valor,
  maximo,
  destaque,
}) => {
  const { t } = useTheme();
  const escala = maximo || 1;
  return (
    <div style={{ height: 6, borderRadius: 3, background: t.surfaceElevated, overflow: 'hidden', minWidth: 60 }}>
      <div
        style={{
          width: `${Math.max(1.5, (Math.abs(valor) / escala) * 100)}%`,
          height: '100%',
          borderRadius: 3,
          background: destaque ? `linear-gradient(90deg, ${t.gradientFrom}, ${t.gradientTo})` : t.textMuted,
          opacity: destaque ? 1 : 0.45,
          transition: 'width 0.4s ease',
        }}
      />
    </div>
  );
};

/** Botão padrão da tela (mesmo desenho dos demais botões do sistema). */
export const Botao: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  variante?: 'primario' | 'neutro' | 'perigo';
  disabled?: boolean;
  type?: 'button' | 'submit';
  titulo?: string;
}> = ({ children, onClick, variante = 'neutro', disabled, type = 'button', titulo }) => {
  const { t } = useTheme();
  const fundo = variante === 'primario' ? t.primary : variante === 'perigo' ? `${t.danger}1A` : t.surfaceElevated;
  const cor = variante === 'primario' ? '#fff' : variante === 'perigo' ? t.danger : t.textSecondary;
  const borda = variante === 'primario' ? t.primary : variante === 'perigo' ? `${t.danger}55` : t.border;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={titulo}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 14px',
        borderRadius: 8,
        border: `1px solid ${borda}`,
        background: fundo,
        color: cor,
        fontSize: 12.5,
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
      }}
    >
      {children}
    </button>
  );
};

/** Campo de data com rótulo, usado nos seletores de período A e B. */
export const CampoData: React.FC<{
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}> = ({ rotulo, valor, onChange, disabled }) => {
  const { t } = useTheme();
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      <span style={{ fontSize: 10.5, color: t.textMuted, fontWeight: 600 }}>{rotulo}</span>
      <input
        type="date"
        value={valor}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: '7px 10px',
          borderRadius: 8,
          border: `1px solid ${t.border}`,
          background: t.bgSecondary,
          color: t.text,
          fontSize: 12.5,
          colorScheme: 'inherit',
          minWidth: 0,
        }}
      />
    </label>
  );
};
