import React, { createContext, useContext, useState, useEffect } from 'react';
import { ThemeMode, ThemeColors } from '../types';
import { OrigemAnimacao, animarTrocaDeTema } from '../lib/themeTransition';

/**
 * Paleta oficial do Grupo Arantes.
 *
 * A fonte é o Manual de Identidade Visual do grupo. Onde o manual se
 * contradiz — o hex escrito no texto não bate com a cor desenhada nas
 * amostras — vale o DESENHADO, porque é o que aparece no logo ao lado da
 * interface:
 *
 *   azul      #2A4C7F  (o texto do manual diz #31729B — não usar)
 *   turquesa  #44ABAA  (o texto do manual diz #00B9CF — não usar)
 *
 * Claro  → fundos neutros quentes (#F8F8F7), azul Arantes como cor principal
 *          e turquesa escurecida como segunda voz.
 * Escuro → "Noite Arantes": azul-petróleo muito escuro (#0A0E14), com o azul
 *          clareado para manter contraste sobre ele.
 *
 * Regras que esta paleta carrega:
 *
 * 1. **Todo par texto/fundo passa de 4,5:1 nos dois temas.** A turquesa pura
 *    (`brandTurquesa`) é decorativa no claro; para texto use `accentTeal`.
 * 2. **Cor de status nunca é cor de marca.** `success`, `warning`, `danger` e
 *    `info` são vivas e separadas do azul institucional, que é sóbrio. O azul
 *    de informação é céu; o da marca é marinho.
 * 3. **O degradê é só da marca.** `gradient` vale em login, faixa do topo e
 *    ícone — nunca em fundo de card, de seção ou em texto.
 *
 * As chaves são as mesmas de antes (mais os tokens da identidade), então
 * nenhuma tela precisou ser reescrita para adotar o padrão.
 */
export const THEMES: Record<ThemeMode, ThemeColors> = {
  dark: {
    bg: '#0A0E14',
    bgSecondary: '#0E131B',
    surface: '#11161D',
    surfaceElevated: '#1C222C',
    border: '#242A33',
    borderActive: '#809CC6',
    text: '#ECECEA',
    textSecondary: '#9AA1AC',
    textMuted: '#788291',
    primary: '#809CC6',
    primaryHover: '#92ACD3',
    primaryDark: '#1D2635',
    primaryForeground: '#0C131D',
    // `accentPurple` manteve o nome por compatibilidade com as telas antigas;
    // o valor é a turquesa do grupo, que é a segunda voz da marca.
    accentPurple: '#49B6B4',
    accentPurpleLight: '#60C3C1',
    accentBlue: '#809CC6',
    accentBlueLight: '#92ACD3',
    complementaryRed: '#E75F5A',
    hover: '#1B2027',
    accentTeal: '#49B6B4',
    accentTealLight: '#60C3C1',
    success: '#4EBC81',
    warning: '#E0AC52',
    danger: '#E75F5A',
    gradientFrom: '#2A4C7F',
    gradientTo: '#44ABAA',
    shadow: '0 12px 40px rgb(0 0 0 / 0.5)',
    gradient: 'linear-gradient(135deg, #2A4C7F 0%, #2A4C7F 30%, #44ABAA 120%)',
    brandAzul: '#2A4C7F',
    brandTurquesa: '#44ABAA',
    brandFundo: '#E8E8E6',
    info: '#36C0F2',
  },
  light: {
    bg: '#F8F8F7',
    bgSecondary: '#F0F0EF',
    surface: '#FFFFFF',
    surfaceElevated: '#EEEEEC',
    border: '#DADAD7',
    borderActive: '#2A4C7F',
    text: '#150F0F',
    textSecondary: '#50494E',
    textMuted: '#776E75',
    primary: '#2A4C7F',
    primaryHover: '#223E67',
    primaryDark: '#1F375C',
    primaryForeground: '#FFFFFF',
    accentPurple: '#2A6F6E',
    accentPurpleLight: '#235C5B',
    accentBlue: '#2A4C7F',
    accentBlueLight: '#3E6CA8',
    complementaryRed: '#C52E2B',
    hover: '#E9E9E7',
    accentTeal: '#2A6F6E',
    accentTealLight: '#235C5B',
    success: '#20794A',
    warning: '#955D09',
    danger: '#C52E2B',
    gradientFrom: '#2A4C7F',
    gradientTo: '#44ABAA',
    shadow: '0 4px 12px hsl(216 40% 12% / 0.08)',
    gradient: 'linear-gradient(135deg, #2A4C7F 0%, #2A4C7F 30%, #44ABAA 120%)',
    brandAzul: '#2A4C7F',
    brandTurquesa: '#44ABAA',
    brandFundo: '#E8E8E6',
    info: '#096AAE',
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
    // theme-color exigido pelo padrão: #f8f8f7 no claro, #0a0e14 no escuro.
    // Pinta a barra do navegador no celular com a cor certa do tema.
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = palette.bg;
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
