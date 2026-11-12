import React, { createContext, useContext, useState, useEffect } from 'react';
import { ThemeMode, ThemeColors } from '../types';
import { OrigemAnimacao, animarTrocaDeTema } from '../lib/themeTransition';

/**
 * Paleta padronizada no padrão visual GA 360 (Grupo Arantes), mantendo a
 * identidade do Chok: o vermelho da marca continua vivo em `complementaryRed`
 * e na tela de login (que usa o vermelho próprio, inalterado).
 *
 * Escuro  → fundos grafite / preto azulado, azul-marinho + azul-claro como
 *           cores principais e verde-água (turquesa) como detalhe.
 * Claro   → mesma família de azuis sobre superfícies neutras, para menus,
 *           cards, tabelas e gráficos ficarem consistentes nos dois modos.
 *
 * As chaves são exatamente as mesmas de antes (mais os tokens novos, opcionais
 * no uso), então nenhuma tela precisou ser reescrita para adotar a padronização.
 */
export const THEMES: Record<ThemeMode, ThemeColors> = {
  dark: {
    bg: '#070B12',
    bgSecondary: '#0A1220',
    surface: '#0F1A2B',
    surfaceElevated: '#152338',
    border: '#1E3048',
    borderActive: '#2DD4BF',
    text: '#EAF1FA',
    textSecondary: '#93A4BC',
    textMuted: '#6B7E99',
    primary: '#2F7FF0',
    primaryHover: '#5BA3FF',
    primaryDark: '#15396E',
    accentPurple: '#2DD4BF',
    accentPurpleLight: '#5EEAD4',
    accentBlue: '#2F7FF0',
    accentBlueLight: '#6FB4FF',
    complementaryRed: '#E3566B',
    hover: '#152338',
    accentTeal: '#2DD4BF',
    accentTealLight: '#5EEAD4',
    success: '#3DD68C',
    warning: '#F5A524',
    danger: '#F2555A',
    gradientFrom: '#15396E',
    gradientTo: '#2DD4BF',
    shadow: '0 10px 30px rgba(3, 7, 14, 0.55)',
  },
  light: {
    bg: '#FFFFFF',
    bgSecondary: '#F3F6FB',
    surface: '#FFFFFF',
    surfaceElevated: '#F3F6FB',
    border: '#DDE5F0',
    borderActive: '#0F7FA8',
    text: '#0C1725',
    textSecondary: '#3B4A5F',
    textMuted: '#7B8AA0',
    primary: '#1565D8',
    primaryHover: '#2F7FF0',
    primaryDark: '#0E3F8C',
    accentPurple: '#0F7FA8',
    accentPurpleLight: '#14A2B8',
    accentBlue: '#1565D8',
    accentBlueLight: '#4F94EA',
    complementaryRed: '#E30613',
    hover: '#EAF1FB',
    accentTeal: '#0F7FA8',
    accentTealLight: '#14A2B8',
    success: '#128A58',
    warning: '#B57200',
    danger: '#C62330',
    gradientFrom: '#0E3F8C',
    gradientTo: '#14A2B8',
    shadow: '0 8px 24px rgba(15, 35, 65, 0.10)',
  },
};

interface ThemeContextType {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  /**
   * Alterna claro/escuro com o efeito de círculo que se abre.
   * `origem` são as coordenadas do clique (centro do botão) — passá-las faz a
   * animação nascer de onde o usuário tocou; sem elas, nasce no canto do tema.
   */
  toggleTheme: (origem?: OrigemAnimacao) => void;
  t: ThemeColors;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('chok_theme_mode');
    return saved === 'light' ? 'light' : 'dark';
  });

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    localStorage.setItem('chok_theme_mode', newMode);
  };

  const toggleTheme = (origem?: OrigemAnimacao) => {
    const destino: ThemeMode = mode === 'dark' ? 'light' : 'dark';
    // A cor de fundo do tema que está chegando é o que a camada da animação
    // usa quando o navegador não tem View Transitions.
    animarTrocaDeTema(() => setMode(destino), origem, THEMES[destino].bg);
  };

  // Além da classe `dark` (já usada antes), publica a paleta como variáveis CSS.
  // Isso permite padronizar scrollbar, foco, seleção e animações no index.css
  // sem que nenhuma tela existente precise mudar.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', mode === 'dark');
    const root = document.documentElement;
    const palette = THEMES[mode];
    for (const [key, value] of Object.entries(palette)) {
      root.style.setProperty(`--ga-${key}`, String(value));
    }
    root.style.colorScheme = mode;
  }, [mode]);

  return (
    <ThemeContext.Provider value={{ mode, setMode, toggleTheme, t: THEMES[mode] }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
