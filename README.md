# Codex Gemini Tool

让 Codex 直接调用你已经登录的 Gemini 网页版，支持文本问答、代码生成、图片生成和视频生成。

项目由三部分组成：

- 本地桥接服务：默认监听 `http://127.0.0.1:8765`
- Chrome 扩展：负责操作 `https://gemini.google.com/app`
- MCP 服务：让 Codex 通过 MCP 工具或自然语言调用 Gemini

安装完成后，你可以在 Codex 中直接说：

```text
用gemini问：你好，简单回复一句话
用gemini写代码：写一个 React 登录组件
用gemini生图：一张未来城市夜景海报
用gemini生成视频：未来城市日出短视频
```

同时也兼容常见误拼：`用gimini...`。

## 功能特性

- 让 Codex 调用 Gemini 网页版回答文本问题
- 让 Codex 调用 Gemini 网页版生成代码
- 让 Codex 调用 Gemini 网页版生成图片
- 让 Codex 调用 Gemini 网页版生成视频
- 支持短工具名：`gemini_status`、`gemini_ask`、`gemini_code`、`gemini_image`、`gemini_video`
- 支持异步任务查询：`gemini_get_task`、`gemini_list_tasks`
- 默认等待 Gemini 最终结果并回传给 Codex，方便 Codex 快速显示内容
- 按类型保存输出文件：代码到 `code/`、图片到 `images/`、视频到 `videos/`

## 运行要求

- Windows
- Google Chrome
- Node.js 20 或更高版本
- 已登录 Gemini 网页版账号
- 已安装并启用 MCP 的 Codex

## 项目结构

```text
.codex/
  skills/
    gemini-web-bridge/
      SKILL.md
docs/
  codex-config.example.toml
extension/
  background.js
  content-script.js
  manifest.json
  popup.html
  popup.js
src/
  bridge-server.mjs
  http-utils.mjs
  mcp-format.mjs
  mcp-options.mjs
  mcp-server.mjs
  output-paths.mjs
  protocol.mjs
  result-files.mjs
  send-task.mjs
  task-store.mjs
tests/
README.md
package.json
```

## 安装步骤

### 1. 克隆仓库

```powershell
git clone https://github.com/baoxiaodong/Codex_GeminiTool.git
cd Codex_GeminiTool
```

### 2. 安装依赖

```powershell
npm install
```

### 3. 加载 Chrome 扩展

1. 打开 `chrome://extensions`
2. 开启右上角 `Developer mode`
3. 点击 `Load unpacked`
4. 选择本项目的 `extension` 目录
5. 打开 <https://gemini.google.com/app>
6. 确保 Gemini 页面已经登录

### 4. 启动本地桥接服务

```powershell
npm run bridge
```

看到类似输出即启动成功：

```text
Gemini bridge server listening on http://127.0.0.1:8765
Output root: C:\Users\<you>\Desktop\codex\gemini
```

如果提示端口被占用：

```text
EADDRINUSE: address already in use 127.0.0.1:8765
```

说明桥接服务已经在运行，不需要重复启动。可以用下面命令检查：

```powershell
Invoke-RestMethod http://127.0.0.1:8765/health
```

### 5. 配置 Codex MCP

把 `docs/codex-config.example.toml` 中的内容复制到你的 Codex 配置文件，例如：

```toml
[mcp_servers.gemini-web-bridge]
command = "node"
args = ['C:\path\to\Codex_GeminiTool\src\mcp-server.mjs']
cwd = 'C:\path\to\Codex_GeminiTool'
startup_timeout_sec = 20
```

请把路径改成你的本机项目实际路径。

配置完成后，重启 Codex 或新开一个 Codex 会话。

### 6. 配置 Codex 自然语言触发词

把仓库里的：

```text
.codex/skills/gemini-web-bridge/SKILL.md
```

复制到：

```text
C:\Users\<你的用户名>\.codex\skills\gemini-web-bridge\SKILL.md
```

复制完成后，重启 Codex 或新开会话。

## 在 Codex 中使用

MCP 生效后，你可以直接说：

```text
用gemini问：你好，简单回复一句话
用gemini写代码：写一个 LangChain + RAG 智能客服案例
用gemini生图：一张真实自然的卧室镜自拍照片，比例 3:4
用gemini生成视频：未来城市日出短视频
```

也支持这些工具名：

- `gemini_status`
- `gemini_ask`
- `gemini_code`
- `gemini_image`
- `gemini_video`
- `gemini_get_task`
- `gemini_list_tasks`

兼容旧工具名：

- `gemini_web_status`
- `gemini_web_ask`
- `gemini_web_write_code`
- `gemini_web_generate_image`
- `gemini_web_generate_video`

## 终端快速测试

保持 Gemini 页面打开，并保持 `npm run bridge` 运行。

文本问答：

```powershell
npm run ask -- "你好，简单回复一句话"
```

代码生成：

```powershell
npm run code -- "写一个 JavaScript 防抖函数"
```

图片生成：

```powershell
npm run image -- "生成一张未来城市夜景海报，电影感，高质量"
```

