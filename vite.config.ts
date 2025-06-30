import { defineConfig } from 'vite';
import replace from '@rollup/plugin-replace';

// Generate build timestamp
const buildTimestamp = new Date().toLocaleString('en-US', {
  year: 'numeric',
  month: '2-digit',  
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
}).replace(/(\d+)\/(\d+)\/(\d+), (\d+:\d+)/, '$3-$1-$2 $4');

export default defineConfig({
  define: {
    __BUILD_TIMESTAMP__: JSON.stringify(buildTimestamp),
  },
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
        }) as any
      ]
    }
  }
});
