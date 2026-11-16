import { createRouter, createWebHistory } from 'vue-router'
import ExperimentPage from './pages/ExperimentPage.vue'

const ReplayPage = () => import('./pages/ReplayPage.vue')

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'experiment', component: ExperimentPage },
    { path: '/field', name: 'field', component: ExperimentPage, props: { mode: 'field' } },
    { path: '/replay', name: 'replay', component: ReplayPage },
  ],
})
