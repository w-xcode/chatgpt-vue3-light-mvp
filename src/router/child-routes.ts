const LayoutDefault = () => import('@/components/Layout/default.vue')

const childrenRoutes: Array<RouteRecordRaw> = [
  {
    path: '/chat',
    component: LayoutDefault,
    name: 'ChatRoot',
    redirect: {
      name: 'ChatIndex'
    },
    children: [
      {
        path: '',
        name: 'ChatIndex',
        component: () => import('@/views/chat.vue')
      }
    ]
  },
  {
    path: '/dashboard',
    component: LayoutDefault,
    name: 'DashboardRoot',
    children: [
      {
        path: '',
        name: 'Dashboard',
        component: () => import('@/views/dashboard.vue')
      }
    ]
  }
]

export default childrenRoutes
