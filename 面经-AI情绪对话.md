# 面经 — AI 情绪对话与数据分析平台

> 项目简称：**AI 情绪对话**
> 技术栈：Vue 3 + Vite + Pinia + Vue Router + ECharts + DeepSeek API（V3/R1）+ Naive UI

---

## 1. 项目简介（简历可用）

基于 Vue 3 + Pinia + ECharts 开发的 AI 情绪对话平台，通过原生 Fetch + ReadableStream 解析 DeepSeek API 的 SSE 流式响应实现逐字渲染，支持结构化情绪分析、历史会话管理和数据可视化看板。

---

## 2. 简历 bullet（6 条）

- 基于 Fetch API + ReadableStream + TransformStream 构建三层流式管道，解析 DeepSeek API 的 SSE 格式响应，实现逐字渲染和流式中断
- 设计 Session / Message / EmotionReport 三层数据模型，使用 Pinia 按 sessionId 隔离状态并持久化至 localStorage，支撑多会话并发场景
- 实现 LLM 结构化 JSON 输出的三层降级解析（直接解析 → markdown fence 提取 → brace matching），配合 clamp/default/cap 校验策略确保情绪报告字段完整
- 通过 Node 本地代理（Express + http-proxy-middleware）转发 DeepSeek API 请求，将 API Key 保存在服务端环境变量中，前端不接触任何密钥
- 基于 ECharts 封装 useECharts Composable，搭建情绪趋势折线图、情感分布饼图、关键词排行柱状图三类数据看板
- 实现 AbortController 流式中断 + 启动时 recoverIncompleteMessages 状态恢复，保障异常场景下的用户体验

---

## 3. 面试题（21 道，按频率从高到低）

### 主题一：SSE 流式传输与 Streams API（5 题）

**Q1：你这个项目的 AI 对话流式输出是怎么实现的？为什么用 fetch 而不是 axios？**

我这个项目的流式输出核心是基于浏览器原生的 Fetch API 配合 ReadableStream 来实现的。当用户发送消息的时候，我调用每个模型适配器的 chatFetch 方法，它内部用 `fetch(url, { ...options, stream: true })` 发起请求，拿到的 response.body 就是一个 ReadableStream。然后我通过管道链把它串起来：先经过 TextDecoderStream 把二进制 Uint8Array 解码成字符串，再经过我自己写的 splitStream TransformStream 按换行符分割成独立的行，最后用 getReader() 拿到 reader，通过 while 循环不断调用 reader.read() 来逐块读取数据。每读到一块，就调用模型的 transformStreamValue 方法解析出文本内容，然后增量追加到 Pinia store 里的 assistant 消息上，Vue 的响应式系统会自动触发视图更新，用户就看到了逐字渲染的效果。选择 fetch 而不是 axios 的原因很直接：axios 的 response 是整体返回的，它底层基于 XMLHttpRequest，不支持流式读取 response body。虽然 axios 支持 onDownloadProgress 回调，但那只能拿到已下载的字节数，拿不到具体的文本内容。而 fetch 返回的 response.body 原生就是 ReadableStream，可以直接 pipeThrough 管道处理，这是 SSE 流式场景下的唯一选择。

**追问 1-1：TransformStream 和 pipeThrough 具体是怎么工作的？能不能详细说说 splitStream 的实现？**

TransformStream 是浏览器 Streams API 提供的一个可组合的流处理单元，它有一个 transform 方法，每收到一块输入数据就可以输出零到多块处理后的数据。pipeThrough 的作用就是把多个流串联起来，前一个流的输出自动成为下一个流的输入。我项目里的 splitStream 是一个自定义的 TransformStream，它的核心逻辑是：收到一块文本后，先和上次剩余的 chunk 拼接，然后按换行符 `\n` 分割。分割后，最后一段可能不完整（因为一个 SSE 事件可能跨多个 chunk），所以把它存起来等待下一次拼接。前面完整的行则通过 controller.enqueue 逐行输出。这个设计还有一个细节：它能处理三种格式 —— SSE 格式（以 `data: ` 开头的行）、JSON 格式（Ollama 返回的纯 JSON 对象）和纯文本格式，通过检测行的前缀来自动选择处理策略。这样就把"二进制解码"、"按行分割"、"格式识别"三个关注点完全解耦了。

