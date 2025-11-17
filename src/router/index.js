const routes = [
  // 根路径重定向到登录页面
  {
    path: '/',
    redirect: '/login'
  },
  // 认证相关路由（不需要登录）
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('../views/Register.vue'),
    meta: { requiresAuth: false }
  },
  // 需要认证的业务路由
  {
    path: '/maxcut',
    name: 'MaxCut',
    component: () => import('../views/MaxCut.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/number',
    name: 'Number',
    component: () => import('../views/Number.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/coloring',
    name: 'Coloring',
    component: () => import('../views/Coloring.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/tsp',
    name: 'TSP',
    component: () => import('../views/TSP.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/tasks',
    name: 'Tasks',
    component: () => import('../views/Tasks.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('../views/Settings.vue'),
    meta: { requiresAuth: true }
  }
]

export default routes 