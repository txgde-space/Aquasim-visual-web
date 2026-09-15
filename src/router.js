import { createRouter, createWebHistory } from 'vue-router'
import ExperimentPage from './pages/ExperimentPage.vue'

const ReplayPage = () => import('./pages/ReplayPage.vue')

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'experiment', component: ExperimentPage },
    { path: '/replay', name: 'replay', component: ReplayPage },
  ],
})
