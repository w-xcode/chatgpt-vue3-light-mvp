# 学习计划：AI 情绪对话与数据分析平台

> 基于 [导学-AI情绪对话.md](导学-AI情绪对话.md) 制定的系统学习路线

---

## 第零阶段：前置知识储备

在进入源码之前，需要掌握以下核心概念。

---

### 0.1 Fetch API + ReadableStream（面试高频）

传统 HTTP 请求是"请求-等待-完整响应"模式。但 LLM 输出是逐字生成的，用户不可能等几十秒才看到完整回复。

```js
// 传统方式：等待完整响应
const res = await fetch('/api/chat')
const data = await res.json() // 阻塞，等全部完成

// 流式方式：边读边显示
const res = await fetch('/api/chat')
const reader = res.body.getReader() // 拿到一个"读取器"
while (true) {
  const { done, value } = await reader.read()
  if (done) break
  // value 是 Uint8Array 二进制片段，立即渲染到页面
}
```

**关键点**：`res.body` 是一个 `ReadableStream`，不是普通对象。这就是为什么项目用 `fetch` 而不是 `axios` — axios 不暴露底层流。axios 是"等全部下完再给你"，fetch 的 res.body 是"给你一个水龙头你自己接"。LLM 流式场景必须用水龙头，所以用 fetch。
res 是发送请求后返回的响应对象，res.body 是底层的可读流，没法直接读取，所以需要 getReader() 拿到一个读取器。getReader() 同时会锁定流，防止别人同时读。reader.read() 每次读一块数据，还有数据时返回 { done: false, value: 二进制片段 }，读完时返回 { done: true, value: undefined }。
---

### 0.2 SSE（Server-Sent Events）协议

SSE 是服务端向客户端的单向推送协议。LLM API（如 DeepSeek、OpenAI）返回的不是普通 JSON，而是 SSE 格式的文本流：

```
data: {"choices":[{"delta":{"content":"你"}}]}

data: {"choices":[{"delta":{"content":"好"}}]}

data: [DONE]
```

每行以 `data: ` 开头，空行分隔，每条 data: 之间有空行分隔，这是 SSE 协议的规定（空行表示"上一条结束"）。最后以 `[DONE]` 结束。浏览器原生的 `EventSource` API 不支持自定义 Header（如 Authorization），LLM API 需要 Authorization: Bearer sk-xxx 来验证身份，所以项目直接用 `fetch + ReadableStream` 手动解析。

---

### 0.3 TransformStream + pipeThrough（管道组合）

流的处理像水管一样可以串联：
fetch 请求 LLM 服务器后，返回的 res.body 就是原始二进制流
二进制数据没法直接当文字用，需要先解码成字符串。
第一层管道：TextDecoderStream（二进制 → 字符串）
TextDecoderStream 是浏览器内置的 TransformStream，它把 Uint8Array 转成可读的字符串
splitStream 把黏在一起的字符串按 \n 切开，每次吐出一行。
```
原始二进制流
  → TextDecoderStream（二进制 → 字符串）
  → splitStream（按行切割）
  → 逐行解析
```

```js
const stream = res.body
  .pipeThrough(new TextDecoderStream())  // Uint8Array → string
  .pipeThrough(splitStream('\n'))         // string → 按换行切割的行流
const reader = stream.getReader()
```

`pipeThrough` 的语义：前一个流的输出自动成为下一个流的输入，形成处理管道。

---

### 0.4 Pinia 状态管理

Pinia 是 Vue 3 的官方状态管理库（Vuex 的继任者）。本项目用它管理三类数据：

- **Session Store**：会话列表 CRUD
- **Message Store**：消息生命周期（streaming → completed / failed）
- **Emotion Store**：情绪分析报告

核心模式：`defineStore` 定义，`state` 是响应式数据，`actions` 是修改方法，`getters` 是计算属性。所有 store 数据自动持久化到 `localStorage`。

---

### 0.5 Vue 3 Composition API + `<script setup>`

Vue 3 的组件编写范式，替代了 Vue 2 的 Options API：

```vue
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

// ref 定义响应式数据
const count = ref(0)
// computed 定义计算属性
const doubled = computed(() => count.value * 2)
// 直接写函数，就是方法
function increment() { count.value++ }
// 生命周期钩子
onMounted(() => { console.log('挂载完成') })
</script>
```

`<script setup>` 中所有顶层变量自动暴露给模板，无需 return。

---

### 0.6 AbortController（流中断控制）

用户点击"停止生成"时，需要中断正在进行的 fetch 请求：