视频生成：

```powershell
npm run video -- "生成一个未来城市日出的短视频，电影感"
```

如果想让 CLI 等待最终结果，可以设置：

```powershell
$env:GEMINI_BRIDGE_CLI_WAIT="true"
```

## 健康检查

```powershell
Invoke-RestMethod http://127.0.0.1:8765/health
```

关键字段：

```text
ok: true
bridge: gemini-web-bridge
polling: true
geminiPagePollingActive: true
```

说明：`extensionClients` 为 `0` 不一定有问题。当前主流程使用 Gemini 页面主动轮询，不依赖旧的 WebSocket 常驻连接。

如果 `geminiPagePollingActive` 是 `false`，通常说明：

- Gemini 页面没有打开
- Chrome 扩展没有加载成功
- Gemini 标签页没有刷新到最新 content script

可以尝试在 `chrome://extensions` 重新加载扩展，然后刷新 Gemini 页面。

## 输出行为

默认输出根目录：

```text
C:\Users\<you>\Desktop\codex\gemini
```

输出文件按任务类型分开保存：

```text
Desktop\codex\gemini\
  code\
    task-000001.md
    task-000001-code-0.py
  images\
    task-000002-0.jpg
  videos\
    task-000003-0.mp4
```

具体行为：

- 文本任务返回可读文本，不是原始 JSON
- 代码任务返回正文和提取出的代码块，并保存到 `code/`
- 图片任务会把 Gemini 页面里的图片转换成 `dataUrl` 回传给 MCP，同时保存到 `images/`
- 视频任务会返回提取到的视频地址；如果页面能暴露可读取媒体数据，则保存到 `videos/`
- MCP 工具默认等待最终结果，便于 Codex 直接显示文本、代码、图片或视频预览
- 如需长任务后台提交，可以显式传 `wait=false`，然后用 `gemini_get_task` 查询结果
- 如需恢复旧的默认异步行为，可给 MCP 服务设置环境变量：`GEMINI_BRIDGE_MCP_DIRECT_WAIT=false`

## 可选环境变量

```powershell
$env:GEMINI_BRIDGE_PORT="8765"
$env:GEMINI_BRIDGE_OUTPUT_ROOT="C:\Users\<you>\Desktop\codex\gemini"
$env:GEMINI_BRIDGE_TOKEN="choose-a-local-token"
$env:GEMINI_BRIDGE_MCP_DIRECT_WAIT="false"
```

如果设置了 `GEMINI_BRIDGE_TOKEN`，HTTP 调用方需要带上 `x-gemini-bridge-token` 请求头。

## 故障排查

### 1. 缺少依赖 `ws`

如果看到：

```text
Cannot find package 'ws'
```

说明还没有安装依赖。运行：

```powershell
npm install
```

### 2. 端口被占用

如果看到：

```text
EADDRINUSE: address already in use 127.0.0.1:8765
```

说明桥接服务已经在运行，或有旧进程占用端口。可以查看：

```powershell
Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort 8765 -State Listen
```

### 3. Gemini 页面打开但 Codex 说没连接

先检查：

```powershell
Invoke-RestMethod http://127.0.0.1:8765/health
```

重点看：

```text
geminiPagePollingActive: true
```

如果是 `false`，重新加载 Chrome 扩展并刷新 Gemini 页面。

### 4. 提示词填进去了但没有发送

先重新加载扩展，再硬刷新 Gemini 页面：

```text
chrome://extensions
Ctrl+Shift+R
```

当前脚本优先适配 Gemini 的 Quill 输入框：

```text
DIV role="textbox" aria-label="为 Gemini 输入提示"
```

### 5. 中文提示词变成问号

PowerShell 5.1 下不要手写原始 JSON 调 `Invoke-RestMethod -Body`。优先用项目内命令：

```powershell
npm run ask -- "中文提示词"
```

### 6. 插件脚本版本不一致

在 Gemini 页面 DevTools 中执行：

```js
document.documentElement.getAttribute('data-gemini-web-bridge-version')
```

当前版本应类似：

```text
2026-05-18-v19
```

如果 `/health` 里显示 `expectedGeminiScriptVersion` 是新版本，但页面仍是旧版本，请在 `chrome://extensions` 重新加载本插件，再刷新 Gemini 页面。

## 开发与测试

运行测试：

```powershell
npm test
```

当前技术栈：

- Chrome Manifest V3 扩展
- Node.js 原生 HTTP Bridge
- MCP Stdio Server
- `@modelcontextprotocol/sdk`
- `ws`
- `zod`
- Node 原生 `node --test`

## 说明

- 这是对正常登录 Gemini 网页会话的自动化调用，只能使用你账号本来就能手动使用的能力。
- 如果 Gemini 网页结构变化，可能需要更新 `extension/content-script.js` 中的选择器。
- 代码结果会返回给 Codex 审阅并保存到本地，不会自动写入你的业务项目文件。
- 图片和视频能否完整落盘，取决于 Gemini 页面当前是否暴露可读取的媒体地址或数据。
