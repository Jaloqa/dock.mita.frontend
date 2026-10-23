const noReferrer = { headers: { 'Referrer-Policy': 'no-referrer' } }

export default defineNuxtConfig({
  compatibilityDate: '2026-10-01',
  devtools: { enabled: true },
  builder: 'rspack',

  modules: ['@nuxtjs/i18n', '@primevue/nuxt-module'],

  css: ['~/assets/css/main.css', 'primeicons/primeicons.css'],

  postcss: {
    plugins: {
      '@tailwindcss/postcss': {},
    },
  },

  app: {
    head: {
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap',
        },
      ],
    },
  },

  components: [
    { path: '~/shared/components', pathPrefix: false },
    { path: '~/features', pattern: '*/components/**/*.vue', pathPrefix: false },
  ],

  imports: {
    dirs: ['shared/composables', 'shared/utils', 'features/*/composables'],
  },

  runtimeConfig: {
    apiProxyTarget: '',
    public: {
      apiMocks: false,
      i18n: {
        baseUrl: 'http://localhost:3000',
      },
    },
  },

  routeRules: {
    '/g/**': noReferrer,
    '/pl/g/**': noReferrer,
    '/ru/g/**': noReferrer,
    '/uk/g/**': noReferrer,
  },

  primevue: {
    importTheme: { from: '~/theme/mita-preset.ts' },
    components: { exclude: ['Form', 'FormField', 'Editor'] },
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

  typescript: {
    strict: true,
  },
})
