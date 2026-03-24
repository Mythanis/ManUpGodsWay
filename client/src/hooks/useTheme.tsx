import { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

type Theme = "light" | "dark" | "system";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  effectiveTheme: "light" | "dark";
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // Initialize theme from user preference or localStorage, fallback to dark
  const [theme, setThemeState] = useState<Theme>(() => {
    const userTheme = (user as any)?.themePreference;
    if (userTheme && ["light", "dark", "system"].includes(userTheme)) {
      return userTheme as Theme;
    }
    
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme && ["light", "dark", "system"].includes(savedTheme)) {
      return savedTheme as Theme;
    }
    
    return "dark";
  });

  // Update theme preference on server
  const updateThemeMutation = useMutation({
    mutationFn: async (newTheme: Theme) => {
      return await apiRequest("PUT", "/api/user/theme", { themePreference: newTheme });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    }
  });

  // Calculate effective theme (resolving "system" to actual theme)
  // Default to dark immediately — do not start as "light" which causes a white flash
  const [effectiveTheme, setEffectiveTheme] = useState<"light" | "dark">(() => {
    if (typeof window === 'undefined') return 'dark';
    const saved = localStorage.getItem('theme');
    if (saved === 'light') return 'light';
    if (saved === 'system') return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    return 'dark';
  });

  useEffect(() => {
    const getEffectiveTheme = () => {
      if (theme === "system") {
        return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      }
      return theme as "light" | "dark";
    };

    const updateEffectiveTheme = () => {
      const newEffectiveTheme = getEffectiveTheme();
      setEffectiveTheme(newEffectiveTheme);
      
      // Apply theme to document
      const root = document.documentElement;
      root.classList.remove("light", "dark");
      root.classList.add(newEffectiveTheme);
    };

    updateEffectiveTheme();

    // Listen for system theme changes
    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      mediaQuery.addEventListener("change", updateEffectiveTheme);
      return () => mediaQuery.removeEventListener("change", updateEffectiveTheme);
    }
  }, [theme]);

  // Sync with user preference changes
  useEffect(() => {
    const userTheme = (user as any)?.themePreference;
    if (userTheme && userTheme !== theme) {
      setThemeState(userTheme as Theme);
    }
  }, [(user as any)?.themePreference]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem("theme", newTheme);
    
    // Update on server if user is logged in
    if (user) {
      updateThemeMutation.mutate(newTheme);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, effectiveTheme }}>
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