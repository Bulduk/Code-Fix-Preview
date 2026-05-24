import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Default to dark mode for trading OS
const savedDark = localStorage.getItem("nexus_dark");
const isDark = savedDark !== "0"; // default dark unless explicitly set to light
document.documentElement.classList.toggle("dark", isDark);
document.documentElement.classList.toggle("light", !isDark);

createRoot(document.getElementById("root")!).render(<App />);
