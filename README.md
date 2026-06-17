# AI 情绪对话助手

基于 Vue3 + Vite + TypeScript 构建的 AI 对话应用，集成 DeepSeek 大模型，支持**多轮对话**和**情绪分析**，并提供可视化情绪看板。

## ✨ 功能特性

- 💬 **多轮对话** — 支持上下文连续对话，AI 能记住之前的聊天内容
- 🧠 **情绪分析** — 每轮对话后自动分析情绪，生成情绪标签、评分和建议
- 📊 **情绪看板** — ECharts 可视化展示情绪趋势、情绪分布、关键词排行
- 📝 **Markdown 渲染** — 支持代码高亮、数学公式、Mermaid 图表
- 🔐 **API Key 安全** — 通过服务端代理转发请求，Key 不暴露在前端
- 🎨 **现代 UI** — Naive UI + UnoCSS，支持亮色/暗色主题切换
- 💾 **本地存储** — 对话记录和情绪数据保存在浏览器本地

## 🛠️ 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Vue 3 + TypeScript |
| 构建 | Vite |
| 状态管理 | Pinia |
| UI 组件 | Naive UI |
| 原子化 CSS | UnoCSS |
| 图表 | ECharts |
| Markdown | markdown-it + highlight.js |
| AI 模型 | DeepSeek (V3/R1) |
| 服务端代理 | Express + http-proxy-middleware |

## 📦 安装与运行

### 环境要求

- Node >= 22.12.x
- pnpm >= 10.x

### 1. 安装依赖

```bash
pnpm i
```

### 2. 配置 API Key

复制环境变量模板并填入你的 DeepSeek API Key：

```bash
cp .env.template .env
```

编辑 `.env` 文件：

```sh
DEEPSEEK_KEY=sk-你的DeepSeek_API_Key
```

> API Key 仅存在于服务端，不会打包到前端代码中。

### 3. 启动项目

```bash
pnpm dev
```

启动后访问 `http://localhost:2048`，同时服务端代理运行在 `http://localhost:3001`。

## 📁 项目结构

```
├── server/              # 服务端代理（Express）
│   └── index.js         # DeepSeek API 代理，注入 API Key
├── src/
│   ├── components/      # 组件
│   │   ├── ChatInput/       # 输入框
│   │   ├── ChatMessage/     # 消息气泡
│   │   ├── ChatMessageList/ # 消息列表
│   │   ├── EmotionReport/   # 情绪报告卡片
│   │   ├── SessionList/     # 会话列表
│   │   └── MarkdownPreview/ # Markdown 渲染
│   ├── views/
│   │   ├── chat.vue         # 对话页面
│   │   └── dashboard.vue    # 情绪看板页面
│   ├── store/           # Pinia 状态管理
│   │   ├── business/        # 模型 & API 调用
│   │   ├── emotion/         # 情绪分析数据
│   │   ├── message/         # 消息管理
│   │   └── session/         # 会话管理
│   └── config/          # 配置
├── .env.template        # 环境变量模板
├── vite.config.ts       # Vite 配置（含代理）
└── package.json
```

## 🔑 API Key 获取方式

1. 访问 [DeepSeek 开放平台](https://platform.deepseek.com/usage) 注册账号
2. 进入 [API Key 管理](https://platform.deepseek.com/api_keys) 创建密钥
3. 将密钥填入 `.env` 文件的 `DEEPSEEK_KEY` 字段

## License

[MIT](./LICENSE)
