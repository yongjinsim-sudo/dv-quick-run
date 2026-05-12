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
