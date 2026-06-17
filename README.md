# AI 情绪对话助手

基于 [chatgpt-vue3-light-mvp](https://github.com/pdsuwwz/chatgpt-vue3-light-mvp) 二次开发，在原项目基础上新增了**多轮对话**和**AI 情绪分析**两大核心功能，并增加了服务端代理保障 API Key 安全。

## 🆕 相比原项目的改进

### 1. 多轮对话（原项目仅支持单轮）

原项目采用单轮对话模式，每次提问独立响应，不保留上下文。本项目实现了完整的多轮对话能力：

**会话管理**
- 支持创建、切换、删除、重命名多个会话
- 每个会话独立保存消息历史，刷新页面不丢失
- 自动生成会话标题（取首条消息前 30 字符）
- 会话按最近更新时间自动排序

**上下文传递**
- 将当前会话的完整历史消息（`user` + `assistant`）传递给 API
- AI 能理解上下文，实现连续对话
- 仅传递 `completed` 和 `streaming` 状态的消息，过滤失败消息

**流式输出控制**
- 支持中途停止生成（`AbortController`）
- 页面刷新后自动恢复未完成消息的状态（标记为 `failed`）
- 流式输出过程中实时追加内容，逐字显示

**消息状态机**
```
streaming → completed（正常完成）
streaming → failed（请求失败 / 用户取消 / 页面刷新）
```

### 2. AI 情绪分析（全新功能）

每轮 AI 回复完成后，自动调用大模型对回复内容进行情绪分析，生成结构化报告。

**分析维度**

| 维度 | 说明 | 示例 |
|------|------|------|
| 情绪标签 | 1-5 个中文情绪标签 | 开心、焦虑、平静、压力 |
| 情绪评分 | 0-10 分，0 最平静，10 最强烈 | 7.5 |
| 风险等级 | low / medium / high | low（正常）、high（需干预） |
| 关键词 | 从对话中提取的 1-5 个情绪关键词 | 疲惫、期待、迷茫 |
| 建议 | 1-3 条改善情绪的建议 | 建议适当休息 |

**实现原理**
- 每次 AI 回复完成后，自动触发情绪分析请求（fire-and-forget，不阻塞主流程）
- 使用结构化 Prompt 指示模型返回 JSON 格式的分析结果
- 做了多层 JSON 解析容错（直接解析 → 提取代码块 → 正则匹配花括号）
- 分析结果持久化到 localStorage，按会话维度存储

**可视化看板（ECharts）**

进入「情绪看板」页面，可查看三个图表：

- **情绪趋势折线图** — 展示每次对话的情绪评分变化趋势
- **情绪分布饼图** — 统计各情绪标签出现的频率占比
- **关键词排行条形图** — Top 10 高频情绪关键词

同时展示最新的情绪分析报告卡片，包含评分、标签、关键词和建议。

### 3. 服务端代理（原项目纯前端）

原项目通过 Vite 代理转发 API 请求，API Key 配置在前端环境变量中。本项目新增 Express 服务端代理：

- API Key 仅存在于服务端 `.env`，不会打包到前端
- 前端请求 `/deepseek/*`，服务端自动注入 `Authorization` 头并转发
- 前端和代理服务通过 `pnpm dev` 一键同时启动

## ✨ 功能特性

- 💬 **多轮对话** — 支持上下文连续对话，AI 能记住之前的聊天内容
- 🧠 **情绪分析** — 每轮对话后自动分析情绪，生成标签、评分和建议
- 📊 **情绪看板** — ECharts 可视化展示情绪趋势、分布和关键词排行
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
│   │   ├── message/         # 消息管理（多轮对话核心）
│   │   └── session/         # 会话管理
│   └── config/          # 配置
├── .env.template        # 环境变量模板
├── vite.config.ts       # Vite 配置
└── package.json
```

## 🔑 API Key 获取方式

1. 访问 [DeepSeek 开放平台](https://platform.deepseek.com/usage) 注册账号
2. 进入 [API Key 管理](https://platform.deepseek.com/api_keys) 创建密钥
3. 将密钥填入 `.env` 文件的 `DEEPSEEK_KEY` 字段

## 致谢

感谢 [pdsuwwz/chatgpt-vue3-light-mvp](https://github.com/pdsuwwz/chatgpt-vue3-light-mvp) 提供的优秀基础模板。

## License

[MIT](./LICENSE)
