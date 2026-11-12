import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { kit } from "@cogitato/runtime/vite";

export default defineConfig({
  plugins: [react(), kit()],
});
