/**
 * Github 演示部署环境（使用 hash 路由模式）
 */
export const isGithubDeployed = process.env.VITE_ROUTER_MODE === 'hash'

