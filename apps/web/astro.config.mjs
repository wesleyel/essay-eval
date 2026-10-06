// @ts-check
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

// 纯静态输出，由 API Worker 以静态资源托管；开发时 /api 代理到 wrangler dev。
// GitHub Pages 构建通过环境变量设置 site/base，并以 PUBLIC_BACKEND=local 切换到浏览器端 IndexedDB 后端。
export default defineConfig({
  site: process.env.SITE_URL,
  base: process.env.BASE_PATH || '/',
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    server: { proxy: { '/api': 'http://127.0.0.1:8787' } },
  },
});