**追问 1-2：SSE 协议的具体格式是什么？`data: [DONE]` 是什么意思？**

SSE 协议是基于 HTTP 的文本协议，服务端通过长连接持续推送事件。每个事件由一个或多个字段组成，字段格式是 `field: value\n`，事件之间用空行 `\n\n` 分隔。最常用的字段是 `data`，就是实际传输的数据。在 OpenAI 兼容的 API 中，每个 SSE 事件的 `data` 字段包含一个 JSON 对象，结构是 `{ choices: [{ delta: { content: "token" } }] }`，其中 `delta.content` 就是本次推送的文本片段。`data: [DONE]` 是一个特殊的终止信号，表示服务端已经推送完了所有内容，客户端应该关闭连接。在我的代码里，transformStreamValue 方法检测到 `data: [DONE]` 后会返回 `{ done: true }`，chat.vue 的读取循环收到这个信号后 break 退出 while 循环，然后调用 completeMessage 把消息状态从 streaming 改为 completed。除了 data 字段外，SSE 还支持 `event`（事件类型）、`id`（事件 ID）、`retry`（重连间隔）等字段，但 LLM API 通常只用 data 字段。

**追问 1-3：流式输出过程中如果网络断开或者用户想停止怎么办？**

这个场景我用 AbortController 来处理。在发起 fetch 请求之前，我先创建一个 AbortController 实例，把它的 signal 传给 fetch 的 options。当用户点击"停止生成"按钮时，我调用 controller.abort()，这会立即中断底层的 HTTP 连接，同时 reader.read() 会抛出 AbortError。我在 while 循环里 catch 这个错误，然后把当前消息的 status 从 streaming 改为 completed（保留已生成的部分内容），而不是 failed。这样用户可以看到已经生成的部分回答。如果是网络断开导致的意外中断，reader.read() 会抛出其他类型的错误，这时候我把 status 标记为 failed，用户可以点击"重新生成"。还有一个恢复机制：应用启动时，recoverIncompleteMessages 会扫描所有 status 为 streaming 的消息（说明上次关闭时流还在进行中），把它们标记为 failed，避免界面卡在"生成中"的状态。

**追问 1-4：你提到了 SSE 协议，SSE 和 WebSocket 有什么区别？为什么选择 SSE？**

SSE 和 WebSocket 的核心区别在于通信方向和协议层级。SSE 是基于 HTTP 的单向通信，服务端向客户端推送数据，客户端通过普通 HTTP 请求建立连接；WebSocket 是独立的双向通信协议，需要一次 HTTP 升级握手后切换到 ws 协议。在 AI 对话场景下，用户发送一条消息后，核心需求是服务端持续推送生成的 token，这是一个典型的单向推送场景，SSE 完全够用。而且 SSE 基于 HTTP，天然支持代理、CDN、负载均衡等基础设施，不需要额外的协议适配。WebSocket 的优势在双向实时通信，比如聊天室、协同编辑，但 AI 对话不需要用户在生成过程中持续发送数据，所以 WebSocket 的双向能力用不上，反而增加了连接管理的复杂度。另外从实现角度，fetch + ReadableStream 处理 SSE 格式非常自然，而 WebSocket 需要单独的 API 和事件模型。

---

### 主题二：Pinia 状态管理与数据模型设计（4 题）

**Q2：你的 Pinia store 是怎么设计的？为什么分成四个 store 而不是一个大的？**

我的 store 设计遵循单一职责原则，按照业务领域分成了四个独立的 store。SessionStore 管理会话的 CRUD 和排序，维护 sessions 数组和 activeSessionId；MessageStore 管理消息的增删改和流式写入，核心数据结构是 messagesBySession 这个以 sessionId 为 key 的 Map；EmotionStore 管理情绪报告的生成和存储，结构和 MessageStore 类似，也是按 sessionId 隔离的；BusinessStore 管理模型选择和流式管道的组装，它是一个横切关注点，被 MessageStore 调用。这样拆分的好处是每个 store 职责清晰、体积可控，修改一个 store 不会影响其他的。如果合成一个大 store，光是 state 定义就会很长，actions 和 getters 也会互相纠缠。而且从依赖关系来看，SessionStore 和 MessageStore 可以独立使用，EmotionStore 依赖 MessageStore 的消息数据，BusinessStore 被 MessageStore 调用 —— 这种依赖关系在分 store 后非常清晰，如果合成一个就看不出来了。

