import '@xterm/xterm/css/xterm.css';
import './styles/app.css';

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { createActionRegistry } from './actions/actions';
import { CommandPalette } from './actions/CommandPalette';
import type { AppConfig } from './config/types';
import { ErrorCenter, renderFatalError } from './errors/ErrorCenter';
import { bindKeybindings } from './keys/keybindings';
import { LayoutController } from './layout/LayoutController';
import { startTerminalEventListeners, TerminalPane } from './terminal/TerminalPane';
import { applyTheme, resolveTheme } from './theme/applyTheme';

async function bootstrap(app: HTMLDivElement): Promise<void> {
  const errors = new ErrorCenter();
  let config = await invoke<AppConfig>('get_config');
  let xtermTheme = applyTheme(resolveTheme(config.appearance.theme));

  app.innerHTML = `
    <main class="app-shell">
      <header class="topbar">
        <div class="brand">Terminus</div>
        <nav class="tabs" aria-label="Terminal tabs"></nav>
        <div class="topbar-actions" aria-label="Terminal actions"></div>
      </header>
      <section class="workspace" aria-label="Terminal workspace"></section>
      <footer class="statusbar">
        <span class="status-text">v0.1 terminal core</span>
      </footer>
    </main>
  `;

  const tabBar = app.querySelector<HTMLElement>('.tabs');
  const topbarActions = app.querySelector<HTMLElement>('.topbar-actions');
  const workspace = app.querySelector<HTMLElement>('.workspace');
  const statusText = app.querySelector<HTMLElement>('.status-text');
  if (!tabBar || !topbarActions || !workspace || !statusText) {
    throw new Error('failed to create app shell');
  }

  await startTerminalEventListeners();

  let layout: LayoutController;
  layout = new LayoutController(
    tabBar,
    workspace,
    statusText,
    (cwd) =>
      new TerminalPane(
        config,
        xtermTheme,
        (pane) => layout.setFocusedPane(pane),
        (command, pane) => layout.handlePaneCommand(command, pane),
        (pane) => layout.handlePaneMetadataChange(pane),
        errors.report,
        cwd
      )
  );

  let palette: CommandPalette;
  const actions = createActionRegistry(layout, () => palette.open(), errors.report);
  palette = new CommandPalette(actions);
  renderTopbarActions(topbarActions, actions);
  const keybindings = bindKeybindings(config, actions);
  await listen<AppConfig>('config://reloaded', (event) => {
    try {
      const nextConfig = event.payload;
      const nextTheme = applyTheme(resolveTheme(nextConfig.appearance.theme));
      layout.applyConfig(nextConfig, nextTheme);
      keybindings.update(nextConfig);
      config = nextConfig;
      xtermTheme = nextTheme;
    } catch (error) {
      errors.report('Could not apply reloaded configuration', error);
    }
  });
  await layout.initialize();
}

function renderTopbarActions(host: HTMLElement, actions: ReturnType<typeof createActionRegistry>): void {
  host.replaceChildren(
    topbarButton('New tab', '+', () => actions.run('newTab')),
    topbarButton('Split right', '|', () => actions.run('splitVertical')),
    topbarButton('Split down', '-', () => actions.run('splitHorizontal')),
    topbarButton('Command palette', '>', () => actions.run('commandPalette'))
  );
}

function topbarButton(title: string, label: string, run: () => void | Promise<void>): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'topbar-action';
  button.title = title;
  button.ariaLabel = title;
  button.textContent = label;
  button.addEventListener('click', () => {
    void run();
  });
  return button;
}

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) {
  throw new Error('missing #app root');
}
bootstrap(app).catch((error: unknown) => {
  renderFatalError(app, error, () => window.location.reload());
});
