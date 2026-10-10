import { createRouter, createWebHistory } from 'vue-router'
import { auth } from './store.js'

const routes = [
  { path: '/auth', alias: '/login', name: 'auth', component: () => import('./views/AuthView.vue'), meta: { public: true } },
  { path: '/', name: 'feed', component: () => import('./views/FeedView.vue') },
  { path: '/explore', name: 'explore', component: () => import('./views/ExploreView.vue') },
  { path: '/me', name: 'me', component: () => import('./views/ProfileView.vue') },
  { path: '/u/:id', name: 'user', component: () => import('./views/ProfileView.vue') },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach((to) => {
  if (!to.meta.public && !auth.token) return { name: 'auth', query: { next: to.fullPath } }
  if (to.name === 'auth' && auth.token) return { name: 'feed' }
  return true
})
