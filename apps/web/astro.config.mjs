// @ts-check
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

// 纯静态输出，由 API Worker 以静态资源托管；开发时 /api 代理到 wrangler dev
export default defineConfig({
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    server: { proxy: { '/api': 'http://127.0.0.1:8787' } },
  },
});
