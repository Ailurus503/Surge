# Surge

自用 Surge iOS 脚本与模块仓库，统一维护于 `Ailurus503/Surge`。

## 目录

- [Script/Vae+_Checkin](./Script/Vae%2B_Checkin)：Vae+ 授权捕获与自动签到脚本
- [Script/ChinaMobile](./Script/ChinaMobile)：中国移动广告净化脚本
- [Module/ChinaMobile](./Module/ChinaMobile)：中国移动去广告 Surge 模块及说明

## 中国移动模块安装

在 Surge iOS 的「模块」中通过 URL 导入：

```text
https://raw.githubusercontent.com/Ailurus503/Surge/main/Module/ChinaMobile/china_mobile_ad.sgmodule
```

确保 Surge 已配置 HTTPS 解密并信任证书。此模块为移植测试版，尚未在真实中国移动 App 中完成端到端测试。

## Vae+ 脚本地址

- 获取授权：https://raw.githubusercontent.com/Ailurus503/Surge/main/Script/Vae%2B_Checkin/Vae%2B_GetAuth.js
- 自动签到：https://raw.githubusercontent.com/Ailurus503/Surge/main/Script/Vae%2B_Checkin/Vae_AutoSign.js

迁移后请检查 Surge 里已有的 script-path 是否仍指向旧仓库 `Ailurus503/Script`，如是，请更新为上面的新地址。现有脚本逻辑保持原样。
