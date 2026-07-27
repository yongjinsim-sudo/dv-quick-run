export function getDvQuickRunHubScript(): string {
  return `(() => {
  const vscode = acquireVsCodeApi();

  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (event) => {
      const target = event.currentTarget instanceof HTMLAnchorElement ? event.currentTarget.hash : '';
      if (!target) {
        return;
      }
      const element = document.querySelector(target);
      if (!element) {
        return;
      }
      event.preventDefault();
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  document.querySelectorAll('[data-copy-text]').forEach((button) => {
    button.addEventListener('click', async (event) => {
      const element = event.currentTarget instanceof HTMLElement ? event.currentTarget : undefined;
      const text = element?.getAttribute('data-copy-text') ?? '';
      if (!text) {
        return;
      }

      try {
        await navigator.clipboard.writeText(text);
        const original = element?.textContent ?? 'Copy';
        if (element) {
          element.textContent = 'Copied';
          window.setTimeout(() => { element.textContent = original; }, 1400);
        }
        const status = document.querySelector('.dvqr-copy-status');
        if (status) {
          status.textContent = 'Prompt copied to the clipboard.';
        }
      } catch {
        const status = document.querySelector('.dvqr-copy-status');
        if (status) {
          status.textContent = 'Copy failed. Select the prompt text manually.';
        }
      }
    });
  });

  document.querySelectorAll('[data-command]').forEach((button) => {
    button.addEventListener('click', (event) => {
      const command = event.currentTarget instanceof HTMLElement
        ? event.currentTarget.getAttribute('data-command')
        : undefined;

      if (!command) {
        return;
      }

      const rawArgs = event.currentTarget instanceof HTMLElement
        ? event.currentTarget.getAttribute('data-command-args')
        : undefined;
      let args = [];

      if (rawArgs) {
        try {
          const parsed = JSON.parse(rawArgs);
          args = Array.isArray(parsed) ? parsed : [];
        } catch {
          args = [];
        }
      }

      vscode.postMessage({
        type: 'runCommand',
        command,
        args
      });
    });
  });
})();`;
}
