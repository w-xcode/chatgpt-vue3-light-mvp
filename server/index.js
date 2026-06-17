// 读取 .env 文件，把键值对塞到 process.env 里。
// 代码里 process.env.DEEPSEEK_KEY 就能拿到值了。
import 'dotenv/config'
import express from 'express'
import { createProxyMiddleware } from 'http-proxy-middleware'

const app = express()
const PORT = process.env.PROXY_PORT || 3001

// DeepSeek API 代理 — Key 仅存在于服务端环境变量中
app.use(
  "/deepseek",
  createProxyMiddleware({
    target: "https://api.deepseek.com",
    //  修改 Host 头为目标域名
    changeOrigin: true,
    //  去掉 /deepseek 前缀
    pathRewrite: { "^/deepseek": "" },
    on: {
      proxyReq(proxyReq) {
        // 从环境变量读 Key
        const key = process.env.DEEPSEEK_KEY
        if (key) {
          // 注入到请求头 key
          proxyReq.setHeader("Authorization", `Bearer ${key}`)
        }
      },
    },
  }),
)

//监听3001
app.listen(PORT, () => {
  console.log(`[proxy] DeepSeek API proxy running on http://localhost:${PORT}`)
})
