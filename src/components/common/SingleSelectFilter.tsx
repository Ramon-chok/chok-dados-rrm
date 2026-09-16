import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { ChevronDown, Check } from 'lucide-react';

export interface SingleSelectOption {
  value: string;
  label: string;
}

interface SingleSelectFilterProps {
  label: string;
  options: SingleSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  allLabel?: string;
  /** false para controles que sempre têm um valor selecionado (sem opção "Todos") — ex: quantidade a exibir. */
  allowClear?: boolean;
}

// Mesmo visual do MultiSelectFilter (botão pill + painel com lista de
// opções), mas para seleção única — usado nos filtros que só aceitam um
// valor por vez (equipe, vendedor, fabricante etc.).
export const SingleSelectFilter: React.FC<SingleSelectFilterProps> = ({
  label,
  options,
  value,
  onChange,
  placeholder = 'Todos',
  allLabel = 'Todos',
  allowClear = true,
}) => {
  const { t } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find((o) => o.value === value);
  const isActive = !!value;
  const displayText = selectedOption ? selectedOption.label : placeholder;

  const handleSelect = (v: string) => {
    onChange(v);
    setIsOpen(false);
  };

  const itemStyle = (isSelected: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 8px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '12.5px',
    background: isSelected ? `${t.primary}15` : 'transparent',
    color: isSelected ? t.primary : t.text,
    fontWeight: isSelected ? 600 : 400,
  });

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '7px 12px',
          borderRadius: '8px',
          border: `1px solid ${isActive ? t.primary : t.border}`,
          background: isActive ? `${t.primary}0D` : t.surface,
          color: isActive ? t.primary : t.textSecondary,
          fontSize: '13px',
          fontWeight: 500,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ fontSize: '11.5px', color: t.textMuted, textTransform: 'uppercase' }}>{label}:</span>
        <span style={{ fontWeight: 600, color: isActive ? t.text : t.textSecondary }}>{displayText}</span>
        <ChevronDown size={14} color={isActive ? t.primary : t.textMuted} />
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            zIndex: 1000,
            minWidth: '220px',
            maxWidth: 'calc(100vw - 32px)',
            width: 'max-content',
            background: t.surfaceElevated,
            border: `1px solid ${t.border}`,
            borderRadius: '10px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.25)',
            padding: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <div style={{ maxHeight: '240px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {allowClear && (
              <div onClick={() => handleSelect('')} style={itemStyle(!value)}>
                <span>{allLabel}</span>
                {!value && <Check size={14} color={t.primary} />}
              </div>
            )}
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <div key={opt.value} onClick={() => handleSelect(opt.value)} style={itemStyle(isSelected)}>
                  <span>{opt.label}</span>
                  {isSelected && <Check size={14} color={t.primary} />}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
