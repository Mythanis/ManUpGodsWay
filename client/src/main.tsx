import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "leaflet/dist/leaflet.css";

// When the service worker updates and clears the old cache, it sends SW_UPDATED.
// We reload the page so the fresh CSS (with dark defaults) is applied immediately.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'SW_UPDATED') {
      window.location.reload();
    }
  });
}

createRoot(document.getElementById("root")!).render(<App />);
