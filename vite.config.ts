import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Relative base so the build works on GitHub Pages project sites,
// Netlify, Cloudflare Pages, or a plain static host without reconfig.
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Chords',
        short_name: 'Chords',
        description: 'A clean, mobile-first guitar chord reader. Just the chords.',
        theme_color: '#111317',
        background_color: '#111317',
        display: 'standalone',
        orientation: 'portrait-primary',
        icons: [
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        navigateFallback: 'index.html',
      },
    }),
  ],
  // Local dev convenience: proxy /api/fetch to the worker running on 8787.
  server: {
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
});