**追问 2-1：多会话的数据隔离是怎么实现的？有没有遇到过数据串了的问题？**

多会话隔离的核心设计是 `Record<sessionId, DataType[]>` 这个 Map 结构。MessageStore 的 state 是 `messagesBySession: Record<string, ChatMessage[]>`，EmotionStore 的 state 是 `reportsBySession: Record<string, EmotionReport[]>`。所有操作都必须传 sessionId 参数，读取时通过 sessionId 从 Map 中取出对应数组，写入时也按 sessionId 索引。视图层通过 SessionStore 的 activeSessionId 来决定当前展示哪个会话的数据，computed getter 根据 activeSessionId 从 messagesBySession 中取出消息列表。这个设计在开发过程中确实遇到过一个坑：切换会话时，如果上一个会话的流式生成还在进行中，新会话的视图会错误地显示上一个会话的流式消息。解决方案是在切换会话时检查当前是否有活跃的流式读取器，如果有就中断它，然后重新渲染目标会话的消息。这让我意识到"数据隔离"不仅要在 store 层做好，在视图层的生命周期管理上也要配合。

**追问 2-2：localStorage 持久化是怎么实现的？有什么局限性？**

持久化是通过在每个 store 中定义 loadFromStorage 和 persistToStorage 两个方法实现的。在 store 初始化时调用 loadFromStorage，从 localStorage 读取 JSON 字符串并 parse 为初始 state；在每个会修改 state 的 action 末尾调用 persistToStorage，把当前 state 序列化后写回 localStorage。key 的命名是 `chat-sessions`、`chat-messages`、`chat-emotions`，三个 store 各管各的 key，互不干扰。这个方案的优点是零依赖、实现简单，对于 MVP 阶段完全够用。但局限性也很明显：第一是 5MB 的容量限制，如果用户聊了几百个会话、每个会话几十条消息，加上情绪报告，数据量可能接近上限；第二是 localStorage 是同步 API，大数据量的序列化和反序列化会阻塞主线程，影响流式渲染的流畅度；第三是没有索引和查询能力，所有数据都得全量加载。如果要改进，可以考虑 IndexedDB（异步、容量大、支持索引）或者接入后端数据库。另外还有一个数据卫生问题：删除会话时，sessionStore 会级联调用 emotionStore.removeReportsBySession 清理情绪报告，但 messageStore 的消息没有被清理，会成为 localStorage 中的孤儿数据。

**追问 2-3：Pinia 和 Vuex 相比，你觉得核心优势在哪？**

Pinia 相比 Vuex 的核心优势在三个方面。第一是类型推导：Pinia 原生支持 TypeScript，state 的类型可以直接推导出来，不需要像 Vuex 那样写大量的类型声明。这在大型项目中非常重要，IDE 的自动补全和类型检查能显著提升开发效率。第二是 API 简洁：Pinia 没有 mutations，只有 state、getters、actions，actions 里可以直接修改 state，不需要 commit mutation。这让代码量减少了很多，逻辑也更直观。第三是模块化天然友好：每个 store 就是一个独立的函数（useXxxStore），可以按需导入，tree-shaking 友好。Vuex 的 modules 配置嵌套深、命名空间麻烦。在本项目中，我用四个独立的 Pinia store，每个都是一个 useXxxStore 函数，组件里按需调用，非常干净。Pinia 还有一个隐含优势：它的 DevTools 支持非常好，可以实时查看每个 store 的 state 变化，调试流式写入时特别有用。

---

### 主题三：情绪分析与结构化 JSON 解析（4 题）

**Q3：情绪分析的 JSON 输出是怎么解析的？LLM 返回的格式不稳定怎么办？**

