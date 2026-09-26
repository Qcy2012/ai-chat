# Cloudflare Workers AI 零密钥聊天助手

> ✅ **不需要任何API密钥，不需要实名认证，不需要信用卡，注册Cloudflare账号就能直接部署！**

基于 Cloudflare Pages + Workers AI + Next.js 搭建的在线AI聊天网站，全程零外部依赖，免费额度完全足够个人使用。

## 🚀 核心优势

- **零密钥**：直接调用同账号下Workers AI，不需要配置任何第三方API密钥
- **免实名**：只用注册Cloudflare账号，不需要国内平台的身份证/人脸认证
- **零成本**：Cloudflare Pages和Workers AI个人免费额度完全够用
- **全球CDN**：自动部署到全球300+边缘节点，访问速度极快
- **VSCode深色主题**：熟悉的代码编辑器风格，护眼舒适
- **流式输出**：打字机效果，实时响应

## 📦 快速部署（5分钟上线）

### 方式一：直接连接GitHub部署（推荐）

1. 把本项目代码推送到你自己的GitHub仓库
2. 登录 [Cloudflare控制台](https://dash.cloudflare.com/)，进入 **Workers & Pages** → **创建应用程序** → **Pages** → **连接到Git**
3. 选择你刚推送的仓库，构建设置如下：
   - **框架预设**：`Next.js`
   - **构建命令**：`npm run build`
   - **构建输出目录**：`.open-next`
   - **环境变量**：添加 `NODE_VERSION=20`
4. 点击 **保存并部署**，等待2分钟即可上线！

### 方式二：本地命令行部署

```bash
# 1. 安装依赖
npm install

# 2. 本地预览测试
npm run dev

# 3. 登录Cloudflare（会自动打开浏览器授权）
npx wrangler login

# 4. 一键部署
npm run deploy
```

## 🎯 可选模型切换

在 `app/api/chat/route.ts` 中可以自由切换Workers AI支持的开源模型：

| 模型ID | 特点 |
|--------|------|
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | **默认**，效果均衡，速度快 |
| `@cf/meta/llama-4-scout-17b-16e-instruct` | Llama 4最新小模型，速度极快 |
| `@cf/deepseek-ai/deepseek-r1-distill-qwen-32b` | 推理能力强，适合代码、数学题 |
| `@cf/glm/glm-4.5-air` | 智谱开源版，中文效果更好 |
| `@cf/qwen/qwen2.5-coder-32b-instruct` | 代码专用模型，Debug写代码首选 |

完整模型列表可以在 [Cloudflare Workers AI 模型目录](https://developers.cloudflare.com/workers-ai/models/) 查看，全部免费可用。

## 🔧 本地开发

```bash
npm run dev
```

打开 http://localhost:3000 即可预览，修改代码会自动热更新。

## 📝 项目结构

```
cloudflare-wai-chat/
├── app/
│   ├── api/chat/route.ts   # AI接口，直接调用Workers AI，零密钥
│   ├── globals.css         # 全局样式（VSCode深色主题）
│   ├── layout.tsx          # 页面布局
│   └── page.tsx            # 聊天主界面
├── wrangler.toml           # Cloudflare配置
├── next.config.js          # Next.js配置
├── tailwind.config.js      # Tailwind主题配置
└── package.json            # 依赖配置
```

## ✨ 进阶扩展建议

1. **添加对话历史**：接入Cloudflare D1免费数据库，保存用户聊天记录
2. **多模型切换**：在界面上加模型选择下拉框，让用户自由选模型
3. **密码保护**：加一个简单的Basic Auth，只有知道密码的人能访问
4. **代码解释器**：复用你之前写的在线IDE，让AI生成的代码可以直接运行
5. **多模态支持**：接入图片/文件上传，让AI能分析图片和文档

## ⚠️ 注意事项

1. 免费额度有每日调用限制，个人使用完全够用，不要做大规模公开服务
2. 不要在对话中发送敏感内容，数据会经过Cloudflare处理
3. 如果需要更强的中文能力，可以后续实名智谱AI，增加一个备用模型接口
4. 部署完成后可以在Pages设置里绑定自己的自定义域名，自动配HTTPS
