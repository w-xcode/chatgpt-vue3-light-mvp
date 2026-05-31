# 导学 — AI 情绪对话与数据分析平台

> 项目简称：**AI 情绪对话**
> 技术栈：Vue 3 + Vite + Pinia + Vue Router + ECharts + DeepSeek API + Naive UI
> 定位：前端工程全栈（流式通信 + 状态管理 + 数据可视化）

---

## 一、前置知识（面试高频标注）

| 知识点 | 为何需要 | 在本项目中的位置 | 高频度 |
|--------|----------|------------------|--------|
| SSE（Server-Sent Events）协议 | 理解流式通信是 AI 应用的核心 | `fetch` + `ReadableStream` 解析 DeepSeek API 的 SSE 响应 | **高** |
| TransformStream / ReadableStream | Web Streams API 是实现逐字渲染的基础 | `MarkdownPreview/transform/index.ts` 的 `splitStream` | **高** |
| Pinia 状态管理 | Vue 3 生态标准状态方案 | 四个 store 管理会话/消息/情绪/业务逻辑 | **高** |
| Vue 3 Composition API | `<script setup>` + 组合式函数是当前 Vue 最佳实践 | 所有组件和 hooks 均使用 Composition API | **高** |
| ECharts 数据可视化 | 前端看板必备技能 | `dashboard.vue` 趋势线/饼图/柱状图 | 中 |
| localStorage 持久化 | 前端轻量数据持久化方案 | 三个 store 各自管理一个 localStorage key | 中 |
| Node 代理服务 | API Key 服务端化，前端不接触密钥 | `server/index.js` Express + http-proxy-middleware | **高** |
| Vite 代理配置 | 解决 CORS 跨域，转发到本地 Node 代理 | `vite.config.ts` 的 `server.proxy` | 中 |
| markdown-it 插件机制 | AI 对话项目标配的 Markdown 渲染 | `MarkdownPreview/plugins/` 实现代码高亮、LaTeX、Mermaid | 中 |
| AbortController / reader.cancel() | 流式生成的中断控制 | `messageStore.abortActiveStream()` | 中 |
| JSON 结构化输出兜底 | LLM 输出不稳定的工程化处理 | `emotion/index.ts` 的三重解析 + 字段校验 | 低 |

---

## 二、重点亮点与学习顺序（先看这个）

### 亮点 1：SSE 流式管线（fetch → TransformStream → 逐字渲染）

**为什么重要**：这是 AI 对话类前端的核心技术，面试必问。

**先看哪些文件**：
1. [models/index.ts](src/components/MarkdownPreview/models/index.ts) — `chatFetch` 发起请求、`createStreamThinkTransformer` 解析 delta
2. [transform/index.ts](src/components/MarkdownPreview/transform/index.ts) — `splitStream` TransformStream 处理 SSE/JSON/纯文本三种格式
3. [business/index.ts](src/store/business/index.ts) — `createAssistantWriterStylized` 串联管线
4. [chat.vue](src/views/chat.vue) — `while(true)` 读取循环 + `appendToMessage` 增量写入

**建议学习顺序**：① 先理解 SSE 协议格式 → ② 看 `splitStream` 如何拆行 → ③ 看 `transformStreamValue` 如何提取 delta → ④ 看 chat.vue 的读取循环

### 亮点 2：三层数据模型 + Pinia 按 sessionId 隔离

**为什么重要**：展示你对前端状态架构的设计能力。

**先看哪些文件**：
1. [types/chat.d.ts](src/types/chat.d.ts) — Session / ChatMessage / EmotionReport 类型定义
2. [store/session/index.ts](src/store/session/index.ts) — 会话 CRUD + localStorage 持久化
3. [store/message/index.ts](src/store/message/index.ts) — `messagesBySession` 按 sessionId 隔离 + 流式状态管理
4. [store/emotion/index.ts](src/store/emotion/index.ts) — 情绪报告存储 + 二次 LLM 调用

