import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState('light');

  useEffect(() => {
    // Load theme from localStorage on mount
    const savedTheme = localStorage.getItem('iqms_theme') || 'light';
    setThemeState(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  const setTheme = useCallback((newTheme) => {
    setThemeState(newTheme);
    localStorage.setItem('iqms_theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};
