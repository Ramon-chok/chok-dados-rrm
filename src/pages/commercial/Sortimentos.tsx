import React, { useState, useMemo } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { ExportExcelButton } from '../../components/common/ExportExcelButton';
import { Search } from 'lucide-react';

const allProdutos = [
  { codigo: 'A-1042', nome: 'Bala de goma 500g', fabricante: 'ARCOR', categoria: 'Doces', status: 'Ativo', meta: 45000, realizado: 41200, gap: -3800, atingimento: 91.6, cobertura: 384 },
  { codigo: 'A-1088', nome: 'Chocolate ao leite 900g', fabricante: 'ARCOR', categoria: 'Chocolates', status: 'Ativo', meta: 62000, realizado: 58900, gap: -3100, atingimento: 95.0, cobertura: 420 },
  { codigo: 'H-2210', nome: 'Ketchup 1kg', fabricante: 'HEINZ', categoria: 'Condimentos', status: 'Ativo', meta: 58000, realizado: 54100, gap: -3900, atingimento: 93.3, cobertura: 512 },
  { codigo: 'H-2255', nome: 'Maionese 500g', fabricante: 'HEINZ', categoria: 'Condimentos', status: 'Ativo', meta: 42000, realizado: 39900, gap: -2100, atingimento: 95.0, cobertura: 490 },
  { codigo: 'N-3301', nome: 'Achocolatado 400g', fabricante: 'NESTLÉ', categoria: 'Bebidas', status: 'Ativo', meta: 85000, realizado: 71200, gap: -13800, atingimento: 83.8, cobertura: 620 },
  { codigo: 'N-3355', nome: 'Leite condensado 395g', fabricante: 'NESTLÉ', categoria: 'Laticínios', status: 'Inativo', meta: 40000, realizado: 28500, gap: -11500, atingimento: 71.3, cobertura: 310 },
  { codigo: 'U-4410', nome: 'Sabão em pó 1kg', fabricante: 'UNILEVER', categoria: 'Limpeza', status: 'Ativo', meta: 75000, realizado: 72800, gap: -2200, atingimento: 97.1, cobertura: 680 },
  { codigo: 'U-4488', nome: 'Amaciante 2L', fabricante: 'UNILEVER', categoria: 'Limpeza', status: 'Ativo', meta: 52000, realizado: 48900, gap: -3100, atingimento: 94.0, cobertura: 540 },
];

const CATEGORIAS = ['Todas', 'Doces', 'Chocolates', 'Condimentos', 'Bebidas', 'Laticínios', 'Limpeza'];
const STATUSES = ['Todos', 'Ativo', 'Inativo'];

const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR')}`;