**建议学习顺序**：① 先看类型定义理解数据关系 → ② 看 session store 的 CRUD → ③ 看 message store 的流式状态机 → ④ 看 emotion store 的分析流程

### 亮点 3：LLM 结构化输出的工程化兜底

**为什么重要**：LLM 输出不稳定是实际工程中的核心痛点，能讲清楚兜底策略体现工程成熟度。

**先看哪些文件**：
1. [store/emotion/index.ts](src/store/emotion/index.ts) — `ANALYSIS_PROMPT` + `parseAnalysisJson`（三重解析）+ `validateReport`（字段校验）

**建议学习顺序**：① 先看 prompt 设计 → ② 看三重解析策略（直接 parse → markdown fence → 正则）→ ③ 看字段校验的 clamp/截断/默认值逻辑

### 亮点 4：流式中断与恢复机制

**为什么重要**：用户主动停止生成是 AI 对话的必备功能，涉及 reader 生命周期管理。

**先看哪些文件**：
1. [store/message/index.ts](src/store/message/index.ts) — `abortActiveStream` + `recoverIncompleteMessages`
2. [models/index.ts](src/components/MarkdownPreview/models/index.ts) — `triggerModelTermination` 重置解析器状态

### 亮点 5：ECharts 响应式看板

**为什么重要**：数据可视化是前端加分项，展示 watch + composable 的组合使用。

**先看哪些文件**：
1. [hooks/useECharts.ts](src/hooks/useECharts.ts) — 通用 ECharts composable（懒初始化 + resize + dispose）
2. [views/dashboard.vue](src/views/dashboard.vue) — 趋势线 / 饼图 / 柱状图的 option 配置

---

## 三、必备知识点

- [ ] SSE 协议格式（`data: ` 前缀、`[DONE]` 终止符、keep-alive）
- [ ] Web Streams API：ReadableStream / TransformStream / pipeThrough / getReader
- [ ] fetch 的 `stream: true` 与 Response.body 的 ReadableStream
- [ ] Pinia 的 state / getters / actions 模式，以及 `$subscribe` / `$onAction`
- [ ] Vue 3 `<script setup>` + `defineProps` + `defineEmits`
- [ ] ECharts 的 setOption / resize / dispose 生命周期
- [ ] localStorage 的 JSON.parse / JSON.stringify 持久化模式
- [ ] Express + http-proxy-middleware 代理服务（target / pathRewrite / proxyReq header 注入）
- [ ] Vite 的 `server.proxy` 配置（转发到本地代理而非直连 API）
- [ ] dotenv 加载机制与 VITE_ 前缀的安全边界
- [ ] markdown-it 的插件扩展机制
- [ ] AbortController 与 reader.cancel() 的使用时机

---

## 四、推荐阅读（结合仓库）

| 主题 | 建议阅读位置 | 预计时间 | 读完能回答什么 |
|------|-------------|----------|---------------|
| SSE 流式管线全链路 | [models/index.ts](src/components/MarkdownPreview/models/index.ts) → [transform/index.ts](src/components/MarkdownPreview/transform/index.ts) → [business/index.ts](src/store/business/index.ts) → [chat.vue](src/views/chat.vue) | 40 min | "fetch 如何解析 SSE？delta token 如何逐字写入？" |
| 三层数据模型设计 | [types/chat.d.ts](src/types/chat.d.ts) → [store/session/](src/store/session/) → [store/message/](src/store/message/) → [store/emotion/](src/store/emotion/) | 30 min | "Session / Message / EmotionReport 之间什么关系？状态如何隔离？" |
| LLM 输出兜底策略 | [store/emotion/index.ts](src/store/emotion/index.ts) | 20 min | "LLM 返回格式不稳定怎么办？三重解析和字段校验怎么做？" |
| 流式中断与恢复 | [store/message/index.ts](src/store/message/index.ts) | 15 min | "用户点停止时发生了什么？页面刷新后未完成的消息怎么处理？" |
| ECharts 看板实现 | [hooks/useECharts.ts](src/hooks/useECharts.ts) → [views/dashboard.vue](src/views/dashboard.vue) | 20 min | "ECharts 如何封装为 composable？数据变化如何驱动图表更新？" |
| Node 代理与安全 | [server/index.js](server/index.js) → [vite.config.ts](vite.config.ts) | 15 min | "API Key 如何做到前端完全不接触？Vite proxy 和 Node 代理怎么配合？" |
| Markdown 渲染管线 | [plugins/markdown.ts](src/components/MarkdownPreview/plugins/markdown.ts) → [plugins/highlight.ts](src/components/MarkdownPreview/plugins/highlight.ts) → [plugins/preWrapper.ts](src/components/MarkdownPreview/plugins/preWrapper.ts) | 20 min | "代码高亮、LaTeX、Mermaid 如何集成？" |

