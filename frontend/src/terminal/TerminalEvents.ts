import { listen } from '@tauri-apps/api/event';

export interface TerminalOutput {
  id: number;
  data: string;
}

export interface TerminalExit {
  id: number;
  code: number | null;
}

let listenersPromise: Promise<void> | null = null;

export async function startTerminalEventStream(
  onOutput: (output: TerminalOutput) => void,
  onExit: (exit: TerminalExit) => void
): Promise<void> {
  if (!listenersPromise) {
    listenersPromise = registerTerminalEventListeners(onOutput, onExit).catch((error: unknown) => {
      listenersPromise = null;
      throw error;
    });
  }
  await listenersPromise;
}

async function registerTerminalEventListeners(
  onOutput: (output: TerminalOutput) => void,
  onExit: (exit: TerminalExit) => void
): Promise<void> {
  const registrations = await Promise.allSettled([
    listen<TerminalOutput>('terminal://output', (event) => onOutput(event.payload)),
    listen<TerminalExit>('terminal://exit', (event) => onExit(event.payload))
  ]);
  const failure = registrations.find((registration) => registration.status === 'rejected');
  if (!failure || failure.status !== 'rejected') {
    return;
  }

  for (const registration of registrations) {
    if (registration.status === 'fulfilled') {
      registration.value();
    }
  }
  throw failure.reason;
}
