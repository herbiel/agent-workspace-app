# CallFlow Agent Workspace

坐坐席工作台（基于 Webitel agent-workspace-app 壳子改造），浏览器内嵌软电话，对接 **比例外呼 (progressive)** / **预测外呼 (predictive)**。

## Softphone (JsSIP + WSS)

对齐 `pesoq-admin` 的 `TelephoneN1` / `autodialTelephone` 思路：

- 浏览器经 **WSS** 注册到 FreeSWITCH
- `sipDomain` 用 FS directory 域（常为内网 IP），可与 WSS 主机名不同
- **WSS 可自行配置**（`.env` / Calls 页 Settings / `localStorage`）

### 配置优先级

1. Calls 页 Softphone / WSS 表单（写入 `localStorage` key `callflow-softphone-profile`）
2. `VITE_SIP_*` 环境变量
3. 代码默认值（lab: `192.168.50.54:7443`）

| 变量 | 说明 |
|------|------|
| `VITE_SIP_WSS_URL` | 完整 WSS，如 `wss://192.168.50.54:7443`（有值则覆盖 host/port） |
| `VITE_SIP_WSS_HOST` / `VITE_SIP_WSS_PORT` | WSS 主机与端口 |
| `VITE_SIP_DOMAIN` | SIP REGISTER 域 |
| `VITE_SIP_ACCOUNT` / `VITE_SIP_PASSWORD` | 分机与密码 |
| `VITE_SIP_STUN` | STUN 列表，逗号分隔；内网联调可留空 |
| `VITE_SIP_AUTO_ANSWER` | 预测/比例桥接后是否自动接听（默认 true） |

### 本地跑

```bash
npm install
# 在 .env.development 填好 VITE_SIP_* 与密码
npm run dev
```

默认 `VITE_SKIP_AUTH=true`，**不会跳转到 test.webitel.me 登录**，直接进工作台测软电话。  
需要接真 Webitel 时改成 `false`。

打开 **http://localhost:5173/agent-workspace/calls**：填 WSS → Save & go Online → 等 SIP registered。  
go-dialer 把客户腿 bridge 到 `user/{account}` 后，工作台响铃（可自动接）。

### 与 go-dialer

- 坐席 ready：软电话 Sofia 注册后由 dialer ESL presence 同步（也可后续再调 `PUT /v1/skill-groups/.../agents/{id}`）
- progressive：先占坐席再外呼，坐席侧可能先听到振铃/回铃
- predictive：客户接通后再 bridge，坐席侧多为突如其来电；建议开 auto-answer

## Dev notes

原 Webitel 聊天 / WS 壳仍在；话路已不依赖 `webitel-sdk`，改走 JsSIP。
