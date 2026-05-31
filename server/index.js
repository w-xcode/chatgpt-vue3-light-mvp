import 'dotenv/config'
import express from 'express'
import { createProxyMiddleware } from 'http-proxy-middleware'

const app = express()
const PORT = process.env.PROXY_PORT || 3001

// DeepSeek API 代理 — Key 仅存在于服务端环境变量中
app.use(
  '/deepseek',
  createProxyMiddleware({
    target: 'https://api.deepseek.com',
    changeOrigin: true,
    pathRewrite: { '^/deepseek': '' },
    on: {
      proxyReq(proxyReq) {
        const key = process.env.DEEPSEEK_KEY
        if (key) {
          proxyReq.setHeader('Authorization', `Bearer ${key}`)
        }
      }
    }
  })
)

app.listen(PORT, () => {
  console.log(`[proxy] DeepSeek API proxy running on http://localhost:${PORT}`)
})
