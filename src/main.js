import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router.js'
import { bootstrap } from './store.js'
import './style.css'

await bootstrap()

createApp(App).use(router).mount('#app')