这是我在项目中花精力最多的部分之一。LLM 生成 JSON 的不稳定性主要体现在三个方面：一是返回的 JSON 经常包裹在 markdown 代码块里，比如 ` ```json\n{...}\n``` `；二是可能缺少某些字段，或者数值类型不对；三是极端情况下 JSON 格式本身就是错的。我的解决方案是三层降级解析策略。第一层是直接 JSON.parse，如果 LLM 返回了干净的 JSON，这一步就成功了。第二层是 markdown fence 提取，用正则匹配代码块，提取里面的 JSON 字符串再 parse。第三层是 brace matching，从第一个 `{` 开始，用计数器追踪嵌套层级，遇到 `{` 加一、遇到 `}` 减一，到计数器归零时截取这段子串再 parse。这样几乎能处理所有常见的 LLM JSON 输出格式。parse 成功后还有 validateReport 做字段级校验：score 会被 clamp 到 0-10 范围内，emotionLabels 和 keywords 数组如果超过 5 个会被截断，riskLevel 如果不是 low/medium/high 就默认 medium，suggestions 如果超过 3 个会被截断。这套策略确保了无论 LLM 返回什么格式，最终写入 store 的一定是一个结构完整的 EmotionReport 对象。

**追问 3-1：情绪报告的生成时机和流程是什么？会不会影响对话的响应速度？**

情绪分析是在每条 assistant 消息状态变为 completed 之后触发的，是异步的 fire-and-forget 模式。具体流程是：在 chat.vue 的 handleSend 方法中，当流式读取完成、消息标记为 completed 后，我调用 `emotionStore.analyzeEmotion(assistantMessage, sessionId)`，这个方法内部会构造一个专门的 system prompt，要求模型以 JSON 格式返回情绪标签、评分、风险等级等字段，然后复用同一个模型的 chatFetch 和流式管道来获取结果。因为是异步调用且不阻塞主流程，所以不会影响对话的响应速度。用户体验上，对话结束后一两秒内情绪标签就会出现在消息气泡下方。如果情绪分析失败了也不会影响已有的对话记录，只是不显示情绪标签。这个设计的权衡是：如果改成同步等待情绪分析完成再显示消息，用户看到回答的延迟会增加一两秒，体验不好；fire-and-forget 的代价是情绪标签出现有轻微延迟，但用户感知不到。

**追问 3-2：你发送给 LLM 的情绪分析 prompt 是怎么设计的？怎么保证输出格式？**

我的情绪分析 prompt 分为 system 和 user 两个部分。system prompt 定义了角色（你是一个情绪分析专家）和输出格式要求（严格按 JSON 格式返回，包含 emotionLabels、score、riskLevel、keywords、suggestions 五个字段），并给出了每个字段的类型和取值范围说明，比如 emotionLabels 要求中文标签、score 是 0-10 的整数、riskLevel 只能是 low/medium/high 之一。user prompt 则是把 assistant 的回答原文传进去，让模型基于这段文本做分析。关于保证输出格式，我的策略是"不完全信任"。即使 prompt 里明确要求返回 JSON，LLM 仍然可能返回非标准格式，所以我上面说的三层降级解析就是兜底方案。在 prompt 设计上我还做了一个细节：我要求模型"只返回 JSON，不要有其他文字"，这能显著降低返回格式异常的概率。另外我用的是同一个 LLM 模型来做情绪分析，没有用更小的模型，因为情绪分析需要理解对话语义，小模型的准确率不够。

**追问 3-3：score 的 clamp、数组的 cap、riskLevel 的 default，这些校验策略是怎么想到的？**

这些校验策略来自于我对 LLM 输出不稳定性的实际观察。score 字段我要求 LLM 返回 0-10 的数值，但它经常返回 7.5 这样的小数，甚至偶尔返回 12 或者 -1 这种越界值。clamp 到 0-10 是最基本的数据卫生。emotionLabels 和 keywords 数组，LLM 有时候会返回十几个甚至二十个元素，前端 UI 展示不下而且没有意义，所以 cap 到 5 个。riskLevel 字段我定义了 low/medium/high 三个枚举值，但 LLM 有时候会返回"中等"这样的中文，或者"moderate"这样的同义词，甚至大小写不一致，所以我在校验时做了小写转换和枚举匹配，匹配不上就默认 medium —— 这是一个安全的默认值，宁可低估也不要误报。suggestions 超过 3 个会被截断。这些策略本质上是"防御性编程"的思想：你不能假设外部输入（LLM 输出）一定符合你的预期，所以每一层都要有校验和兜底，确保写入 store 的数据一定合法。

---

### 主题四：ECharts 可视化与 Composable 封装（3 题）

**Q4：ECharts 看板是怎么实现的？useECharts 这个 Composable 是怎么封装的？**

