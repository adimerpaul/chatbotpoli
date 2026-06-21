import { createRouter, createWebHistory } from 'vue-router'
import BandejaView from '@/views/BandejaView.vue'
import LoginView from '@/views/LoginView.vue'

const routes = [
  { path: '/login', name: 'login', component: LoginView, meta: { public: true } },
  { path: '/', redirect: '/bandeja' },
  { path: '/bandeja',  name: 'bandeja',  component: BandejaView },
  { path: '/mapa',     name: 'mapa',     component: () => import('@/views/MapaView.vue') },
  { path: '/stats',    name: 'stats',    component: () => import('@/views/StatsView.vue') },
  { path: '/whatsapp', name: 'whatsapp', component: () => import('@/views/WhatsappView.vue') },
  { path: '/usuarios',    name: 'usuarios',    component: () => import('@/views/UsuariosView.vue') },
  { path: '/conocimiento', name: 'conocimiento', component: () => import('@/views/KnowledgeView.vue') },
  { path: '/reportes',    name: 'reportes',    component: () => import('@/views/ReportesView.vue') }
]

const router = createRouter({ history: createWebHistory(), routes })

router.beforeEach((to) => {
  const token = localStorage.getItem('cac_token')
  if (!to.meta.public && !token) return { name: 'login' }
  if (to.name === 'login' && token) return { name: 'bandeja' }
})

export default router