```js
const controller = new AbortController()
fetch('/api/chat', { signal: controller.signal })
// 用户点击停止
controller.abort() // 立即中断流
```

项目中 `messageStore` 持有当前活跃的 `AbortController`，停止时调用 `abort()`。

---

### 0.7 Node 代理服务 + Vite 开发代理

项目采用双层代理架构，解决两个问题：**跨域**和 **API Key 安全**。

```
浏览器 → Vite proxy(:2048，解决 CORS) → Node 代理(:3001，注入 Key) → DeepSeek API
```

**第一层 — Vite proxy（解决跨域）**：

开发时前端运行在 `localhost:2048`，API 在远程服务器，存在跨域。Vite 的 `server.proxy` 将请求转发到 Node 代理服务：

```ts
// vite.config.ts
server: {
  proxy: {
    '/deepseek': {
      target: 'http://localhost:3001',
      changeOrigin: true
    }
  }
}
```

**第二层 — Node 代理（注入 API Key）**：

`server/index.js` 使用 Express + http-proxy-middleware，收到请求后自动从 `process.env.DEEPSEEK_KEY` 读取密钥并注入 `Authorization` header，前端代码完全不接触 Key。

```js
// server/index.js 核心逻辑
app.use('/deepseek', createProxyMiddleware({
  target: 'https://api.deepseek.com',
  pathRewrite: { '^/deepseek': '' },
  on: {
    proxyReq(proxyReq) {
      proxyReq.setHeader('Authorization', `Bearer ${process.env.DEEPSEEK_KEY}`)
    }
  }
}))
```

**关键安全设计**：`.env` 中变量名是 `DEEPSEEK_KEY`（无 `VITE_` 前缀），Vite 只打包 `VITE_` 开头的变量到前端 bundle，所以 Key 永远不会出现在浏览器代码中。

---

### 0.8 ECharts 生命周期

Vue 中使用 ECharts 的关键生命周期管理：

```ts
// hooks/useECharts.ts 核心逻辑
onMounted(() => {
  chart = echarts.init(dom)        // 初始化
  chart.setOption(option)           // 设置数据
  window.addEventListener('resize', resizeHandler)
})
onUnmounted(() => {
  chart.dispose()                   // 销毁，释放内存
  window.removeEventListener('resize', resizeHandler)
})
```

图表必须在 DOM 挂载后初始化，离开时必须 `dispose()`，否则内存泄漏。

---

### 0.9 Vue Router 导航守卫

路由跳转前后的钩子，项目用于显示顶部进度条：

```ts
router.beforeEach(() => NProgress.start())  // 跳转前：开始进度条
router.afterEach(() => NProgress.done())    // 跳转后：结束进度条
```

---

### 0.10 markdown-it 插件机制

markdown-it 是 Markdown → HTML 的渲染引擎。项目通过插件扩展了代码高亮（highlight.js）、数学公式（KaTeX）等功能。插件通过修改渲染规则（`renderer.rules`）来拦截特定 token 并输出自定义 HTML。

---

## 第一阶段：Day 1 — SSE 流式管道（项目灵魂）

**目标**：理解一次完整的"用户发送 → 流式响应 → 页面渲染"流程

**阅读顺序**：

| 顺序 | 文件 | 内容 | 预计时间 |
|:---:|------|------|:---:|
| 1 | [chat.d.ts](src/types/chat.d.ts) | 先看类型定义，理解数据结构 | 10min |
| 2 | [MarkdownPreview/models/index.ts](src/components/MarkdownPreview/models/index.ts) | 模型适配器，`chatFetch` 和 `transformStreamValue` 定义 | 15min |
| 3 | [MarkdownPreview/transform/index.ts](src/components/MarkdownPreview/transform/index.ts) | `splitStream` TransformStream 实现 | 10min |
| 4 | [store/business/index.ts](src/store/business/index.ts) | 流式管道编排 `createAssistantWriterStylized` | 20min |
| 5 | [views/chat.vue](src/views/chat.vue) | 串联一切的入口 `handleSend` | 15min |

**核心问题**：从用户点击发送到文字逐字出现，数据经过了哪些环节？每个环节做了什么？

---

## 第二阶段：Day 2 — 三层数据模型 + 状态管理

**目标**：理解 Session / Message / Emotion 三层 Store 如何协作

**阅读顺序**：

