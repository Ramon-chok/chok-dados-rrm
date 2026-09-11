import React, { useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { Search, ExternalLink, Package, Filter, ArrowUpRight } from 'lucide-react';

const CATALOGO_ITEMS = [
  {
    codigo: 'A-1042',
    nome: 'Bala de goma 500g Sortida',
    fabricante: 'ARCOR',
    categoria: 'Doces',
    linha: 'Balas',
    preco: 'R$ 12,90',
    status: 'Disponível',
    descricao: 'Balas de goma sortidas com sabores naturais de frutas, pacote institucional 500g.',
    unidadesCaixa: 24,
    codigoBarras: '7891234567890',
  },
  {
    codigo: 'A-1088',
    nome: 'Chocolate ao leite 900g Tablete',
    fabricante: 'ARCOR',
    categoria: 'Chocolates',
    linha: 'Barras',
    preco: 'R$ 24,50',
    status: 'Disponível',
    descricao: 'Tablete culinário e de consumo direto com alto teor de cacau nobre.',
    unidadesCaixa: 12,
    codigoBarras: '7891234567891',
  },
  {
    codigo: 'H-2210',
    nome: 'Ketchup Tradicional 1kg Bag',
    fabricante: 'HEINZ',
    categoria: 'Condimentos',
    linha: 'Molhos',
    preco: 'R$ 9,80',
    status: 'Estoque Baixo',
    descricao: 'Ketchup tradicional número 1 do mundo, preparado com tomates 100% selecionados.',
    unidadesCaixa: 18,
    codigoBarras: '7891234567892',
  },
  {
    codigo: 'H-2255',
    nome: 'Maionese Especial 500g Squeeze',
    fabricante: 'HEINZ',
    categoria: 'Condimentos',
    linha: 'Molhos',
    preco: 'R$ 7,40',
    status: 'Disponível',
    descricao: 'Maionese cremosa com ovos caipiras, embalagem squeeze ergonômica.',
    unidadesCaixa: 20,
    codigoBarras: '7891234567893',
  },
  {
    codigo: 'N-3301',
    nome: 'Achocolatado em Pó 400g Lata',
    fabricante: 'NESTLÉ',
    categoria: 'Bebidas',
    linha: 'Achocolatados',
    preco: 'R$ 11,20',
    status: 'Disponível',
    descricao: 'Fórmula enriquecida com 8 vitaminas e minerais essenciais para nutrição diária.',
    unidadesCaixa: 30,
    codigoBarras: '7891234567894',
  },
  {
    codigo: 'U-4410',
    nome: 'Sabão em Pó Concentrado 1kg',
    fabricante: 'UNILEVER',
    categoria: 'Limpeza',
    linha: 'Lavanderia',
    preco: 'R$ 14,30',
    status: 'Disponível',
    descricao: 'Poder de remoção de manchas em uma única lavagem com micropartículas de oxigênio ativo.',
    unidadesCaixa: 14,
    codigoBarras: '7891234567895',
  },
];

export const CatalogoPage: React.FC = () => {
  const { t } = useTheme();
  const [query, setQuery] = useState('');
  const [fabricante, setFabricante] = useState('Todos');

  const filtered = CATALOGO_ITEMS.filter((item) => {
    if (fabricante !== 'Todos' && item.fabricante !== fabricante) return false;
    const q = query.toLowerCase();
    return item.nome.toLowerCase().includes(q) || item.codigo.toLowerCase().includes(q) || item.categoria.toLowerCase().includes(q);
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '22px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 className="num" style={{ margin: '0 0 6px', fontSize: '24px', fontWeight: 700, color: t.text }}>
            Catálogo Comercial de Produtos
          </h1>
          <p style={{ margin: 0, fontSize: '13.5px', color: t.textSecondary }}>
            Estrutura preparada para catálogo integrado com imagens, fichas técnicas e tabela de preços.
          </p>
        </div>

        <a
          href="https://catalogo-externo.exemplo.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '9px 15px',
            borderRadius: '8px',
            border: `1px solid ${t.border}`,
            background: t.surface,
            color: t.textSecondary,
            textDecoration: 'none',
            fontSize: '13px',
            fontWeight: 500,
          }}
        >
          <span>Abrir Catálogo Externo Oficial</span>
          <ExternalLink size={14} color={t.textMuted} />
        </a>
      </div>

      {/* Busca e filtros */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            border: `1px solid ${t.border}`,
            borderRadius: '8px',
            padding: '10px 14px',
            flex: '1 1 280px',
            background: t.surface,
          }}
        >
          <Search size={16} color={t.textMuted} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pesquisar por nome, código ou descrição..."
            style={{
              border: 'none',
              outline: 'none',
              background: 'transparent',
              color: t.text,
              fontSize: '13.5px',
              width: '100%',
              fontFamily: "'Inter', sans-serif",
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {['Todos', 'ARCOR', 'HEINZ', 'NESTLÉ', 'UNILEVER'].map((f) => (
            <button
              key={f}
              onClick={() => setFabricante(f)}
              style={{
                fontSize: '12.5px',
                padding: '8px 14px',
                borderRadius: '8px',
                cursor: 'pointer',
                border: `1px solid ${fabricante === f ? t.primary : t.border}`,
                background: fabricante === f ? t.primary : t.surface,
                color: fabricante === f ? '#fff' : t.textSecondary,
                fontWeight: fabricante === f ? 600 : 500,
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Grid de Cards de Produtos */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '20px',
        }}
      >
        {filtered.map((item) => (
          <div
            key={item.codigo}
            style={{
              background: t.surface,
              border: `1px solid ${t.border}`,
              borderRadius: '14px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              transition: 'transform 0.15s ease, border-color 0.15s ease',
            }}
          >
            {/* Header do Card */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  background: t.surfaceElevated,
                  border: `1px solid ${t.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: t.primary,
                }}
              >
                <Package size={20} />
              </div>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '3px 8px',
                  borderRadius: '6px',
                  background: item.status === 'Disponível' ? 'rgba(61, 214, 140, 0.12)' : 'rgba(232, 179, 57, 0.12)',
                  color: item.status === 'Disponível' ? '#3DD68C' : '#E8B339',
                  border: `1px solid ${item.status === 'Disponível' ? 'rgba(61, 214, 140, 0.3)' : 'rgba(232, 179, 57, 0.3)'}`,
                }}
              >
                ● {item.status}
              </span>
            </div>

            <div style={{ fontSize: '11.5px', color: t.textMuted, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {item.fabricante} · {item.categoria}
            </div>

            <h3 style={{ margin: '0 0 8px', fontSize: '15.5px', fontWeight: 600, color: t.text, lineHeight: 1.3 }}>
              {item.nome}
            </h3>

            <p style={{ margin: '0 0 16px', fontSize: '12.5px', color: t.textSecondary, lineHeight: 1.5, flex: 1 }}>
              {item.descricao}
            </p>

            <div
              style={{
                borderTop: `1px solid ${t.border}`,
                paddingTop: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: '11px', color: t.textMuted }}>Preço Referência</div>
                <div className="num" style={{ fontSize: '18px', fontWeight: 700, color: t.text }}>
                  {item.preco}
                </div>
              </div>

              <div style={{ textAlign: 'right', fontSize: '12px', color: t.textSecondary }}>
                <div>Cód: <strong>{item.codigo}</strong></div>
                <div style={{ color: t.textMuted }}>Caixa c/ {item.unidadesCaixa} un</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