export const SortimentosPage: React.FC = () => {
  const { t } = useTheme();
  const { currentUser } = useAuth();
  const [query, setQuery] = useState('');
  const [fabricante, setFabricante] = useState('Todos');
  const [categoria, setCategoria] = useState('Todas');
  const [status, setStatus] = useState('Todos');

  // RBAC Filtering for Sortimentos:
  // Admin / Gerência: Todos os fabricantes
  // Supervisor: Fabricantes vinculados à equipe
  // Vendedor: Fabricantes da carteira do vendedor
  const produtosBase = useMemo(() => {
    if (!currentUser || currentUser.role === 'ADMIN' || currentUser.role === 'GERENTE') {
      return allProdutos;
    }
    if (currentUser.role === 'SUPERVISOR') {
      return allProdutos.filter((p) => ['ARCOR', 'HEINZ', 'UNILEVER'].includes(p.fabricante));
    }
    if (currentUser.role === 'VENDEDOR') {
      return allProdutos.filter((p) => ['ARCOR', 'HEINZ'].includes(p.fabricante));
    }
    return allProdutos;
  }, [currentUser]);

  const fabricantesOptions = useMemo(() => {
    const list = Array.from(new Set(produtosBase.map((p) => p.fabricante)));
    return ['Todos', ...list];
  }, [produtosBase]);

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    return produtosBase.filter((p) => {
      if (fabricante !== 'Todos' && p.fabricante !== fabricante) return false;
      if (categoria !== 'Todas' && p.categoria !== categoria) return false;
      if (status !== 'Todos' && p.status !== status) return false;
      if (q && !p.nome.toLowerCase().includes(q) && !p.codigo.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [produtosBase, query, fabricante, categoria, status]);

  const handleExportExcel = () => {
    const data = filtrados.map((p) => ({
      Código: p.codigo,
      'Descrição do Produto': p.nome,
      Fabricante: p.fabricante,
      Categoria: p.categoria,
      'Meta (R$)': p.meta,
      'Realizado (R$)': p.realizado,
      'GAP (R$)': p.gap,
      'Atingimento %': p.atingimento,
      Status: p.status,
    }));
    return [{ sheetName: 'Sortimentos', data }];
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 className="num" style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: 700, color: t.text }}>
            Sortimentos
          </h2>
          <div style={{ fontSize: '12.5px', color: t.textMuted }}>
            Acompanhamento comercial de metas e faturamento por item de sortimento
          </div>
        </div>

        <ExportExcelButton
          filename="Sortimentos_Comercial.xlsx"
          onPrepareData={handleExportExcel}
        />
      </div>

      {/* Busca instantânea + filtros */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', border: `1px solid ${t.border}`, borderRadius: '8px', padding: '10px 14px', flex: '1 1 280px', background: t.surface }}>
          <Search size={16} color={t.textMuted} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por código ou descrição do produto..."
            style={{ border: 'none', outline: 'none', background: 'transparent', color: t.text, fontSize: '14px', width: '100%', fontFamily: "'Inter', sans-serif" }}
          />
        </div>
        {[
          { value: fabricante, set: setFabricante, options: fabricantesOptions },
          { value: categoria, set: setCategoria, options: CATEGORIAS },
          { value: status, set: setStatus, options: STATUSES },
        ].map((f, i) => (
          <select
            key={i}
            value={f.value}
            onChange={(e) => f.set(e.target.value)}
            style={{
              fontSize: '13px',
              color: t.textSecondary,
              border: `1px solid ${t.border}`,
              borderRadius: '8px',
              padding: '10px 12px',
              background: t.surface,
              cursor: 'pointer',
              fontFamily: "'Inter', sans-serif",
            }}
          >
            {f.options.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        ))}
      </div>

      <div style={{ fontSize: '12.5px', color: t.textMuted, marginBottom: '10px' }}>
        {filtrados.length} produto{filtrados.length !== 1 ? 's' : ''} encontrado{filtrados.length !== 1 ? 's' : ''}
      </div>

      {/* Tabela */}
      <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ color: t.textMuted }}>
                {['Código', 'Descrição do Produto', 'Fabricante', 'Categoria', 'Meta', 'Realizado', 'GAP', '% Atingimento', 'Status'].map((h, idx) => (
                  <th
                    key={h}
                    style={{
                      textAlign: idx >= 4 && idx <= 7 ? 'right' : 'left',
                      padding: '12px 14px',
                      borderBottom: `1px solid ${t.border}`,
                      fontWeight: 500,
                      whiteSpace: 'nowrap',
                      background: t.bgSecondary,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((p) => (
                <tr key={p.codigo} style={{ borderBottom: `1px solid ${t.border}` }}>
                  <td className="num" style={{ padding: '12px 14px', color: t.textSecondary }}>{p.codigo}</td>
                  <td style={{ padding: '12px 14px', fontWeight: 500, color: t.text }}>{p.nome}</td>
                  <td style={{ padding: '12px 14px', color: t.textSecondary }}>{p.fabricante}</td>
                  <td style={{ padding: '12px 14px', color: t.textSecondary }}>{p.categoria}</td>
                  <td className="num" style={{ padding: '12px 14px', textAlign: 'right', color: t.textSecondary }}>{fmt(p.meta)}</td>
                  <td className="num" style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600, color: t.text }}>{fmt(p.realizado)}</td>
                  <td className="num" style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600, color: t.primaryHover }}>{fmt(p.gap)}</td>
                  <td
                    className="num"
                    style={{
                      padding: '12px 14px',
                      textAlign: 'right',
                      fontWeight: 600,
                      color: p.atingimento >= 90 ? '#3DD68C' : p.atingimento >= 80 ? t.text : t.primaryHover,
                    }}
                  >
                    {p.atingimento.toFixed(1)}%
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: p.status === 'Ativo' ? '#3DD68C' : t.textMuted }}>
                      ● {p.status}
                    </span>
                  </td>
                </tr>
              ))}
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ padding: '28px 14px', textAlign: 'center', color: t.textMuted, fontSize: '13.5px' }}>
                    Nenhum produto encontrado para os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
