import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "@fontsource-variable/dm-sans";
import "@fontsource/playfair-display/500.css";
import "@fontsource/playfair-display/600.css";
import "@fontsource/playfair-display/700.css";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
