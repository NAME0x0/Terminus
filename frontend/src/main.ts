import '@xterm/xterm/css/xterm.css';
import './styles/app.css';

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { createActionRegistry } from './actions/actions';
import { CommandPalette } from './actions/CommandPalette';
import type { AppConfig } from './config/types';
import { ErrorCenter, renderFatalError } from './errors/ErrorCenter';
import { bindKeybindings } from './keys/keybindings';
import { actionHint, formatShortcut, shortcutForAction } from './keys/shortcutHints';
import { LayoutController } from './layout/LayoutController';
import { SettingsPanel } from './settings/SettingsPanel';
import { startTerminalEventListeners, TerminalPane } from './terminal/TerminalPane';
import { applyTheme, resolveTheme } from './theme/applyTheme';
import { createIcon, type IconName } from './ui/icons';

async function bootstrap(app: HTMLDivElement): Promise<void> {
  const errors = new ErrorCenter();
  let config = await invoke<AppConfig>('get_config');
  let xtermTheme = applyTheme(resolveTheme(config.appearance.theme));

  app.innerHTML = `
    <main class="app-shell">
      <header class="topbar">
        <div class="brand" aria-label="Terminus">
          <span class="brand-mark" aria-hidden="true">&gt;_</span>
          <span class="brand-name">Terminus</span>
        </div>
        <nav class="tabs" aria-label="Terminal tabs"></nav>
        <div class="topbar-actions" aria-label="Workspace actions"></div>
      </header>
      <section class="workspace" aria-label="Terminal workspace"></section>
      <footer class="statusbar">
        <span class="status-text">v0.1 terminal core</span>
        <span class="status-mode">Local workspace</span>
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
  let settings: SettingsPanel | undefined;
  let keybindings: ReturnType<typeof bindKeybindings> | undefined;
  const actions = createActionRegistry(
    layout,
    () => palette.open(),
    () => settings?.open(),
    errors.report
  );
  palette = new CommandPalette(actions, (actionId) => shortcutForAction(config.keybindings, actionId));

  const applyConfig = (nextConfig: AppConfig): void => {
    const nextTheme = applyTheme(resolveTheme(nextConfig.appearance.theme));
    layout.applyConfig(nextConfig, nextTheme);
    keybindings?.update(nextConfig);
    settings?.update(nextConfig);
    config = nextConfig;
    xtermTheme = nextTheme;
    renderTopbarActions(topbarActions, actions, nextConfig);
  };

  settings = new SettingsPanel(
    config,
    actions,
    async (nextConfig) => {
      const saved = await invoke<AppConfig>('save_config', { config: nextConfig });
      applyConfig(saved);
      return saved;
    },
    errors.report
  );
  renderTopbarActions(topbarActions, actions, config);
  keybindings = bindKeybindings(config, actions);
  await listen<AppConfig>('config://reloaded', (event) => {
    try {
      applyConfig(event.payload);
    } catch (error) {
      errors.report('Could not apply reloaded configuration', error);
    }
  });
  await layout.initialize();
}

function renderTopbarActions(
  host: HTMLElement,
  actions: ReturnType<typeof createActionRegistry>,
  config: AppConfig
): void {
  host.replaceChildren(
    topbarButton('New tab', 'newTab', 'newTab', config, () => actions.run('newTab'), true),
    topbarButton('Commands', 'command', 'commandPalette', config, () => actions.run('commandPalette')),
    topbarButton('Settings', 'settings', 'settings', config, () => actions.run('settings'))
  );
}

function topbarButton(
  title: string,
  icon: IconName,
  actionId: string,
  config: AppConfig,
  run: () => void | Promise<void>,
  primary = false
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = primary ? 'topbar-action is-primary' : 'topbar-action';
  const hint = actionHint(title, config.keybindings, actionId);
  button.title = hint;
  button.ariaLabel = hint;
  button.append(createIcon(icon));
  const label = document.createElement('span');
  label.className = 'topbar-action-label';
  label.textContent = title;
  button.append(label);
  const shortcut = shortcutForAction(config.keybindings, actionId);
  if (shortcut) {
    const key = document.createElement('kbd');
    key.className = 'topbar-shortcut';
    key.textContent = formatShortcut(shortcut);
    button.append(key);
  }
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
