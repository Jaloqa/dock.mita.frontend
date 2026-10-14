export default defineNuxtConfig({
  compatibilityDate: '2026-10-01',
  devtools: { enabled: true },

  modules: ['@nuxt/ui', '@nuxt/eslint', '@nuxtjs/i18n', '@pinia/nuxt', '@nuxt/test-utils/module'],

  css: ['~/assets/css/main.css'],

  components: [
    { path: '~/shared/components', pathPrefix: false },
    { path: '~/features', pattern: '*/components/**/*.vue', pathPrefix: false },
  ],

  imports: {
    dirs: ['shared/composables', 'shared/utils', 'features/*/composables'],
  },

  runtimeConfig: {
    public: {
      apiBaseUrl: 'http://localhost:8080',
      apiMocks: true,
      i18n: {
        baseUrl: 'http://localhost:3000',
      },
    },
  },

  colorMode: {
    preference: 'system',
    fallback: 'light',
    storageKey: 'mita-color-mode',
  },

  i18n: {
    defaultLocale: 'en',
    strategy: 'prefix_except_default',
    locales: [
      { code: 'en', language: 'en-US', name: 'English', file: 'en.json' },
      { code: 'pl', language: 'pl-PL', name: 'Polski', file: 'pl.json' },
      { code: 'ru', language: 'ru-RU', name: 'Русский', file: 'ru.json' },
      { code: 'uk', language: 'uk-UA', name: 'Українська', file: 'uk.json' },
    ],
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'mita-locale',
      redirectOn: 'root',
    },
  },

  eslint: {
    config: {
      stylistic: false,
    },
  },

  typescript: {
    strict: true,
  },
})
