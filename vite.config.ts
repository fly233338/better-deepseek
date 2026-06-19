import { copyFile } from 'node:fs/promises';
import { build, defineConfig, type Plugin } from 'vite';

export default defineConfig({
  publicDir: 'public',
  plugins: [popupBuildPlugin()],
  build: {
    emptyOutDir: true,
    sourcemap: true,
    cssCodeSplit: false,
    lib: {
      entry: 'src/content/index.ts',
      name: 'BetterDeepSeek',
      formats: ['iife'],
      fileName: () => 'content.js',
    },
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) return 'style.css';
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
  },
});

function popupBuildPlugin(): Plugin {
  return {
    name: 'better-deepseek-popup-build',
    apply: 'build',
    async closeBundle() {
      await build({
        configFile: false,
        publicDir: false,
        build: {
          outDir: 'dist',
          emptyOutDir: false,
          sourcemap: true,
          rollupOptions: {
            input: {
              popup: 'src/popup.html',
            },
            output: {
              entryFileNames: 'popup.js',
              chunkFileNames: 'assets/[name]-[hash].js',
              assetFileNames: (assetInfo) => {
                if (assetInfo.name?.endsWith('.css')) return 'popup.css';
                return 'assets/[name]-[hash][extname]';
              },
            },
          },
        },
      });
      await copyFile('dist/src/popup.html', 'dist/popup.html');
    },
  };
}
