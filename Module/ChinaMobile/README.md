# 中国移动去广告（Surge iOS 移植版）

基于 [ccyykk666 的 Loon 插件](https://github.com/ccyykk666/Loon-Plugin/blob/main/plugins/china-mobile/china_mobile_ad.plugin) 适配 Surge iOS。向原作者致谢。本目录为非官方移植测试版。

## 一键安装

在 Surge iOS 的「模块」中通过 URL 安装：

```
https://raw.githubusercontent.com/Ailurus503/Surge/main/Module/ChinaMobile/china_mobile_ad.sgmodule
```

安装后启用模块、HTTP 重写、HTTPS 解密（MITM）；请先确保 Surge 证书已安装并信任。模块会追加所需的 5 个 MITM 域名。

## 主要功能

- 启动广告接口本地拦截（HTTP 200 + `{}`）
- 首页、搜索热词、服务页、底栏、我的页面广告净化
- 消息、优惠券、充值页面广告内容过滤
- 顶栏隐藏爱家、网龄、手机、附近厅、AI、政企等可选开关
- 原插件 AES-CBC 响应解密、重新加密与 `r-token` MD5 签名；解密失败时原样放行

## 开关参数

Surge 使用原生模块参数表（`#!arguments`），与 Loon 的 `[Argument]` 图形化滑动开关不同。请在 Surge 已安装模块上**长按 → 编辑参数**，按下表填写 `true`（开启）或 `false`（关闭）：

| 参数名 | 功能 | 默认值 |
| --- | --- | --- |
| `HideTopFamily` | 隐藏顶部“爱家” | `false` |
| `HideTopAge` | 隐藏顶部“网龄” | `false` |
| `HideTopPhone` | 隐藏顶部“手机” | `false` |
| `HideTopNearby` | 隐藏顶部“附近厅” | `false` |
| `HideTopAI` | 隐藏顶部“AI” | `false` |
| `HideTopEnterprise` | 隐藏顶部“政企” | `false` |
| `BottomClean` | 底部导航净化 | `true` |
| `MineClean` | “我的”页面净化 | `true` |
| `Diagnostic` | 安全诊断日志（排查后可关闭） | `true` |

注意：Surge 参数表不等同于 Loon 的带开关和逐项标签的可视化配置界面。

## 文件

- [china_mobile_ad.sgmodule](./china_mobile_ad.sgmodule)：远程 Surge 模块，引用本仓库 Raw JavaScript 地址
- [china_mobile_surge.js](./china_mobile_surge.js)：独立的 WebView AES-CBC 脚本

## 修订版诊断指南（2026-10-29）

原移植版的模拟测试无法证明 Surge 实际解密和拦截成功。此修订版保留原先的 AES / 广告过滤逻辑，并提高响应处理上限至 2 MiB（过大的响应仍会跳过）。

1. Surge 中更新本模块（不是仅在 GitHub 更新）；确认模块、脚本、HTTPS 解密、重写均开启，且已信任 Surge MITM 证书
2. 关闭中国移动 App 后重新打开，进入首页、我的、充值等页面
3. 打开 Surge **请求记录 → 对应 `client.app.coc.10086.cn` 等请求 → Notes（备注）**，查找 `[ChinaMobile/diag]`；也可在 Surge 脚本日志查看
4. `started status=200`：脚本有执行；`modified:`：已返回修改结果；`passthrough:`：脚本原样放行，后缀说明原因
5. **请求根本没有日志**：优先检查 MITM、脚本开关、模块冲突、是否命中 URL、是否超过响应大小限制。Surge 只运行首个命中的 response 脚本

只分享 **`[ChinaMobile/diag]` 前缀的日志及必要的请求状态**。请不要分享 Cookie、Authorization、手机号、请求/响应完整正文或完整请求头。诊断完成后将 `Diagnostic=false`，并视需要去除模块中 `debug=true`。

## 测试状态与注意事项

2026-10-29：本地 Node.js 模拟测试 13 项通过；另通过 URL 正则与日志模拟测试。模拟测试不等于真实 Surge iOS 端到端验证。

**尚未在真实 Surge iOS 与中国移动 App 中完成端到端验证。** 需支持 `engine=webview`（Web Crypto API）的 Surge 版本。遇到页面异常或接口错误时先停用本模块，查看 Surge 请求记录和脚本日志。

原始插件由 ccyykk666 提供；本移植并非原作者官方发布，也不会自动跟随上游修改。仅用于个人设备上的响应净化。