---

## 五、自学提醒

本文档提供学习路径与面试题目，**不提供逐行代码讲解**。如果你在阅读某个文件或某个原理时感到困惑，请直接追问 AI，我会针对性地解释具体实现细节。建议带着"这个函数为什么这样写"的问题去读源码，而不是通读全文。

---

## 六、项目技术定位

**前端**，具备全栈特征（Node 代理服务 + 前端 SPA）。

依据：前端 SPA 架构 + 独立 Node 代理服务处理 API Key 安全；Vite 开发服务器代理解决 CORS 跨域问题；数据持久化使用 localStorage；部署目标为 GitHub Pages（hash 路由模式），生产环境可复用同一代理架构。

---

## 七、核心原理解析

### 1. SSE 流式响应解析

**问题**：DeepSeek API 返回 SSE 格式的流式响应，前端需要逐 token 渲染。

**机制**：`fetch` 返回的 `Response.body` 是一个 `ReadableStream`，通过 `pipeThrough(new TextDecoderStream())` 将二进制转为文本，再通过自定义 `splitStream` TransformStream 按换行拆分，最后由模型特定的 `transformStreamValue` 提取 `delta.content`。

**落点**：`models/index.ts` 的 `createStreamThinkTransformer` 同时处理 `content` 和 `reasoning_content`（思考过程），用 `<think>` 标签包裹推理内容。

### 2. 按 sessionId 隔离的状态管理

**问题**：多会话场景下，消息和情绪报告需要按会话隔离，切换会话时不能互相污染。

**机制**：`messagesBySession: Record<string, ChatMessage[]>` 和 `reportsBySession: Record<string, EmotionReport[]>` 使用 sessionId 作为一级 key，getter 通过 `activeSessionId` 派生当前视图数据。

**落点**：`messageStore.currentMessages` getter 自动跟随 `sessionStore.activeSessionId` 变化，实现响应式切换。

### 3. 流式状态机

**问题**：消息有 streaming / completed / failed 三种状态，需要正确管理状态转换。

**机制**：`addAssistantMessage` 设置 `status: 'streaming'`，`completeMessage` 设置 `'completed'`，`failMessage` 或 `abortActiveStream` 设置 `'failed'`。`recoverIncompleteMessages` 在页面加载时将残留的 streaming 状态重置为 failed。

**落点**：`store/message/index.ts` 中 `activeReader` / `activeStreamingMessageId` / `isStreaming` 三个状态变量协同工作。

### 4. LLM 结构化输出的工程化处理

**问题**：LLM 不一定返回合法 JSON，可能包含 markdown 代码块、多余文本、或字段缺失。

**机制**：三重解析策略（直接 JSON.parse → 提取 markdown fence 内容 → 正则匹配 `{...}`），然后 `validateReport` 对每个字段做 clamp / 截断 / 默认值兜底。

**落点**：`store/emotion/index.ts` 的 `parseAnalysisJson` + `validateReport`。

### 5. ECharts Composable 封装

**问题**：多个图表需要统一的初始化、resize、销毁逻辑。

**机制**：`useECharts` 接收一个 ref 容器，懒初始化 `echarts.init`，监听 `window.resize`，在 `onUnmounted` 时 dispose。返回 `setOption` 方法供外部调用。

