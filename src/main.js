import { createApp } from 'vue'
import './styles/main.css'
import './styles/pages/app.css'
import './styles/pages/experiment.css'
import './styles/pages/replay.css'
import './styles/pages/canvas.css'
import './styles/themes.css'
import App from './App.vue'
import { router } from './router.js'

createApp(App).use(router).mount('#app')