看板部分我用 ECharts 实现了三个图表：情绪趋势折线图、情感分布饼图和关键词排行柱状图。useECharts 这个 Composable 的封装思路是把 ECharts 的生命周期管理（初始化、更新、销毁）和 Vue 的组件生命周期绑定在一起。它接收一个 ref 绑定的 DOM 容器，内部在首次 setOption 调用时懒初始化 echarts.init，用 watch 监听 options 变化自动调用 setOption 更新图表，在 window resize 时自动调整尺寸，在 onUnmounted 时自动 dispose 释放资源。组件使用时只需要声明一个 ref 绑定到 DOM 元素，准备好 options 数据，剩下的事情 Composable 全部处理好了。这个封装的好处是复用性极强 —— 项目里三个图表组件都用同一个 useECharts，代码量大幅减少。而且因为 options 是响应式的，当 emotionStore 的 allReports getter 更新时，图表自动重新渲染，不需要手动调用任何更新方法。

**追问 4-1：这三个图表分别展示了什么数据？数据是怎么从 store 流向图表的？**

趋势折线图的 X 轴是时间戳（每条情绪报告的生成时间），Y 轴是 score（0-10 分），用平滑曲线和面积填充展示情绪评分的变化趋势，颜色是靛蓝色 #6366f1。饼图展示 emotionLabels 的分布，比如"开心"出现了 15 次、"焦虑"出现了 8 次，用环形图（radius 35%-65%）展示各标签的占比和百分比。柱状图是 keywords 的 Top 10 排行，按出现频次降序排列，用渐变紫色条形（#6366f1 到 #a78bfa）展示。数据流向是这样的：emotionStore 的 allReports getter 从 reportsBySession 中合并所有会话的情绪报告，返回一个扁平数组。dashboard.vue 中用 computed 从 allReports 派生出三个图表需要的数据结构 —— 比如 trendData 是从 allReports 中提取 timestamp 和 score 的数组，labelDistribution 是对 emotionLabels 做 groupBy 计数。这些 computed 数据作为 ECharts 的 options 的 series.data，因为是响应式的，当 allReports 变化时 computed 重新计算，watch 触发 setOption 更新图表。dashboard.vue 中用了 `watch(allReports, ..., { immediate: true })` 来确保首次渲染时就有数据。

**追问 4-2：ECharts 在 Vue 3 中有哪些常见的坑？你是怎么避免的？**

最大的坑是初始化时机和 DOM 尺寸。ECharts.init 需要一个已经有尺寸的 DOM 容器，如果在 onMounted 时容器还没渲染完成或者尺寸为 0，图表会渲染异常。我的解决方案是确保容器元素有明确的宽高设置，不用百分比高度（除非父容器有确定高度）。而且 useECharts 采用了懒初始化策略 —— 不在 onMounted 时立即 init，而是在第一次 setOption 调用时才 init，这样能保证容器一定已经渲染完成。第二个坑是内存泄漏：如果组件卸载时不调用 dispose，ECharts 实例会一直占用内存，而且 resize 监听器也不会自动移除。我在 useECharts 的 onUnmounted 中同时做了 chart.dispose() 和 window.removeEventListener('resize', handleResize)。第三个坑是响应式更新的性能：如果 options 的每次微小变化都触发 setOption，可能会导致频繁重绘。我在 watch 中用了 `{ deep: true }` 但没有加 debounce，因为看板的数据变化频率不高（只有新生成情绪报告时才更新），不需要额外优化。如果数据变化频繁，可以考虑加 requestAnimationFrame 节流。

---

### 主题五：Node 代理与 API 安全（2 题）

**Q5：API Key 的安全是怎么处理的？代理层是怎么设计的？**

API Key 安全的核心设计是"前端永远不接触密钥"。我用 Express + http-proxy-middleware 搭了一个 Node 本地代理服务，监听 3001 端口。前端 fetch 请求发到 `/deepseek/chat/completions`，先经过 Vite 开发服务器的 proxy 转发到 localhost:3001，再由 Node 代理注入 Authorization header 后转发到 `https://api.deepseek.com`。整个链路是：浏览器 → Vite proxy（解决 CORS）→ Node 代理（注入 Key）→ DeepSeek API。前端代码里完全没有 Authorization header，API Key 存在 `.env` 文件中用 `DEEPSEEK_KEY` 变量名（没有 VITE_ 前缀），通过 dotenv 加载到 Node 进程的 process.env 中。Vite 约定只有 VITE_ 前缀的变量才会暴露到客户端，所以不带 VITE_ 前缀的 DEEPSEEK_KEY 不会被打包进前端 bundle。同时 `.gitignore` 排除 `.env` 文件，只提交 `.env.template` 模板。这样即使有人看前端代码或 Network 面板，也看不到任何密钥信息。代理层的核心代码很精简：用 http-proxy-middleware 的 createProxyMiddleware 配置 target、changeOrigin、pathRewrite，在 proxyReq 回调中 setHeader 注入 Key，大约 30 行代码。

