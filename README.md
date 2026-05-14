# Codex Gemini Tool

让 Codex 直接调用你已经登录的 Gemini 网页版，支持问答、写代码、生图、生成视频。

这个项目由三部分组成：

- 本地桥接服务：`127.0.0.1:8765`
- Chrome 插件：负责操作 `https://gemini.google.com/app`
- MCP 服务：让 Codex 通过自然语言或 MCP 工具调用 Gemini

装好以后，你可以在 Codex 里直接这样说：

```text
用gemini问你好，简单回复一句话
用gemini写代码写一个 React 登录组件
用gemini生图一张未来城市夜景海报
用gemini生成视频未来城市日出短视频
```

## 功能

- 让 Codex 调 Gemini 网页回答文本问题
- 让 Codex 调 Gemini 网页写代码
- 让 Codex 调 Gemini 网页生图
- 让 Codex 调 Gemini 网页生成视频
- 提供短别名 MCP 工具：`gemini_ask`、`gemini_code`、`gemini_image`、`gemini_video`
- 支持自然触发词：`用gemini问...`、`用gemini写代码...`、`用gemini生图...`

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
  mcp-server.mjs
  output-paths.mjs
  protocol.mjs
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

### 3. 加载 Chrome 插件

1. 打开 `chrome://extensions`
2. 开启右上角 `Developer mode`
3. 点击 `Load unpacked`
4. 选择本项目的 `extension` 目录
5. 打开 [https://gemini.google.com/app](https://gemini.google.com/app)
6. 确保 Gemini 页面已登录

### 4. 启动本地桥接服务

```powershell
npm run bridge
```

看到类似输出就表示启动成功：

```text
Gemini bridge server listening on http://127.0.0.1:8765
Output root: C:\Users\<you>\Desktop\codex\gemini
```

### 5. 配置 Codex MCP

把 [docs/codex-config.example.toml](/C:/Users/Administrator/Documents/Codex/2026-05-14/files-mentioned-by-the-user-2b4c3e27e6b41e814b72bef38081967d/docs/codex-config.example.toml) 里的内容复制到你的 `C:\Users\<你自己>\.codex\config.toml`，把路径改成你本机项目实际路径。

示例：

```toml
[mcp_servers.gemini-web-bridge]
command = "node"
args = ['C:\path\to\Codex_GeminiTool\src\mcp-server.mjs']
cwd = 'C:\path\to\Codex_GeminiTool'
startup_timeout_sec = 20
```

配完后重启 Codex，或者新开一个 Codex 会话。

### 6. 配置 Codex 自然语言触发词

把仓库里的 [SKILL.md](/C:/Users/Administrator/Documents/Codex/2026-05-14/files-mentioned-by-the-user-2b4c3e27e6b41e814b72bef38081967d/.codex/skills/gemini-web-bridge/SKILL.md) 复制到：

```text
C:\Users\<你自己>\.codex\skills\gemini-web-bridge\SKILL.md
```

如果目录不存在就先创建。复制完成后，重新打开 Codex。

这一步的作用是让 Codex 更容易把下面这类话自动路由到 Gemini：

```text
用gemini问...
用gemini写代码...
用gemini生图...
用gemini生成视频...
```

## 终端快速测试

保持 Gemini 页面打开，保持 `npm run bridge` 在运行，然后在新的 PowerShell 窗口测试。

文本问答：

```powershell
npm run ask -- "你好，简单回复一句话"
```

代码：

```powershell
npm run code -- "写一个 JavaScript 防抖函数"
```

生图：

```powershell
npm run image -- "生成一张未来城市夜景海报，电影感，高质量"
```

视频：

```powershell
npm run video -- "生成一个未来城市日出的镜头，电影感，短视频"
```

## 在 Codex 里的使用方式

MCP 生效后，你可以直接说：

```text
用gemini问你好，简单回复一句话
用gemini写代码写一个 React 登录组件
用gemini生图一张可乐宣传海报，商业广告风格，竖版海报
用gemini生成视频未来城市日出短视频
```

带冒号和不带冒号都可以：

```text
用gemini问：你好，简单回复一句话
用gemini生图：一张未来城市夜景海报
```

如果你想手动走工具名，也可以使用：

- `gemini_status`
- `gemini_ask`
- `gemini_code`
- `gemini_image`
- `gemini_video`

兼容旧名字：

- `gemini_web_status`
- `gemini_web_ask`
- `gemini_web_write_code`
- `gemini_web_generate_image`
- `gemini_web_generate_video`

## 健康检查

检查桥接服务状态：

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

注意：`extensionClients` 为 `0` 也不一定有问题。当前主流程已经切到 Gemini 页面主动轮询，不再依赖旧的 WebSocket 常驻连接。

## 输出行为

- 文本任务会返回可读文本，不是原始 JSON
- 代码任务会返回正文和提取出的代码块
- 图片和视频任务会返回保存后的本地路径
- 默认输出目录是 `Desktop\codex\gemini`

## 可选环境变量

```powershell
$env:GEMINI_BRIDGE_PORT="8765"
$env:GEMINI_BRIDGE_OUTPUT_ROOT="C:\Users\<you>\Desktop\codex\gemini"
$env:GEMINI_BRIDGE_TOKEN="choose-a-local-token"
```

如果设置了 `GEMINI_BRIDGE_TOKEN`，HTTP 调用方需要带上 `x-gemini-bridge-token`。

## 故障排查

### 1. Gemini 页面明明开着，但 Codex 说没连接

先看健康检查：

```powershell
Invoke-RestMethod http://127.0.0.1:8765/health
```

重点看：

```text
geminiPagePollingActive: true
```

如果是 `false`，通常说明：

- Gemini 页面没打开
- 插件没加载成功
- Gemini 标签页没有刷新到最新脚本

### 2. 提示词填进去了，但没有发送

先重新加载插件，再硬刷新 Gemini 页面：

```text
chrome://extensions
Ctrl+Shift+R
```

当前脚本已经优先适配 Gemini 的 Quill 输入框，目标输入区会优先匹配：

```text
DIV role="textbox" aria-label="为 Gemini 输入提示"
```

### 3. 中文提示词变成问号

PowerShell 5.1 下不要自己手写原始 JSON 去调 `Invoke-RestMethod -Body`。

优先用项目内命令：

```powershell
npm run ask -- "中文提示词"
```

### 4. 想确认插件脚本是不是最新版本

打开 Gemini 页面的 DevTools，执行：

```js
document.documentElement.getAttribute('data-gemini-web-bridge-version')
```

当前版本应该类似：

```text
2026-05-14-v8
```

### 5. Codex 里说不了“用gemini...”

确认两件事：

1. `config.toml` 里已经配置了 `gemini-web-bridge` MCP
2. `C:\Users\<你自己>\.codex\skills\gemini-web-bridge\SKILL.md` 已经复制完成

改完后一定要重启 Codex 或新开会话。

## 开发与测试

运行测试：

```powershell
npm test
```

本项目当前技术栈：

- Chrome Manifest V3 插件
- 本地 HTTP Bridge
- MCP Stdio Server
- `@modelcontextprotocol/sdk`
- Node 原生 `node --test`

## 说明

- 这是对正常登录 Gemini 网页会话的自动化调用，只能使用你账号本来就能手动使用的能力。
- 如果 Gemini 网页结构变化，可能需要更新 [content-script.js](/C:/Users/Administrator/Documents/Codex/2026-05-14/files-mentioned-by-the-user-2b4c3e27e6b41e814b72bef38081967d/extension/content-script.js) 里的选择器。
- 代码结果会返回给 Codex 审阅，不会自动写进你的项目文件。
- 图片和视频能否自动落盘，取决于 Gemini 页面当前能否暴露可下载的媒体地址。
