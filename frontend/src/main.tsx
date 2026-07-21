import '@xterm/xterm/css/xterm.css';
import './styles/tailwind.css';

import { createRoot } from 'react-dom/client';
import { invoke } from '@tauri-apps/api/core';

import { App } from '@/app/App';
import type { AppConfig } from '@/config/types';
import { ErrorCenter, renderFatalError } from '@/errors/ErrorCenter';
import { startTerminalEventListeners } from '@/terminal/TerminalPane';

async function bootstrap(app: HTMLDivElement): Promise<void> {
  const errors = new ErrorCenter();
  const config = await invoke<AppConfig>('get_config');
  await startTerminalEventListeners();
  createRoot(app).render(<App initialConfig={config} reportError={errors.report} />);
}

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) {
  throw new Error('missing #app root');
}
bootstrap(app).catch((error: unknown) => {
  renderFatalError(app, error, () => window.location.reload());
});
