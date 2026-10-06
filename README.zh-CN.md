<p align="center">
  <img src="iconbridgelogo.png" width="80" height="80" alt="IconBridge Logo" />
</p>

<h1 align="center">IconBridge</h1>

<p align="center">
  Figma 插件 —— 在 Figma 与 iconfont.cn 之间浏览、替换和同步图标
</p>

<p align="center">
  <a href="README.md">English</a> | 简体中文
</p>

---

## 功能

- **浏览与搜索** —— 在 Figma 内直接浏览 iconfont.cn 项目中的图标，按 font class 即时搜索
- **拖入画布** —— 从面板把图标拖到 Figma 画布上，生成 48×48 的 SVG Frame
- **放入画布** —— 选中图标后点击「放入 Figma」，放置到当前视口中心
- **替换图标** —— 用 Figma 中更新后的设计替换 iconfont 图标，保留 font class 和 unicode
- **上传图标** —— 将 Figma 中的新图标上传到 iconfont 项目（支持批量），保留你填写的 font class 作为图标名，不会被自动命名为 `iconN`
- **去色 / 原色模式** —— 替换或上传时可切换「去色」（统一为单一 `fill="currentColor"`）或「原色」（保留原始填充色及透明度），带实时预览，并记住你的选择
- **右键去色** —— 在图标库中右键任意图标，可将已有的彩色图标直接转为单色
- **审核中图标** —— 仍在审核中的图标会带角标显示在图标库顶部；上传后列表自动刷新
- **明暗主题** —— 插件界面支持浅色 / 深色切换
- **中英双语** —— 可在设置中切换中文 / English

## 安装

### 从 Figma 社区安装（审核中）

在 Figma 插件中搜索 **IconBridge**。

### 本地安装

```bash
git clone https://github.com/JonyLab/iconBridge.git
```

1. 打开 Figma 桌面端
2. 进入 **Plugins → Development → Import plugin from manifest...**
3. 选择克隆目录中的 `manifest.json`

## 配置

插件连接 iconfont.cn 需要完成两项配置。更详细的图文步骤见 [docs/setup-guide.md](docs/setup-guide.md)。

### 1. iconfont Cookie

1. 打开 [iconfont.cn](https://www.iconfont.cn) 并登录
2. 打开开发者工具（F12）→ Network 面板
3. 从任意请求中复制 `Cookie` 请求头
4. 粘贴到插件设置（齿轮图标）中

### 2. CORS 代理

Figma 插件运行在 iframe 沙箱中，需要通过 CORS 代理访问 iconfont.cn。有两种方式：

**方式 A：Cloudflare Worker（推荐）**

1. 登录 [dash.cloudflare.com](https://dash.cloudflare.com)
2. Workers & Pages → Create → Create Worker
3. 选择「Hello World」模板并部署
4. 编辑代码 → 粘贴 `worker.js` 的内容 → 部署
5. 将 Worker 地址（如 `https://xxx.workers.dev`）填入插件设置

> 免费额度：每天 100,000 次请求，对设计团队来说绰绰有余。

**方式 B：本地代理（开发用）**

```bash
node proxy.js
```

运行在 `http://localhost:17788`。插件设置中代理地址留空即自动使用本地代理。

## 隐私

你的 iconfont Cookie 仅保存在 Figma 本地的 `clientStorage` 中，只会发送到你自己的代理服务器，不经过任何第三方服务。

## 技术栈

- 原生 HTML/CSS/JS（无需构建）
- Figma Plugin API
- Cloudflare Workers（可选的 CORS 代理）

## 许可证

MIT