**追问 5-1：如果要上生产环境，你会怎么处理 API 代理和 Key 安全？**

生产环境的代理层和开发环境思路一致，只是载体不同。开发阶段我用的是 Node 本地代理 + Vite dev server 的两层转发，生产环境可以换成两种方案。第一种是 Nginx 反向代理：在 Nginx 配置中设置 location 块匹配 `/deepseek` 路径，用 proxy_pass 转发到 DeepSeek 地址，通过 proxy_set_header 注入 API Key。这种方式性能好、配置成熟，适合有自己服务器的场景。第二种是 Serverless Function：用 Vercel Edge Function 或 AWS Lambda 写一个薄代理层，接收前端请求后注入 Key 转发。好处是无服务器运维、自动扩缩容。无论哪种方案，核心原则和我现在做的一样 —— API Key 只存在于服务端，前端永远只和自己的代理层通信。区别只是开发阶段用 Express 进程，生产阶段用 Nginx 或 Serverless。另外我还会加上速率限制和请求校验，防止 Key 被滥用。

**追问 5-2：为什么不直接用 Vite proxy 注入 Key，而要单独起一个 Node 服务？**

Vite proxy 的本质是开发服务器内置的 http-proxy 中间件，它确实可以在 onProxyReq 回调中注入 header。但问题是 Vite proxy 只在 `vite dev` 时运行，`vite build` 后的静态产物不包含 Vite 开发服务器。如果用 Vite proxy 注入 Key，那生产环境还需要另外实现一套代理逻辑，开发和生产走的是两套不同的架构。我选择单独起 Node 代理服务的好处是：开发环境和生产环境的代理层代码完全一致 —— 都是 Express + http-proxy-middleware 这一套。开发时用 `concurrently` 同时启动 Node 代理和 Vite dev server，生产时 Node 代理同时 serve 静态文件和代理 API 请求。架构统一，不需要维护两套代理配置。而且 Vite 只负责前端资源的构建和热更新，代理只负责请求转发和 Key 注入，各司其职，职责分离更清晰。

---

### 主题六：路由与权限控制（2 题）

**Q6：Vue Router 的权限控制是怎么做的？登录态管理呢？**

我这个项目的路由结构很简单：`/chat` 是对话页面，`/dashboard` 是看板页面，`/` 重定向到 `/chat`，其他路径匹配 404。权限控制层面，目前是 MVP 阶段，permission.ts 中只做了 NProgress 的进度条控制（beforeEach 开始、afterEach 结束），没有真正的登录态校验和角色权限。如果要扩展，我的设计思路是在 permission.ts 的 beforeEach 守卫中检查 localStorage 或 cookie 中的 token：如果没有 token 且目标路由需要认证，就重定向到登录页；如果有 token，就解析 token 中的角色信息，和路由 meta 中声明的 requiredRole 做比对。路由的 meta 字段可以声明 `requiresAuth: true` 和 `roles: ['admin', 'user']`，守卫根据这些声明做判断。Vue Router 的导航守卫机制很适合做这件事：beforeEach 是全局前置守卫，每次路由切换都会触发，是注入认证逻辑的标准位置。to.matched 数组可以检查当前路由及其所有父级路由的 meta，支持嵌套路由的权限继承。另外 router 还支持 hash 模式和 history 模式的切换，本项目通过 `isGithubDeployed` 标志在 GitHub Pages 部署时自动使用 hash 模式，避免 404 问题。

**追问 6-1：如果要加一个管理员角色，能看所有用户的情绪报告，你会怎么设计？**

