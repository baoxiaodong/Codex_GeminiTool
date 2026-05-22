# Codex Gemini Agent

让 Codex 直接调用你已经登录的 Gemini 网页版，支持文本问答、代码生成、图片生成和视频生成。

现在它不仅是 bridge 工具，也可以作为一个 **Codex Gemini Agent** 使用：

- 自动判断你是要问答、写代码、生图还是生成视频
- 统一通过 `gemini_run` 调用 Gemini 网页能力
- 默认等待最终结果，直接回传给 Codex 显示
- 自动按类型保存到 `code/`、`images/`、`videos/`
- 自动记录最近任务到 `index.json`

项目由三部分组成：

- 本地桥接服务：默认监听 `http://127.0.0.1:8765`
- 浏览器自动化执行器：使用独立 Chrome Profile 操作 `https://gemini.google.com/app`
- MCP 服务：让 Codex 通过 MCP 工具或自然语言调用 Gemini
- Chrome 扩展：保留为兼容路径，默认不再依赖它

安装完成后，你可以在 Codex 中直接说：

```text
用gemini问：你好，简单回复一句话
用gemini写代码：写一个 React 登录组件
用gemini生图：一张未来城市夜景海报
用gemini生成视频：未来城市日出短视频
```

同时也兼容常见误拼：`用gimini...`。


## 快速下载和使用（Windows）

> 适合第一次安装：下载项目、安装依赖、启动面板、配置 Codex MCP。

### 一键下载

```powershell
git clone https://github.com/baoxiaodong/Codex_GeminiTool.git F:\Codex_GeminiTool
cd F:\Codex_GeminiTool
npm install
```

### 启动可视化面板

双击项目根目录的：

```text
open-panel.cmd
```

或在 PowerShell 中运行：

```powershell
cd F:\Codex_GeminiTool
npm run panel
```

面板默认地址：

```text
http://127.0.0.1:9876/panel
```

面板会自动启动 9876 端口的桥接服务，适合手动查看历史任务、输出文件和删除记录。

### 启动 Codex MCP 使用的桥接服务

Codex MCP 默认连接 `http://127.0.0.1:8765`。如果你要在 Codex 里直接说“用gemini...”，请保持下面命令运行：

```powershell
cd F:\Codex_GeminiTool
npm run bridge
```

### 首次登录 Gemini

第一次让 Gemini 执行问答、写代码、生图或视频时，会打开一个独立 Chrome 自动化窗口。请在这个窗口中登录：

```text
https://gemini.google.com/app
```

登录成功后再回到 Codex 里重试即可。后续会复用这个专用浏览器 Profile。

### 配置 Codex MCP

把下面配置加入你的 Codex 配置文件，并按你的实际安装路径修改 `F:\Codex_GeminiTool`：

```toml
[mcp_servers.gemini-web-bridge]
command = "node"
args = ['F:\Codex_GeminiTool\src\mcp-server.mjs']
cwd = 'F:\Codex_GeminiTool'
startup_timeout_sec = 20
```

然后重启 Codex 或新开一个 Codex 会话。

### 配置 Codex 技能触发词

把仓库中的：

```text
F:\Codex_GeminiTool\.codex\skills\gemini-web-bridge\SKILL.md
```

复制到：

```text
C:\Users\<你的用户名>\.codex\skills\gemini-web-bridge\SKILL.md
```

之后你就可以在 Codex 里直接说：

```text
用gemini问：你好
用gemini写代码：写一个 Agent + Function Calling 案例
用gemini生图：生成一张雪碧海报
用gemini生成视频：生成一个未来城市短视频
```

## 功能特性

- 让 Codex 调用 Gemini 网页版回答文本问题
- 让 Codex 调用 Gemini 网页版生成代码
- 让 Codex 调用 Gemini 网页版生成图片
- 让 Codex 调用 Gemini 网页版生成视频
- 支持统一 Agent 工具：`gemini_run`
- 支持短工具名：`gemini_status`、`gemini_ask`、`gemini_code`、`gemini_image`、`gemini_video`
- 支持异步任务查询：`gemini_get_task`、`gemini_list_tasks`
- 默认等待 Gemini 最终结果并回传给 Codex，方便 Codex 快速显示内容
- 按类型保存输出文件：代码到 `code/`、图片到 `images/`、视频到 `videos/`
- 自动记录任务历史到 `index.json`

## 运行要求

- Windows
- Google Chrome
- Node.js 20 或更高版本
- 已在自动化浏览器 Profile 中登录 Gemini 网页版账号
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
  mcp-run.mjs
  mcp-server.mjs
  output-paths.mjs
  protocol.mjs
  result-files.mjs
  send-task.mjs
  task-index.mjs
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

### 3. 初始化自动化浏览器登录

首次执行 `gemini_run`、`gemini_image`、`gemini_code` 或 `gemini_video` 时，桥接服务会打开一个独立的 Chrome 自动化窗口。

