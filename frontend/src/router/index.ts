import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { public: true },
    },
    {
      path: '/',
      component: () => import('@/components/layout/AppLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'dashboard',
          component: () => import('@/views/DashboardView.vue'),
        },
        {
          path: 'employees',
          name: 'employees',
          component: () => import('@/views/EmployeeListView.vue'),
        },
        {
          path: 'employees/new',
          name: 'employee-new',
          component: () => import('@/views/EmployeeDetailView.vue'),
          props: { mode: 'create' },
        },
        {
          path: 'employees/:id',
          name: 'employee-detail',
          component: () => import('@/views/EmployeeDetailView.vue'),
          props: (route) => ({ id: route.params.id, mode: 'view' }),
        },
        {
          path: 'employees/:id/edit',
          name: 'employee-edit',
          component: () => import('@/views/EmployeeDetailView.vue'),
          props: (route) => ({ id: route.params.id, mode: 'edit' }),
        },
        {
          path: 'leaves',
          name: 'leaves',
          component: () => import('@/views/LeaveManagementView.vue'),
        },
      ],
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  // 初期化が完了するまで待機
  if (auth.initializing) {
    await auth.initialize()
  }

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (to.name === 'login' && auth.isAuthenticated) {
    return { name: 'dashboard' }
  }
})

export default router
