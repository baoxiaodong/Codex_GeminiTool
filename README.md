# Codex Gemini Tool

璁?Codex 鐩存帴璋冪敤浣犲凡缁忕櫥褰曠殑 Gemini 缃戦〉鐗堬紝鏀寔闂瓟銆佸啓浠ｇ爜銆佺敓鍥俱€佺敓鎴愯棰戙€?
杩欎釜椤圭洰鐢变笁閮ㄥ垎缁勬垚锛?
- 鏈湴妗ユ帴鏈嶅姟锛歚127.0.0.1:8765`
- Chrome 鎻掍欢锛氳礋璐ｆ搷浣?`https://gemini.google.com/app`
- MCP 鏈嶅姟锛氳 Codex 閫氳繃鑷劧璇█鎴?MCP 宸ュ叿璋冪敤 Gemini

瑁呭ソ浠ュ悗锛屼綘鍙互鍦?Codex 閲岀洿鎺ヨ繖鏍疯锛?
```text
鐢╣emini闂綘濂斤紝绠€鍗曞洖澶嶄竴鍙ヨ瘽
鐢╣emini鍐欎唬鐮佸啓涓€涓?React 鐧诲綍缁勪欢
鐢╣emini鐢熷浘涓€寮犳湭鏉ュ煄甯傚鏅捣鎶?鐢╣emini鐢熸垚瑙嗛鏈潵鍩庡競鏃ュ嚭鐭棰?```

## 鍔熻兘

- 璁?Codex 璋?Gemini 缃戦〉鍥炵瓟鏂囨湰闂
- 璁?Codex 璋?Gemini 缃戦〉鍐欎唬鐮?- 璁?Codex 璋?Gemini 缃戦〉鐢熷浘
- 璁?Codex 璋?Gemini 缃戦〉鐢熸垚瑙嗛
- 鎻愪緵鐭埆鍚?MCP 宸ュ叿锛歚gemini_ask`銆乣gemini_code`銆乣gemini_image`銆乣gemini_video`
- 鏀寔鑷劧瑙﹀彂璇嶏細`鐢╣emini闂?..`銆乣鐢╣emini鍐欎唬鐮?..`銆乣鐢╣emini鐢熷浘...`

## 杩愯瑕佹眰

- Windows
- Google Chrome
- Node.js 20 鎴栨洿楂樼増鏈?- 宸茬櫥褰?Gemini 缃戦〉鐗堣处鍙?- 宸插畨瑁呭苟鍚敤 MCP 鐨?Codex

## 椤圭洰缁撴瀯

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

## 瀹夎姝ラ

### 1. 鍏嬮殕浠撳簱

```powershell
git clone https://github.com/baoxiaodong/Codex_GeminiTool.git
cd Codex_GeminiTool
```

### 2. 瀹夎渚濊禆

```powershell
npm install
```

### 3. 鍔犺浇 Chrome 鎻掍欢

