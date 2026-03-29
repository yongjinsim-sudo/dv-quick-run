export const RESULT_VIEWER_SCRIPT_UTILITIES = String.raw`
function showCopyStatus(message) {
            copyStatus.textContent = message;

            if (copyStatusTimeout) {
                clearTimeout(copyStatusTimeout);
            }

            copyStatusTimeout = setTimeout(() => {
                copyStatus.textContent = "";
            }, 1200);
        }

        function escapeHtml(value) {
            return String(value)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/\"/g, "&quot;")
                .replace(/'/g, "&#039;");
        }

        function escapeAttribute(value) {
            return String(value)
                .replace(/&/g, "&amp;")
                .replace(/\"/g, "&quot;");
        }

        function renderTraversalStatus(traversal) {
            if (!traversalStatus) {
                return;
            }

            if (!traversal || !traversal.title) {
                traversalStatus.innerHTML = "";
                return;
            }

            const subtitle = traversal.subtitle
                ? "<span class='traversal-status-subtitle'>" + escapeHtml(traversal.subtitle) + "</span>"
                : "";

            traversalStatus.innerHTML =
                "<span class='traversal-status-pill'>" +
                "<span class='traversal-status-title'>" + escapeHtml(traversal.title) + "</span>" +
                subtitle +
                "</span>";
        }
`;
