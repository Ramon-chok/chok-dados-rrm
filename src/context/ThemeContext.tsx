import React, { createContext, useContext, useState, useEffect } from 'react';
import { ThemeMode, ThemeColors } from '../types';

export const THEMES: Record<ThemeMode, ThemeColors> = {
  dark: {
    bg: '#0B0F17',
    bgSecondary: '#0D1426',
    surface: '#111827',
    surfaceElevated: '#162032',
    border: '#34365A',
    borderActive: '#62508F',
    text: '#F1F1F6',
    textSecondary: '#9AA4B8',
    textMuted: '#77839A',
    primary: '#8B5CF6',
    primaryHover: '#A78BFA',
    primaryDark: '#62508F',
    accentPurple: '#8B5CF6',
    accentPurpleLight: '#A78BFA',
    accentBlue: '#1478F2',
    accentBlueLight: '#248BFF',
    complementaryRed: '#C63F2D',
    hover: '#162032',
  },
  light: {
    bg: '#FFFFFF',
    bgSecondary: '#F5F6F8',
    surface: '#FFFFFF',
    surfaceElevated: '#F5F6F8',
    border: '#E5E7EB',
    borderActive: '#E30613',
    text: '#111827',
    textSecondary: '#374151',
    textMuted: '#9CA3AF',
    primary: '#E30613',
    primaryHover: '#FF1F2D',
    primaryDark: '#B9040E',
    accentPurple: '#E30613',
    accentPurpleLight: '#FF1F2D',
    accentBlue: '#1478F2',
    accentBlueLight: '#248BFF',
    complementaryRed: '#C63F2D',
    hover: '#F0F1F3',
  },
};

interface ThemeContextType {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
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

  const toggleTheme = () => {
    setMode(mode === 'dark' ? 'light' : 'dark');
  };

  useEffect(() => {
    document.documentElement.classList.toggle('dark', mode === 'dark');
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
