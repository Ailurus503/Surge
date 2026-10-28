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

`HideTopFamily`、`HideTopAge`、`HideTopPhone`、`HideTopNearby`、`HideTopAI`、`HideTopEnterprise` 默认 `false`（保留栏目）；`BottomClean`、`MineClean` 默认 `true`。

## 文件

- [china_mobile_ad.sgmodule](./china_mobile_ad.sgmodule)：远程 Surge 模块，引用本仓库 Raw JavaScript 地址
- [china_mobile_surge.js](../../Script/ChinaMobile/china_mobile_surge.js)：独立的 WebView AES-CBC 脚本

## 测试状态与注意事项

2026-10-29：本地 Node.js 模拟测试共 13 项通过，包含 AES-CBC、MD5、首页、开关、H5、充值、纯 JSON、异常放行。

**尚未在真实 Surge iOS 与中国移动 App 中完成端到端验证。** 需支持 `engine=webview`（Web Crypto API）的 Surge 版本。遇到页面异常或接口错误时先停用本模块，查看 Surge 请求记录和脚本日志。

原始插件由 ccyykk666 提供；本移植并非原作者官方发布，也不会自动跟随上游修改。仅用于个人设备上的响应净化。
