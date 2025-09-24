const routes = [
  {
    path: '/',
    redirect: '/maxcut'
  },
  {
    path: '/maxcut',
    name: 'MaxCut',
    component: () => import('../views/MaxCut.vue')
  },
  {
    path: '/number',
    name: 'Number',
    component: () => import('../views/Number.vue')
  },
  {
    path: '/coloring',
    name: 'Coloring',
    component: () => import('../views/Coloring.vue')
  },
  {
    path: '/tsp',
    name: 'TSP',
    component: () => import('../views/TSP.vue')
  },
  {
    path: '/tasks',
    name: 'Tasks',
    component: () => import('../views/Tasks.vue')
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('../views/Settings.vue')
  }
]

export default routes 