在这个窗口里登录 <https://gemini.google.com/app>，并手动确认你的账号可以正常问答、生图或生成视频。这个登录状态会保存在默认目录：

```text
C:\tmp\gemini-browser-profile
```

后续任务会复用这个专用 Profile，不会反复复制或关闭你的日常 Chrome 浏览器。

如果你仍想使用旧的扩展方式，可以把对应环境变量设为 `extension`，例如：

```powershell
$env:GEMINI_BRIDGE_IMAGE_MODE = "extension"
```

### 4. 启动本地桥接服务

```powershell
npm run bridge
```

看到类似输出即启动成功：

```text
Gemini bridge server listening on http://127.0.0.1:8765
Output root: C:\Users\<you>\Desktop\codex\gemini
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

### 6. 配置 Codex Agent 触发词

把仓库里的：

```text
.codex/skills/gemini-web-bridge/SKILL.md
```

复制到：

```text
C:\Users\<你的用户名>\.codex\skills\gemini-web-bridge\SKILL.md
```

复制完成后，重启 Codex 或新开会话。

## 作为 Agent 使用

推荐优先使用统一工具：

- `gemini_run`

它会根据 `type` 自动路由：

- `ask`：文本问答
- `code`：代码生成/代码解释
- `image`：图片生成
- `video`：视频生成

例如：

```text
用gemini写代码：写一个 LangChain + RAG 智能客服案例
```

对应 Agent 内部会路由成：

```json
{
  "type": "code",
  "prompt": "写一个 LangChain + RAG 智能客服案例"
}
```

如果你直接使用 MCP 工具，也支持这些：

- `gemini_run`
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

## 在 Codex 中使用

MCP 生效后，你可以直接说：

```text
用gemini问：你好，简单回复一句话
用gemini写代码：写一个 LangChain + RAG 智能客服案例
用gemini生图：一张真实自然的卧室镜自拍照片，比例 3:4
用gemini生成视频：未来城市日出短视频
```

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


## 可视化面板

项目内置本地面板，用来查看 Gemini 任务历史、预览输出文件、复制结果和删除历史记录。

启动方式：

```powershell
npm run panel
```

或双击：

```text
open-panel.cmd
```

默认访问：

```text
http://127.0.0.1:9876/panel
```

注意：面板默认使用 9876 端口；Codex MCP 默认使用 8765 端口。两者可以同时存在，互不影响。

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
  index.json
```

其中：

- `code/` 保存代码任务的 Markdown 和代码块文件
- `images/` 保存图片结果
- `videos/` 保存视频结果
- `index.json` 记录最近任务、文件路径、媒体信息，方便后期做历史管理

具体行为：

- 文本任务返回可读文本，不是原始 JSON
- 代码任务返回正文和提取出的代码块，并保存到 `code/`
- 图片任务会把 Gemini 页面里的图片转换成 `dataUrl` 回传给 MCP，同时保存到 `images/`
- 视频任务会返回提取到的视频地址；如果页面能暴露可读取媒体数据，则保存到 `videos/`
- MCP/Agent 默认等待最终结果，便于 Codex 直接显示文本、代码、图片或视频预览
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

说明桥接服务已经在运行，或有旧进程占用端口。

### 3. 自动化浏览器没有登录或不能生图

先检查：

```powershell
Invoke-RestMethod http://127.0.0.1:8765/health
```

如果 Gemini 返回“未登录”或“无法创建图片”，说明当前自动化浏览器 Profile 还没有完整登录，或该账号会话在这个窗口里没有对应能力。

处理方式：

1. 保持桥接服务运行。
2. 重新提交一次 Gemini 任务，让自动化 Chrome 窗口打开。
3. 在这个自动化窗口里登录 Gemini。
4. 手动确认生图/视频能力可用后，再从 Codex 重试。

旧扩展路径才需要关注：

```text
geminiPagePollingActive: true
```

如果是 `false`，重新加载 Chrome 扩展并刷新 Gemini 页面。

## 开发与测试

运行测试：

```powershell
npm test
```

当前技术栈：

- Playwright 浏览器自动化
- Chrome Manifest V3 扩展兼容路径
- Node.js 原生 HTTP Bridge
- MCP Stdio Server
- `@modelcontextprotocol/sdk`
- `ws`
- `zod`
- Node 原生 `node --test`

## 说明

- 这是对正常登录 Gemini 网页会话的自动化调用，只能使用你账号本来就能手动使用的能力。
- 如果 Gemini 网页结构变化，可能需要更新 `src/browser-agent.mjs` 中的选择器。
- 代码结果会返回给 Codex 审阅并保存到本地，不会自动写入你的业务项目文件。
- 图片和视频能否完整落盘，取决于 Gemini 页面当前是否暴露可读取的媒体地址或数据。
