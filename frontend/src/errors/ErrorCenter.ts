export type ErrorReporter = (context: string, error: unknown) => void;

const MAX_NOTICES = 3;

export class ErrorCenter {
  private readonly host = document.createElement('section');

  constructor(parent: HTMLElement = document.body) {
    this.host.className = 'error-notices';
    this.host.ariaLabel = 'Application notices';
    this.host.setAttribute('aria-live', 'polite');
    parent.append(this.host);
  }

  readonly report: ErrorReporter = (context, error) => {
    const notice = document.createElement('div');
    notice.className = 'error-notice';
    notice.role = 'alert';

    const message = document.createElement('span');
    message.className = 'error-notice-message';
    message.textContent = `${context}: ${errorMessage(error)}`;

    const dismiss = document.createElement('button');
    dismiss.type = 'button';
    dismiss.className = 'error-notice-dismiss';
    dismiss.title = 'Dismiss notice';
    dismiss.ariaLabel = dismiss.title;
    dismiss.textContent = 'x';
    dismiss.addEventListener('click', () => notice.remove());

    notice.append(message, dismiss);
    this.host.append(notice);
    while (this.host.childElementCount > MAX_NOTICES) {
      this.host.firstElementChild?.remove();
    }
  };
}

export function renderFatalError(root: HTMLElement, error: unknown, retry: () => void): void {
  const panel = document.createElement('main');
  panel.className = 'fatal-error';
  panel.role = 'alert';

  const title = document.createElement('h1');
  title.textContent = 'Terminus could not start';
  const message = document.createElement('p');
  message.textContent = errorMessage(error);
  const retryButton = document.createElement('button');
  retryButton.type = 'button';
  retryButton.className = 'fatal-error-retry';
  retryButton.textContent = 'Retry';
  retryButton.addEventListener('click', retry);

  panel.append(title, message, retryButton);
  root.replaceChildren(panel);
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return String(error);
}
