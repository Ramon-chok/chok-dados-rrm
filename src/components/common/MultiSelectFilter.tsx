import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { ChevronDown, Check, X } from 'lucide-react';

interface MultiSelectFilterProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
}

export const MultiSelectFilter: React.FC<MultiSelectFilterProps> = ({
  label,
  options,
  selected,
  onChange,
  placeholder = 'Todos',
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

  const toggleOption = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter((item) => item !== option));
    } else {
      onChange([...selected, option]);
    }
  };

  const handleSelectAll = () => {
    onChange([...options]);
  };

  const handleClear = () => {
    onChange([]);
  };

  const displayText =
    selected.length === 0
      ? placeholder
      : selected.length === options.length
      ? `Todos (${options.length})`
      : selected.length === 1
      ? selected[0]
      : `${selected.length} selecionados`;

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
          border: `1px solid ${selected.length > 0 ? t.primary : t.border}`,
          background: selected.length > 0 ? `${t.primary}0D` : t.surface,
          color: selected.length > 0 ? t.primary : t.textSecondary,
          fontSize: '13px',
          fontWeight: 500,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ fontSize: '11.5px', color: t.textMuted, textTransform: 'uppercase' }}>{label}:</span>
        <span style={{ fontWeight: 600, color: selected.length > 0 ? t.text : t.textSecondary }}>
          {displayText}
        </span>
        <ChevronDown size={14} color={selected.length > 0 ? t.primary : t.textMuted} />
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
          {/* Quick controls */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '4px 6px 8px',
              borderBottom: `1px solid ${t.border}`,
              fontSize: '11.5px',
            }}
          >
            <button
              onClick={handleSelectAll}
              style={{
                background: 'none',
                border: 'none',
                color: t.primary,
                cursor: 'pointer',
                fontWeight: 600,
                padding: '2px 4px',
              }}
            >
              Selecionar todos
            </button>
            <button
              onClick={handleClear}
              style={{
                background: 'none',
                border: 'none',
                color: t.textMuted,
                cursor: 'pointer',
                padding: '2px 4px',
              }}
            >
              Limpar
            </button>
          </div>

          {/* Options list */}
          <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {options.map((opt) => {
              const isSelected = selected.includes(opt);
              return (
                <div
                  key={opt}
                  onClick={() => toggleOption(opt)}
                  style={{
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
                  }}
                >
                  <span>{opt}</span>
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
