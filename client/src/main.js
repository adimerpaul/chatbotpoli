import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router/index.js'
import { initApi } from './lib/api.js'
import './assets/main.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)
initApi(router)
app.mount('#app')
