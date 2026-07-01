import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Auto-recover from stale dynamic-import chunk hashes after a redeploy.
// When a lazy route's JS filename no longer exists, force a one-time reload
// so the browser fetches the fresh index.html and new chunk hashes.
const RELOAD_KEY = "pepper.chunk-reload";
function handleChunkError(message: string) {
  if (!/Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(message)) return;
  if (sessionStorage.getItem(RELOAD_KEY)) return;
  sessionStorage.setItem(RELOAD_KEY, "1");
  window.location.reload();
}
window.addEventListener("error", (e) => handleChunkError(e.message || ""));
window.addEventListener("unhandledrejection", (e) => {
  const msg = (e.reason && (e.reason.message || String(e.reason))) || "";
  handleChunkError(msg);
});
// Clear the guard on a successful load.
window.addEventListener("load", () => sessionStorage.removeItem(RELOAD_KEY));

createRoot(document.getElementById("root")!).render(<App />);