| 顺序 | 文件 | 内容 | 预计时间 |
|:---:|------|------|:---:|
| 1 | [store/session/index.ts](src/store/session/index.ts) | 会话管理 | 10min |
| 2 | [store/message/index.ts](src/store/message/index.ts) | 消息生命周期、流中断/恢复 | 20min |
| 3 | [store/emotion/index.ts](src/store/emotion/index.ts) | 情绪分析触发和存储 | 15min |

**核心问题**：三条数据怎么隔离的？页面刷新后状态怎么恢复的？

---

## 第三阶段：Day 3 — 情绪分析 + ECharts 可视化

**目标**：理解 LLM 结构化输出解析和防御性编程

**阅读顺序**：

| 顺序 | 文件 | 内容 | 预计时间 |
|:---:|------|------|:---:|
| 1 | [store/emotion/index.ts](src/store/emotion/index.ts) | `parseAnalysisJson` 三层 JSON 解析回退 + `validateReport` 字段校验 | 20min |
| 2 | [views/dashboard.vue](src/views/dashboard.vue) | 三个 ECharts 图表配置 | 20min |
| 3 | [hooks/useECharts.ts](src/hooks/useECharts.ts) | Composable 封装 | 10min |

**核心问题**：如果 LLM 返回的 JSON 格式不对怎么办？`validateReport` 的 clamp/default/cap 策略是什么？

---

## 第四阶段：Day 4 — 流中断与再生

**目标**：理解 AbortController 如何中断流，以及"重新生成"功能的实现

**阅读顺序**：

| 顺序 | 文件 | 内容 | 预计时间 |
|:---:|------|------|:---:|
| 1 | [store/message/index.ts](src/store/message/index.ts) | `abortStream` 和 `recoverOrphanedMessages` | 15min |
| 2 | [components/ChatInput/index.vue](src/components/ChatInput/index.vue) | 停止按钮逻辑 | 10min |

---

## 知识自检清单

学完后应能回答以下问题：

1. 完整描述一次对话的数据流：用户输入 → 流式响应 → 情绪分析 → 持久化
2. `ReadableStream` 管道中每一层的职责是什么？
3. 为什么用 `fetch` 不用 `axios`？一句话说清楚
4. 三个 Pinia Store 各自管什么？为什么这样分层？
5. `parseAnalysisJson` 的三层回退策略分别是什么？
6. `validateReport` 的 clamp/default/cap 各是什么含义？
7. `AbortController` 在哪些场景被使用？
8. Node 代理服务如何保证 API Key 不泄露？`VITE_` 前缀的安全边界是什么？
9. `localStorage` 的 5MB 限制意味着什么？项目怎么应对？
10. ECharts 的 init/resize/dispose 生命周期为什么要这么管理？

---

## 关键源码速查

| 主题 | 核心文件 | 关键函数/概念 |
|------|---------|-------------|
| 数据类型定义 | [src/types/chat.d.ts](src/types/chat.d.ts) | `Session`, `ChatMessage`, `ApiMessage`, `EmotionReport` |
| 模型适配器 | [src/components/MarkdownPreview/models/index.ts](src/components/MarkdownPreview/models/index.ts) | `chatFetch`, `transformStreamValue` |
| 流解析器 | [src/components/MarkdownPreview/transform/index.ts](src/components/MarkdownPreview/transform/index.ts) | `splitStream` |
| 流式管道 | [src/store/business/index.ts](src/store/business/index.ts) | `createAssistantWriterStylized` |
| 会话管理 | [src/store/session/index.ts](src/store/session/index.ts) | `createSession`, `deleteSession` |
| 消息管理 | [src/store/message/index.ts](src/store/message/index.ts) | `appendToMessage`, `completeMessage`, `abortStream` |
| 情绪分析 | [src/store/emotion/index.ts](src/store/emotion/index.ts) | `analyzeEmotion`, `parseAnalysisJson`, `validateReport` |
| 聊天页面 | [src/views/chat.vue](src/views/chat.vue) | `handleSend` |
| 仪表盘 | [src/views/dashboard.vue](src/views/dashboard.vue) | 趋势图 / 饼图 / 关键词图 |
| ECharts 封装 | [src/hooks/useECharts.ts](src/hooks/useECharts.ts) | `useECharts` |
| 路由配置 | [src/router/child-routes.ts](src/router/child-routes.ts) | `/chat`, `/dashboard` |
| Node 代理服务 | [server/index.js](server/index.js) | Express + http-proxy-middleware, Key 注入 |
| Vite 配置 | [vite.config.ts](vite.config.ts) | proxy → Node 代理, plugins |
| 环境变量 | [.env.template](.env.template) | `DEEPSEEK_KEY`（仅服务端，无 VITE_ 前缀） |
