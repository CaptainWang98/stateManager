import { createApp } from 'vue'
import App from './App.vue'

import { VueQueryPlugin } from "../../../src/vueQueryPlugin"

createApp(App).use(VueQueryPlugin).mount('#app')
