# 课题备忘 · Research Memo

面向课题、成员和任务管理的轻量 Windows 桌面备忘录，采用 Electron，支持半透明浮层和托盘常驻。

A local-first desktop memo for research projects, team members and tasks.

## 功能

- 管理成员、任务、优先级、截止时间和任务进展。
- 可折叠窗口、托盘显示/隐藏、窗口位置记忆。
- 本地 JSON 保存；可通过托盘菜单选择开机启动。

## 安装与运行

需要 Windows、Node.js 22 或更高版本以及 npm。在下载并解压本仓库后打开终端：

```powershell
npm ci
npm start
```

依赖安装完成后，也可双击 `launch.vbs` 静默启动。`assets` 中已包含运行需要的图标；只有重新生成图标时才需要 Python 和 Pillow。

## 数据与备份

任务数据保存在 Electron 的用户数据目录 `data.json` 中；Windows 默认通常为 `%APPDATA%\pi-memo\data.json`。
窗口位置和启动偏好分别写入程序目录下的 `window-state.json` 和 `settings.json`。
备份前请退出应用，并复制上述文件。公开仓库不包含真实成员、课题任务、数据文件或本机设置。

## 开发验证

```powershell
npm run check
```

此检查验证 JavaScript 语法。首次公开版本未提供自动化端到端界面测试；请在 Windows 桌面环境手动检查新增任务、保存后重开及托盘操作。

## 许可与反馈

项目代码采用 [MIT](LICENSE)。Electron 及其 Chromium/Node.js 组件遵守各自上游许可证，见 [第三方说明](THIRD_PARTY_NOTICES.md)。
贡献与问题报告见 [CONTRIBUTING.md](CONTRIBUTING.md)。
