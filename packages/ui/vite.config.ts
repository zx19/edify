import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite-plus'
import { playwright } from 'vite-plus/test/browser-playwright'

const isCI = !!process.env.CI

export default defineConfig({
  plugins: [react()],
  test: {
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
      headless: true,
      screenshotDirectory: './.vitest-browser/screenshots',
      screenshotFailures: true,
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/__tests__/**'],
      reporter: isCI ? ['json', 'json-summary'] : ['text', 'json', 'json-summary'],
    },
    projects: [
      {
        extends: true,
        plugins: [tailwindcss()],
        test: {
          name: 'unit',
          globals: true,
          setupFiles: ['./vitest.setup.ts'],
          include: ['src/**/__tests__/**/*.spec.{ts,tsx}'],
        },
      },
    ],
  },
})