**落点**：`hooks/useECharts.ts`，被 `dashboard.vue` 中三个图表复用。

---

## 八、关键设计决策

### 决策 1：fetch vs axios 做流式请求

| 方案 | 优点 | 缺点 |
|------|------|------|
| **fetch（采用）** | 原生支持 ReadableStream，无需额外依赖 | 错误处理不如 axios 便捷 |
| axios | 拦截器丰富，错误处理统一 | 不原生支持流式读取，需要 adapter |

**取舍**：流式场景必须用 fetch，普通 API 请求用 axios（`utils/request.ts`）。两种 HTTP 客户端并存。

### 决策 2：Node 代理 + Vite proxy 双层架构

| 方案 | 优点 | 缺点 |
|------|------|------|
| **Node 代理 + Vite proxy（采用）** | API Key 完全服务端化，开发/生产架构统一 | 多一个进程需要管理 |
| 仅 Vite proxy | 零额外代码 | Key 打包进前端 bundle，仅限开发环境 |
| 独立 Node 后端 serve 静态文件 | 单进程部署 | 开发时失去 Vite HMR 能力 |

**取舍**：用 Express + http-proxy-middleware 做独立代理服务，Vite proxy 转发到本地代理。开发和生产环境代理代码一致，前端永远不接触 API Key。

### 决策 3：情绪分析的 fire-and-forget 调用

| 方案 | 优点 | 缺点 |
|------|------|------|
| **fire-and-forget（采用）** | 不阻塞对话流程，用户体验好 | 分析失败静默丢弃，用户无感知 |
| 阻塞等待 | 可靠性高，失败可重试 | 对话结束要等分析完成才能继续 |

**取舍**：情绪分析是辅助功能，不应阻塞主对话。失败时 `.catch(() => {})` 静默处理。

**风险**：用户快速连续发送消息时，多个分析请求可能并发，需要考虑是否需要队列化。

### 决策 4：localStorage vs IndexedDB

| 方案 | 优点 | 缺点 |
|------|------|------|
| **localStorage（采用）** | API 简单，同步读写 | 5MB 限制，大量消息会超限 |
| IndexedDB | 容量大，异步性能好 | API 复杂，需要封装 |

**取舍**：MVP 阶段数据量小，localStorage 够用。数据量增长后需要迁移到 IndexedDB。

---

## 九、量化与验证（含待测）

> 以下为建议测量思路，标注（待测）的数据需要实际运行获取。

| 指标 | 测量方法 | 工具 | 备注 |
|------|----------|------|------|
| 首次 token 延迟（TTFT） | 记录 fetch 发起到首次 appendToMessage 的时间差 | Performance API / console.time | 与网络和模型推理速度相关 |
| 流式渲染帧率 | 监测 appendToMessage 频率与浏览器 repaint | Chrome DevTools Performance | 高频 token 可能导致 jank |
| localStorage 写入性能 | 测量 persistToStorage 耗时随数据量变化 | console.time | 超过 1000 条消息时可能明显卡顿 |
| 情绪分析 JSON 解析成功率 | 统计三重解析各层的命中比例 | 埋点统计 | （待测）可验证兜底策略的有效性 |
| ECharts 渲染性能 | 大量数据点（>500）时的 setOption 耗时 | ECharts bindbindbindbindbindbindbindbindbindbindbindbindbindbindEvents | （待测）关键词聚合在数据量大时可能变慢 |
| 页面加载体积 | `vite build` 后分析 bundle 大小 | `npx vite-bundle-visualizer` | ECharts 体积较大，可考虑按需引入 |

**怎么测**：
- TTFT：在 `chat.vue` 的 fetch 调用前后各打一个 `performance.mark`，在 `appendToMessage` 首次调用时再打一个，用 `performance.measure` 计算差值
- localStorage：用 `performance.now()` 包裹 `persistToStorage` 调用，记录 100 / 500 / 1000 条消息下的耗时
- 解析成功率：在 `parseAnalysisJson` 中为每个分支加计数器，输出到 console
