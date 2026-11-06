# 第三方组件

- [Electron](https://github.com/electron/electron)：MIT；通过 npm 安装，不将运行库提交到源码仓库。
- Electron 内置的 Chromium、Node.js 及其他组件保留各自许可。分发自行打包的程序时，应一并保留 Electron 发行包中的 LICENSE 和 LICENSES.chromium.html。
- 图标生成脚本使用 [Pillow](https://github.com/python-pillow/Pillow)，仅为可选开发工具。

依赖版本以 package-lock.json 为准；应用自己的 LICENSE 不替代第三方组件许可证。
