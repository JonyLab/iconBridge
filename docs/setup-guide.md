# IconBridge 初次使用配置指南

## 概述

IconBridge 是一款 Figma 插件，帮助设计师将 Figma 中的图标直接同步到 iconfont.cn，无需下载 SVG、手动上传。使用前需要完成两项配置：**部署 CORS 代理** 和 **填写 iconfont Cookie**。

整个过程大约 5 分钟，只需配置一次。

---

## 快速开始（内部用户）

如果你是团队内部成员，可以跳过代理部署，直接使用公共代理：

1. 打开插件 → 点击右上角 ⚙ 设置
2. **代理地址**填入：`https://iconbridge-proxy.example.workers.dev`
3. 填写 iconfont Cookie（参见[第二步](#第二步获取-iconfont-cookie)）
4. 点击保存，完成

> 公共代理仅供团队内部使用。如需自行部署，请继续阅读下方步骤。

---

## 第一步：部署 CORS 代理（Cloudflare Worker）（可选）

如果你不想使用公共代理，可以自行部署。推荐使用 Cloudflare Worker（免费，无需信用卡）。

### 1.1 注册 Cloudflare 账号

访问 [dash.cloudflare.com](https://dash.cloudflare.com)，使用邮箱注册，免费账号即可。

### 1.2 创建 Worker

1. 登录后，左侧菜单点击 **Workers & Pages**
2. 点击 **Create** 按钮
3. 选择 **Create Worker**（注意不是 Pages）
4. 给 Worker 起个名字，例如 `iconbridge-proxy`
5. 点击 **Deploy** 完成初始创建

### 1.3 粘贴代理代码

1. 部署成功后，点击 **Edit code**（编辑代码）
2. **全选**编辑器中已有的内容，**删除**
3. 打开 IconBridge 插件设置页 → 点击"**下载 worker.js**"
4. 用文本编辑器打开下载的 `worker.js`，**全选复制**
5. 粘贴到 Cloudflare 编辑器中
6. 点击右上角 **Deploy**（部署）

### 1.4 复制 Worker 地址

部署成功后，你会看到一个地址，格式如下：

```
https://iconbridge-proxy.你的用户名.workers.dev
```

复制这个地址，后面要用到。

> **免费额度**：每天 100,000 次请求，设计团队日常使用完全够用。
>
> **隐私保障**：你的数据只经过你自己部署的 Worker，不经过任何第三方服务器。

---

## 第二步：获取 iconfont Cookie

IconBridge 需要你的 iconfont.cn 登录凭证（Cookie）来访问你的项目和图标。

### 2.1 获取 Cookie

1. 打开浏览器，访问 [iconfont.cn](https://www.iconfont.cn) 并**登录**
2. 按 **F12**（或右键 → 检查）打开开发者工具
3. 切换到 **Network**（网络）标签页
4. 刷新页面，在请求列表中**随便点一个请求**
5. 在右侧 **Headers**（标头）中找到 **Cookie** 请求头
6. **全选复制** Cookie 的值

Cookie 看起来像这样：
```
cna=xxxxx; ctoken=xxxxx; isg=xxxxx; iconfont_token=xxxxx; ...
```

> **注意**：Cookie 有时效性，过期后需要重新获取并更新。如果插件提示"Cookie 已过期"，重复以上步骤即可。

---

## 第三步：配置 IconBridge 插件

### 3.1 打开插件设置

1. 在 Figma 中运行 IconBridge 插件
2. 点击右上角 **⚙ 设置图标**

### 3.2 填写代理地址

将第一步复制的 Worker 地址粘贴到 **"代理地址"** 输入框中，例如：

```
https://iconbridge-proxy.你的用户名.workers.dev
```

### 3.3 填写 Cookie

将第二步复制的 Cookie 粘贴到 **"iconfont Cookie"** 文本框中。

### 3.4 保存

点击 **保存** 按钮。如果配置正确，插件会自动加载你的 iconfont 项目列表。

---

## 配置完成，开始使用

### 替换图标

1. 在 Figma 画布中**选中一个图标**（Frame、Component、Instance 等均可）
2. 在插件中选择 **iconfont 项目**
3. 在图标列表中点击**要替换的目标图标**
4. 点击 **替换**

替换完成后，iconfont 中该图标的 SVG 会更新，但 `font_class` 和 `unicode` 保持不变，前端代码无需改动。

### 新增图标

1. 在 Figma 画布中**选中一个图标**
2. 切换到 **新增** 标签
3. 输入 `font_class` 名称（如 `icon-home`）
4. 点击 **上传新图标**

提交后需要 iconfont 项目管理员审核通过后生效。

---

## 常见问题

### Q: 提示"Cookie 已过期"怎么办？
重新打开 iconfont.cn → F12 → 复制新的 Cookie → 粘贴到插件设置中保存。

### Q: 提示网络请求失败？
1. 检查代理地址是否填写正确
2. 确认 Cloudflare Worker 已成功部署
3. 尝试在浏览器中直接访问你的 Worker 地址，应该看到一个页面（不是报错）

### Q: 选中了 Figma 图标但插件没反应？
确保选中的是单个节点（Frame、Component、Instance、Group、Vector 等），不要同时选多个。

### Q: 替换后前端代码需要改吗？
不需要。替换只更新 SVG 图形，`font_class` 和 `unicode` 完全保留。

### Q: 新增的图标为什么没有立即出现？
新增图标需要项目管理员审核后才会生效。审核通过后会出现在图标列表中。

### Q: Worker 免费额度够用吗？
Cloudflare Worker 免费套餐提供每天 100,000 次请求。一个 10-50 人的设计团队日常使用完全足够。
