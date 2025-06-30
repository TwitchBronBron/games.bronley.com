import { defineConfig } from 'vite';
import replace from '@rollup/plugin-replace';

export default defineConfig({
  server: {
    host: '0.0.0.0', // Allow external connections
    port: 5173, // Optional: specify default port
    allowedHosts: true // Allow all hostnames
  },
  build: {
    chunkSizeWarningLimit: 1600, // Increase limit to accommodate Phaser library
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser']
        }
      },
      plugins: [
        //  Toggle the booleans here to enable / disable Phaser 3 features:
        replace({
          'typeof CANVAS_RENDERER': "'true'",
          'typeof WEBGL_RENDERER': "'true'",
          'typeof EXPERIMENTAL': "'true'",
          'typeof PLUGIN_CAMERA3D': "'false'",
          'typeof PLUGIN_FBINSTANT': "'false'",
          'typeof FEATURE_SOUND': "'true'",
          preventAssignment: true
        })
      ]
    }
  }
});
