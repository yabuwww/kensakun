import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  // publicDirを'public'に指定
  publicDir: 'public', 
  build: {
    outDir: 'dist',
  },
})
