// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  ssr: false,
  devtools: { enabled: false },
  css: ['~/assets/css/main.css'],
  app: {
    baseURL: '/',
    buildAssetsDir: 'assets/',
  },
  router: {
    options: {
      hashMode: true,
    },
  },
  nitro: {
    preset: 'static',
    prerender: {
      routes: ['/'],
    },
  },
})
