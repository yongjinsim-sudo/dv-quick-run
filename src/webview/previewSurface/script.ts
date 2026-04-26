export function getPreviewSurfaceScript(): string {
  return `
    const vscode = acquireVsCodeApi();
    const shell = document.querySelector('.preview-shell');
    const previewId = shell ? shell.getAttribute('data-preview-id') : '';

    document.querySelectorAll('button[data-action-id]').forEach((button) => {
      button.addEventListener('click', () => {
        if (button.disabled) {
          return;
        }

        vscode.postMessage({
          type: 'previewAction',
          previewId,
          actionId: button.getAttribute('data-action-id'),
          actionKind: button.getAttribute('data-action-kind')
        });
      });
    });
  `;
}