1. 鎵撳紑 `chrome://extensions`
2. 寮€鍚彸涓婅 `Developer mode`
3. 鐐瑰嚮 `Load unpacked`
4. 閫夋嫨鏈」鐩殑 `extension` 鐩綍
5. 鎵撳紑 [https://gemini.google.com/app](https://gemini.google.com/app)
6. 纭繚 Gemini 椤甸潰宸茬櫥褰?
### 4. 鍚姩鏈湴妗ユ帴鏈嶅姟

```powershell
npm run bridge
```

鐪嬪埌绫讳技杈撳嚭灏辫〃绀哄惎鍔ㄦ垚鍔燂細

```text
Gemini bridge server listening on http://127.0.0.1:8765
Output root: C:\Users\<you>\Desktop\codex\gemini
```

### 5. 閰嶇疆 Codex MCP

鎶?[docs/codex-config.example.toml](/C:/Users/Administrator/Documents/Codex/2026-05-14/files-mentioned-by-the-user-2b4c3e27e6b41e814b72bef38081967d/docs/codex-config.example.toml) 閲岀殑鍐呭澶嶅埗鍒颁綘鐨?`C:\Users\<浣犺嚜宸?\.codex\config.toml`锛屾妸璺緞鏀规垚浣犳湰鏈洪」鐩疄闄呰矾寰勩€?
绀轰緥锛?
```toml
[mcp_servers.gemini-web-bridge]
command = "node"
args = ['C:\path\to\Codex_GeminiTool\src\mcp-server.mjs']
cwd = 'C:\path\to\Codex_GeminiTool'
startup_timeout_sec = 20
```

閰嶅畬鍚庨噸鍚?Codex锛屾垨鑰呮柊寮€涓€涓?Codex 浼氳瘽銆?
### 6. 閰嶇疆 Codex 鑷劧璇█瑙﹀彂璇?
鎶婁粨搴撻噷鐨?[SKILL.md](/C:/Users/Administrator/Documents/Codex/2026-05-14/files-mentioned-by-the-user-2b4c3e27e6b41e814b72bef38081967d/.codex/skills/gemini-web-bridge/SKILL.md) 澶嶅埗鍒帮細

```text
C:\Users\<浣犺嚜宸?\.codex\skills\gemini-web-bridge\SKILL.md
```

濡傛灉鐩綍涓嶅瓨鍦ㄥ氨鍏堝垱寤恒€傚鍒跺畬鎴愬悗锛岄噸鏂版墦寮€ Codex銆?
杩欎竴姝ョ殑浣滅敤鏄 Codex 鏇村鏄撴妸涓嬮潰杩欑被璇濊嚜鍔ㄨ矾鐢卞埌 Gemini锛?
```text
鐢╣emini闂?..
鐢╣emini鍐欎唬鐮?..
鐢╣emini鐢熷浘...
鐢╣emini鐢熸垚瑙嗛...
```

## 缁堢蹇€熸祴璇?
淇濇寔 Gemini 椤甸潰鎵撳紑锛屼繚鎸?`npm run bridge` 鍦ㄨ繍琛岋紝鐒跺悗鍦ㄦ柊鐨?PowerShell 绐楀彛娴嬭瘯銆?
鏂囨湰闂瓟锛?
```powershell
npm run ask -- "浣犲ソ锛岀畝鍗曞洖澶嶄竴鍙ヨ瘽"
```

浠ｇ爜锛?
```powershell
npm run code -- "鍐欎竴涓?JavaScript 闃叉姈鍑芥暟"
```

鐢熷浘锛?
```powershell
npm run image -- "鐢熸垚涓€寮犳湭鏉ュ煄甯傚鏅捣鎶ワ紝鐢靛奖鎰燂紝楂樿川閲?
```

瑙嗛锛?
```powershell
npm run video -- "鐢熸垚涓€涓湭鏉ュ煄甯傛棩鍑虹殑闀滃ご锛岀數褰辨劅锛岀煭瑙嗛"
```

## 鍦?Codex 閲岀殑浣跨敤鏂瑰紡

MCP 鐢熸晥鍚庯紝浣犲彲浠ョ洿鎺ヨ锛?
```text
鐢╣emini闂綘濂斤紝绠€鍗曞洖澶嶄竴鍙ヨ瘽
鐢╣emini鍐欎唬鐮佸啓涓€涓?React 鐧诲綍缁勪欢
鐢╣emini鐢熷浘涓€寮犲彲涔愬浼犳捣鎶ワ紝鍟嗕笟骞垮憡椋庢牸锛岀珫鐗堟捣鎶?鐢╣emini鐢熸垚瑙嗛鏈潵鍩庡競鏃ュ嚭鐭棰?```

甯﹀啋鍙峰拰涓嶅甫鍐掑彿閮藉彲浠ワ細

```text
鐢╣emini闂細浣犲ソ锛岀畝鍗曞洖澶嶄竴鍙ヨ瘽
鐢╣emini鐢熷浘锛氫竴寮犳湭鏉ュ煄甯傚鏅捣鎶?```

濡傛灉浣犳兂鎵嬪姩璧板伐鍏峰悕锛屼篃鍙互浣跨敤锛?
- `gemini_status`
- `gemini_ask`
- `gemini_code`
- `gemini_image`
- `gemini_video`

鍏煎鏃у悕瀛楋細

- `gemini_web_status`
- `gemini_web_ask`
- `gemini_web_write_code`
- `gemini_web_generate_image`
- `gemini_web_generate_video`

## 鍋ュ悍妫€鏌?
妫€鏌ユˉ鎺ユ湇鍔＄姸鎬侊細

```powershell
Invoke-RestMethod http://127.0.0.1:8765/health
```

鍏抽敭瀛楁锛?
```text
ok: true
bridge: gemini-web-bridge
polling: true
geminiPagePollingActive: true
```

娉ㄦ剰锛歚extensionClients` 涓?`0` 涔熶笉涓€瀹氭湁闂銆傚綋鍓嶄富娴佺▼宸茬粡鍒囧埌 Gemini 椤甸潰涓诲姩杞锛屼笉鍐嶄緷璧栨棫鐨?WebSocket 甯搁┗杩炴帴銆?
## 杈撳嚭琛屼负

- 鏂囨湰浠诲姟浼氳繑鍥炲彲璇绘枃鏈紝涓嶆槸鍘熷 JSON
- 浠ｇ爜浠诲姟浼氳繑鍥炴鏂囧拰鎻愬彇鍑虹殑浠ｇ爜鍧?- 鍥剧墖浠诲姟浼氭妸 Gemini 椤甸潰閲岀殑鍥剧墖杞垚 `dataUrl` 鍥炰紶缁?MCP锛孋odex 鐣岄潰鍙洿鎺ユ帴鏀跺浘鐗囷紱鍚屾椂妗ユ帴鏈嶅姟浼氭妸鍥剧墖淇濆瓨鎴愭湰鍦版枃浠惰矾寰?- 瑙嗛浠诲姟浼氳繑鍥炴彁鍙栧埌鐨勮棰戝湴鍧€锛涘鏋滈〉闈㈡彁渚涘彲涓嬭浇鍦板潃锛孋hrome 鎻掍欢涔熶細灏濊瘯涓嬭浇
- MCP 里的问答/代码/图片/视频工具默认使用快速异步提交，避免 Codex 工具调用层卡住；先快速拿到 `task-xxxxxx`，再用 `gemini_get_task` 查询最终结果。
- 榛樿杈撳嚭鐩綍鏄?`Desktop\codex\gemini`

## 鍙€夌幆澧冨彉閲?
```powershell
$env:GEMINI_BRIDGE_PORT="8765"
$env:GEMINI_BRIDGE_OUTPUT_ROOT="C:\Users\<you>\Desktop\codex\gemini"
$env:GEMINI_BRIDGE_TOKEN="choose-a-local-token"
```

濡傛灉璁剧疆浜?`GEMINI_BRIDGE_TOKEN`锛孒TTP 璋冪敤鏂归渶瑕佸甫涓?`x-gemini-bridge-token`銆?
## 鏁呴殰鎺掓煡

### 1. Gemini 椤甸潰鏄庢槑寮€鐫€锛屼絾 Codex 璇存病杩炴帴

鍏堢湅鍋ュ悍妫€鏌ワ細

```powershell
Invoke-RestMethod http://127.0.0.1:8765/health
```

閲嶇偣鐪嬶細

```text
geminiPagePollingActive: true
```

濡傛灉鏄?`false`锛岄€氬父璇存槑锛?
- Gemini 椤甸潰娌℃墦寮€
- 鎻掍欢娌″姞杞芥垚鍔?- Gemini 鏍囩椤垫病鏈夊埛鏂板埌鏈€鏂拌剼鏈?
### 2. 鎻愮ず璇嶅～杩涘幓浜嗭紝浣嗘病鏈夊彂閫?
鍏堥噸鏂板姞杞芥彃浠讹紝鍐嶇‖鍒锋柊 Gemini 椤甸潰锛?
```text
chrome://extensions
Ctrl+Shift+R
```

褰撳墠鑴氭湰宸茬粡浼樺厛閫傞厤 Gemini 鐨?Quill 杈撳叆妗嗭紝鐩爣杈撳叆鍖轰細浼樺厛鍖归厤锛?
```text
DIV role="textbox" aria-label="涓?Gemini 杈撳叆鎻愮ず"
```

### 3. 涓枃鎻愮ず璇嶅彉鎴愰棶鍙?
PowerShell 5.1 涓嬩笉瑕佽嚜宸辨墜鍐欏師濮?JSON 鍘昏皟 `Invoke-RestMethod -Body`銆?
浼樺厛鐢ㄩ」鐩唴鍛戒护锛?
```powershell
npm run ask -- "涓枃鎻愮ず璇?
```

### 4. 鎯崇‘璁ゆ彃浠惰剼鏈槸涓嶆槸鏈€鏂扮増鏈?
鎵撳紑 Gemini 椤甸潰鐨?DevTools锛屾墽琛岋細

```js
document.documentElement.getAttribute('data-gemini-web-bridge-version')
```

褰撳墠鐗堟湰搴旇绫讳技锛?
```text
2026-05-18-v19
```

如果 `/health` 里显示 `expectedGeminiScriptVersion: 2026-05-18-v19`，但 `lastIgnoredGeminiScriptVersion`
仍是旧版本（例如 `2026-05-18-v17`），并且 `geminiPagePollingActive: false`，说明 Chrome 里还有旧
content-script 在轮询。请先在 `chrome://extensions` 点击本插件的重新加载按钮，再刷新 Gemini 页面。
旧脚本会被桥接服务拒绝，不会再抢走新任务。

### 5. Codex 閲岃涓嶄簡鈥滅敤gemini...鈥?
纭涓や欢浜嬶細

1. `config.toml` 閲屽凡缁忛厤缃簡 `gemini-web-bridge` MCP
2. `C:\Users\<浣犺嚜宸?\.codex\skills\gemini-web-bridge\SKILL.md` 宸茬粡澶嶅埗瀹屾垚

鏀瑰畬鍚庝竴瀹氳閲嶅惎 Codex 鎴栨柊寮€浼氳瘽銆?
## 寮€鍙戜笌娴嬭瘯

杩愯娴嬭瘯锛?
```powershell
npm test
```

鏈」鐩綋鍓嶆妧鏈爤锛?
- Chrome Manifest V3 鎻掍欢
- 鏈湴 HTTP Bridge
- MCP Stdio Server
- `@modelcontextprotocol/sdk`
- Node 鍘熺敓 `node --test`

## 璇存槑

- 杩欐槸瀵规甯哥櫥褰?Gemini 缃戦〉浼氳瘽鐨勮嚜鍔ㄥ寲璋冪敤锛屽彧鑳戒娇鐢ㄤ綘璐﹀彿鏈潵灏辫兘鎵嬪姩浣跨敤鐨勮兘鍔涖€?- 濡傛灉 Gemini 缃戦〉缁撴瀯鍙樺寲锛屽彲鑳介渶瑕佹洿鏂?[content-script.js](/C:/Users/Administrator/Documents/Codex/2026-05-14/files-mentioned-by-the-user-2b4c3e27e6b41e814b72bef38081967d/extension/content-script.js) 閲岀殑閫夋嫨鍣ㄣ€?- 浠ｇ爜缁撴灉浼氳繑鍥炵粰 Codex 瀹￠槄锛屼笉浼氳嚜鍔ㄥ啓杩涗綘鐨勯」鐩枃浠躲€?- 鍥剧墖鍜岃棰戣兘鍚﹁嚜鍔ㄨ惤鐩橈紝鍙栧喅浜?Gemini 椤甸潰褰撳墠鑳藉惁鏆撮湶鍙笅杞界殑濯掍綋鍦板潃銆?
