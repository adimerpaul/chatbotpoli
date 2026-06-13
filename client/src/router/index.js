import { createRouter, createWebHistory } from 'vue-router'
import BandejaView from '@/views/BandejaView.vue'

const routes = [
  { path: '/', redirect: '/bandeja' },
  { path: '/bandeja', name: 'bandeja', component: BandejaView },
  { path: '/mapa',    name: 'mapa',    component: () => import('@/views/MapaView.vue') },
  { path: '/stats',   name: 'stats',   component: () => import('@/views/StatsView.vue') },
  { path: '/whatsapp',name: 'whatsapp',component: () => import('@/views/WhatsappView.vue') }
]

export default createRouter({ history: createWebHistory(), routes })
