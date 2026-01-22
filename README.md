# SpectralLab

专业的频率域图像分析工具，聚焦图像在频域/系数域的可视化、滤波与重建，支持 DFT/FFT、DCT、DWT 等多条变换链路。

## Live Demo
https://zerong7777-boop.github.io/spectrallab/  
这是 GitHub Pages Project Site（子路径 `/spectrallab/`）。

## Local Development
Node 版本建议：Node 18+（Vite 5 要求）

安装与启动：
```bash
npm ci
npm run dev
```

说明：当前 `vite.config.js` 的 `base` 已硬编码为 `/spectrallab/`，本地开发会走 `/spectrallab/` 子路径。
若需要本地用 `/` 路径访问，可以临时改回 `/` 或使用 `vite --base=/` 启动。

## Build & Pages Deploy
生产构建（用于 Pages）：
```bash
npm run build:pages
```

说明：
- `build:pages` 会强制 `base=/spectrallab/`，保证 `dist/index.html` 引用 `/spectrallab/assets/...`。
- GitHub Actions 会自动：push `main` 触发 build + deploy。
- Guard base：若 `dist/index.html` 不包含 `/spectrallab/assets/` 则失败并阻止发布（见 `.github/workflows/static.yml`）。

## Troubleshooting
- 空白页/404：检查 view-source 是否引用 `/spectrallab/assets/`（而不是 `/assets/`）。
- 检查 Actions 最新 run 是否通过 Guard base。
- （可选）浏览器缓存/代理可能导致看到旧 `index.html`，可用 `?v=123` 强制刷新。

## 功能特性

- ✅ **多图像管理**：上传/选择/删除/清空，首张图片自动选中
- ✅ **多变换链路**：DFT/FFT、DCT、DWT（Haar、db2）
- ✅ **频域/系数域可视化**：Log + normalize，支持 FFT Shift
- ✅ **多种滤波器**：理想/高斯 低通、高通、带通、带阻
- ✅ **重建与对比**：iFFT/iDCT/iDWT 实时重建，空间域对比
- ✅ **统计面板**：基于 raw 能量的统计与占比展示
- ✅ **严格内存管理**：OpenCV.js 对象手动释放

## 技术栈

- **Vue 3** (Composition API + `<script setup>`)
- **Vite 5** - 快速构建工具
- **Tailwind CSS v4** - 样式框架
- **OpenCV.js** (WebAssembly) - 计算机视觉算法

## 开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览生产构建
npm run preview
```

## 项目结构

```
spectrallab/
├── src/
│   ├── components/          # Vue 组件
│   │   ├── SpatialView.vue  # 空间域视图（左侧）
│   │   └── FrequencyView.vue # 频率域视图（右侧）
│   │   ├── StatisticsPanel.vue # 统计面板
│   │   └── TransformSelector.vue # 变换选择
│   ├── composables/         # 组合式函数
│   │   ├── useOpenCV.js     # OpenCV.js 加载管理
│   │   └── useFrequency.js  # 频率域处理逻辑
│   ├── App.vue              # 主应用组件
│   ├── main.js              # 应用入口
│   └── input.css            # Tailwind CSS 入口
├── .cursorrules             # 项目规范和规则
├── vite.config.js           # Vite 配置
└── package.json
```

## 核心算法流程

### DFT/FFT 频域流程
频率域可视化遵循以下标准流程：

1. **灰度化**：转换为 `CV_64F` 单通道
2. **DFT**：使用 `cv.dft` 执行离散傅里叶变换
3. **幅度计算**：从实部和虚部计算幅度
4. **Log 缩放**：应用 `M' = log(1 + M)` 使高频可见
5. **归一化**：归一化到 [0, 255] 用于显示
6. **FFT Shift**：象限交换，使零频率位于中心

### DCT / DWT 概览
- **DCT**：优先 OpenCV.js，失败回退 JS DCT-II / iDCT；系数可视化与滤波一致
- **DWT**：2D DWT / iDWT，多层子带拼图（LL/HL/LH/HH），支持阈值去噪

## 重要注意事项

### OpenCV.js 内存管理

⚠️ **关键规则**：OpenCV.js 没有垃圾回收机制，所有 `cv.Mat` 对象必须手动调用 `.delete()` 释放内存。

```javascript
let mat = new cv.Mat()
try {
  // 操作
} finally {
  mat.delete() // 必须释放！
}
```

### Vue Reactivity 警告

❌ **不要**将 `cv.Mat` 对象包装在 Vue 的 `ref()` 或 `reactive()` 中，这会导致性能问题和错误。

## 当前进度（概览）

已完成：
- DFT/FFT、DCT、DWT 的基础链路与展示
- 多种滤波器与参数交互
- iFFT / iDCT / iDWT 重建与空间域对比
- 统计口径统一与展示

已知问题与风险：
- DCT 回退为纯 JS 时，大图性能可能较慢
- DWT 在奇数尺寸图像时会截断到偶数尺寸（需 UI 提示）
- 统计基于能量归一，存在轻微浮点误差

## 路线图

### M3: WPT（Wavelet Packet Transform）
- 分解与重建到 level=3
- packet 节点选择与掩码
- packet 能量直方图与统计

### M4: DT-CWT（Dual-Tree Complex Wavelet Transform）
- 方向选择性子带可视化
- 简单滤波 + 重建
- 标注为实验特性

## 许可证

MIT

