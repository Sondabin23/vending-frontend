import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // 프론트엔드에서 '/api'로 요청을 보내면 백엔드(3000번 포트)로 전달합니다.
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      }
    }
  }
})