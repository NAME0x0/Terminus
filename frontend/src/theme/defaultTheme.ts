import defaultThemeSource from '../../../res/themes/default.json';

export interface TerminusTheme {
  name: string;
  colors: {
    background: string;
    foreground: string;
    accent: string;
    selection: string;
    terminal: Record<string, string>;
    ui: Record<string, string>;
  };
  fonts: {
    terminal: {
      family: string;
      size: number;
      weight: string;
    };
    ui: {
      family: string;
      size: number;
      weight: string;
    };
  };
}

export const defaultTheme: TerminusTheme = defaultThemeSource;
