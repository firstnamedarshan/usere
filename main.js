import "@fontsource/manrope/latin-400.css";
import "@fontsource/manrope/latin-500.css";
import "@fontsource/manrope/latin-600.css";
import "@fontsource/manrope/latin-700.css";

// Ordinary links handle navigation, browser history and direct page reloads.
// Only the homepage imports its scroll story and Three.js animation.
const pagePath = window.location.pathname.replace(/\/+$/, "") || "/";

if (pagePath === "/") {
  await import("./homepage.js");
} else {
  const { showPage } = await import("./pages.js");
  showPage(pagePath);
}
