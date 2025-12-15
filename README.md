# Nano Emoji Meme Generator

这是一个基于 Vue 3 和 Vite 构建的表情包生成网站，采用独特的 Neu-Brutalism（新野兽派）设计风格。用户可以通过输入主题关键词并上传参考角色图，生成 Q 版 LINE 风格的表情包，并支持自定义切割和批量下载。

## ✨ 特性

- **Neu-Brutalism 风格界面**：高对比度配色、粗边框、硬阴影，视觉冲击力强。
- **AI 表情包生成**：
  - 输入主题关键词（自动替换 Prompt）。
  - 上传参考角色图（支持 JPG/PNG）。
  - 调用 `nano-banana-pro` 模型生成 Q 版、彩色手绘风格的表情包。
- **流式响应处理**：实时处理 API 返回的 SSE 流式数据。
- **图片切割工具**：
  - 支持在生成结果上自由添加水平线和垂直线。
  - 拖拽调整分割线位置。
- **批量下载**：将切割后的图片自动打包为 ZIP 文件下载。

## 🛠 技术栈

- **前端框架**：[Vue 3](https://vuejs.org/) (Script Setup + TypeScript)
- **构建工具**：[Vite](https://vitejs.dev/)
- **UI 组件库**：[Element Plus](https://element-plus.org/)
- **HTTP 客户端**：[Axios](https://axios-http.com/)
- **工具库**：
  - `jszip`: 用于打包下载文件。
  - `file-saver`: 用于保存文件。

## 🚀 快速开始

### 1. 环境准备

确保你的本地环境已安装 [Node.js](https://nodejs.org/) (推荐 v16+)。

### 2. 安装依赖

```bash
npm install
```

### 3. 启动开发服务器

```bash
npm run dev
```

启动后，访问终端输出的本地地址（通常是 `http://localhost:5173/`）。

## 📖 使用指南

1.  **配置**：
    - 在左侧面板输入 **主题关键词**（例如：“猫咪”、“程序员”）。
    - 点击“选择图片”上传一张参考角色图。
2.  **生成**：
    - 点击“开始生成”按钮。
    - 等待 AI 生成图片，生成过程中的状态会实时反馈。
3.  **切割与下载**：
    - 图片生成后会显示在右侧面板。
    - 点击“添加水平线”或“添加垂直线”在图片上增加分割线。
    - 拖动粉色分割线调整切割位置。
    - 点击“切割并下载”，系统会将图片按分割区域切片并打包下载。

## 📂 项目结构

```
nano_emoji/
├── public/
├── src/
│   ├── assets/
│   ├── components/
│   │   └── MemeGenerator.vue  # 核心组件
│   ├── App.vue                # 根组件
│   ├── main.ts                # 入口文件
│   └── style.css              # 全局样式
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## 📄 License

MIT
