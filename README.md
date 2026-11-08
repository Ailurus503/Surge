# Surge

自用 Surge iOS 脚本与模块仓库，统一维护于 `Ailurus503/Surge`。

## 目录

- [Script/Vae+_Checkin](./Script/Vae%2B_Checkin)：Vae+ 授权捕获与自动签到脚本
- [Module/TxvideoAD](./Module/TxvideoAD)：腾讯视频净化模块（JS 使用外部 Surge 兼容脚本）

## Vae+ 脚本地址

- 获取授权：https://raw.githubusercontent.com/Ailurus503/Surge/main/Script/Vae%2B_Checkin/Vae%2B_GetAuth.js
- 自动签到：https://raw.githubusercontent.com/Ailurus503/Surge/main/Script/Vae%2B_Checkin/Vae_AutoSign.js

如果 Surge 中仍使用旧仓库 `Ailurus503/Script` 的地址，请替换为上面的新 Raw 地址。现有 Vae+ 脚本逻辑保持不变。

## 腾讯视频净化

- 模块：https://raw.githubusercontent.com/Ailurus503/Surge/main/Module/TxvideoAD/TxvideoAD_Surge.sgmodule
- 上游规则：https://raw.githubusercontent.com/ZenMoFeiShi/Qx/refs/heads/main/TxvideoAD.snippet
- Surge 兼容 JS（由 RoaycL/Surge 托管）：https://raw.githubusercontent.com/RoaycL/Surge/main/JS/Txvideoad.surge.js

本仓库仅维护模块配置，不复制或维护第三方 JS。

## 仓库组织约定

- `Script/`：独立脚本
- `Module/`：Surge 模块；模块所需的第三方脚本优先引用原作者或维护者的公开地址
