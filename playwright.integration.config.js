import base from "./playwright.config.js";
export default {
  ...base,
  testMatch: "**/integration.spec.js",
  testIgnore: [],
  use: { ...base.use, baseURL: "http://127.0.0.1:5176" },
  webServer: {
    command: "npm run dev -- --port 5176 --strictPort",
    url: "http://127.0.0.1:5176",
    reuseExistingServer: false,
    env: { VITE_SUPABASE_URL: "https://mvp-test.supabase.co", VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_fixture" },
  },
};
