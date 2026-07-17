export interface AppConfig {
  appearance: AppearanceConfig;
  shell: ShellConfig;
  keybindings: Record<string, string>;
}

export interface AppearanceConfig {
  theme: string;
  fontFamily: string;
  fontSize: number;
}

export interface ShellConfig {
  program: string | null;
  args: string[];
  cwd: string | null;
}
