import { createContext, useContext, useEffect } from "react";

interface ThemeContextType {
  theme: "dark";
  setTheme: (theme: "dark") => void;
  effectiveTheme: "dark";
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.remove("light");
    document.documentElement.classList.add("dark");
    document.documentElement.style.backgroundColor = "#0a0a0a";
  }, []);

  return (
    <ThemeContext.Provider value={{ theme: "dark", setTheme: (_: "dark") => {}, effectiveTheme: "dark" }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