我会在路由层面和数据层面同时做控制。路由层面，在 dashboard 路由的 meta 中加 `roles: ['admin']`，普通用户看不到导航栏里的看板入口，即使手动输入 URL 也会被 beforeEach 守卫拦截。数据层面，目前的情绪报告按 sessionId 存储在 localStorage 中，纯前端无用户概念。要支持多用户，首先需要接入后端数据库，每个用户的数据和 userId 绑定。管理员角色的看板接口会查询所有用户的情绪报告，普通用户只能查自己的。前端 API 调用时在 header 中带 token，后端根据 token 解析 userId 和 role，返回对应范围的数据。看板组件本身不需要改，它只是渲染 allReports —— 区别在于 allReports 的数据源从"当前用户"变成了"所有用户"。ECharts 图表的配置不需要变，因为数据结构是一样的，只是数据量更大了。

---

### 主题七：组件设计与工程实践（2 题）

**Q7：Markdown 渲染是怎么实现的？代码高亮、LaTeX、Mermaid 这些是怎么集成的？**

AI 对话的回答通常包含 Markdown 格式的文本，包括代码块、数学公式、图表等，所以我用 markdown-it 作为核心渲染引擎，配合多个插件实现富文本渲染。代码高亮用的是 highlight.js，我在 `plugins/highlight.ts` 中注册了 Vue 和 Mermaid 两个自定义语言定义，然后在 markdown-it 初始化时通过 highlight 选项集成。LaTeX 公式渲染用的是 KaTeX 插件，它能在 markdown-it 的行内和块级公式规则下工作。Mermaid 图表用的是 mermaid-js，我把 mermaid 代码块渲染成 SVG 图表。还有一个细节是 `plugins/preWrapper.ts`，它给每个代码块外面包了一层 div，添加了语言标签和复制按钮。复制功能在 `hooks/useCopyCode.ts` 中实现，用 navigator.clipboard.writeText API。这些插件的加载是按需的：markdown-it 本身是核心依赖，highlight.js 只在遇到代码块时才触发高亮，KaTeX 只在遇到公式时才渲染，Mermaid 只在遇到 mermaid 代码块时才初始化。这样避免了不必要的性能开销。

**追问 7-1：AI 回答中的 `<think>` 标签是怎么处理的？DeepSeek 的推理过程怎么展示？**

DeepSeek 的推理模型（DeepSeek-R1）在生成回答时会同时输出两个字段：`reasoning_content`（思考过程）和 `content`（最终回答）。在 `models/index.ts` 的 `createStreamThinkTransformer` 中，我检测到 `delta.reasoning_content` 时，会把它包裹在 `<think>` 和 `</think>` 标签中，和正常的 content 拼接在一起。然后在 markdown 渲染层，我在 markdown-it 中注册了一个自定义的 block 规则来识别 `<think>` 标签，把它们渲染成一个可折叠的区域，默认收起，用户点击可以展开查看推理过程。这样做的好处是：推理过程不会干扰最终回答的阅读体验，但用户如果想了解 AI 的思考路径，可以展开查看。在流式输出过程中，用户会先看到推理过程逐字出现（被包裹在 think 块中），推理完成后最终回答才开始逐字出现。这个体验和 DeepSeek 官方的 UI 是一致的。

**追问 7-2：ChatInput 组件的发送逻辑是怎么设计的？Ctrl+Enter 和 Enter 的区别？**

ChatInput 组件是一个 textarea 输入框，支持两种发送方式：Enter 直接发送和 Ctrl+Enter 换行。这个设计是考虑到不同用户的习惯 —— 有些用户习惯 Enter 发送（类似微信），有些习惯 Ctrl+Enter 发送（类似飞书）。我在 keydown 事件中判断：如果按的是 Enter 且没有 Ctrl 修饰符，就阻止默认行为（阻止换行）并触发发送；如果按的是 Ctrl+Enter，就允许默认行为（插入换行）。发送时，先检查输入框是否有内容且当前没有正在进行的流式生成（isStreaming 为 false），两个条件都满足才发送。发送后清空输入框。组件还支持 prompt 快捷标签 —— 预设一些常用的提示词模板，用户点击标签就能快速填入输入框。停止按钮在流式生成进行中显示，点击调用 messageStore.abortActiveStream()。这个组件的 props 设计很简洁：只有 modelValue（双向绑定输入内容）和 disabled（是否禁用），事件只有 update:modelValue 和 send。

---

*本面经由 interview-analyzer-skill 生成，所有口播内容均为第一人称、STAR 结构、≥150 字。面试前建议先通读导学文档，再逐题练习口播。*
