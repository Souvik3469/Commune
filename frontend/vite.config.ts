import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // 👈 listen on all IPs, not just localhost
    port: 5173, // optional, set fixed port
  },
});
