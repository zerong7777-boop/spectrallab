# SpectralLab

专业的频率域图像分析工具，用于实时 FFT（快速傅里叶变换）、频率滤波和 iFFT（逆 FFT）重建。

## 功能特性

- ✅ **实时 FFT 计算**：上传图片后自动计算频率域频谱
- ✅ **Log-Magnitude 可视化**：使用对数缩放使高频分量可见
- ✅ **FFT Shift**：零频率（DC 分量）位于频谱图中心
- ✅ **科学深色主题**：专业的视觉设计
- ✅ **OpenCV.js 内存管理**：严格的内存管理，防止浏览器崩溃

## 技术栈

- **Vue 3** (Composition API + `<script setup>`)
- **Vite** - 快速构建工具
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

频率域可视化遵循以下标准流程：

1. **灰度化**：转换为 `CV_64F` 单通道
2. **DFT**：使用 `cv.dft` 执行离散傅里叶变换
3. **幅度计算**：从实部和虚部计算幅度
4. **Log 缩放**：应用 `M' = log(1 + M)` 使高频可见
5. **归一化**：归一化到 [0, 255] 用于显示
6. **FFT Shift**：象限交换，使零频率位于中心

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

## 路线图

### Phase 1: Setup ✅
- [x] 初始化 Vue + Tailwind
- [x] 创建 `useOpenCV` hook

### Phase 2: Core FFT ✅
- [x] 实现 `SpatialView` 和 `FrequencyView`
- [x] 实现 `fftShift` 算法
- [x] 渲染 Log-Magnitude 频谱到 Canvas

### Phase 3: Filtering (待实现)
- [ ] 实现逆 DFT (iFFT) 重建图像
- [ ] 创建掩码生成器（圆形理想/高斯滤波器）
- [ ] 实时交互：修改频谱 -> iFFT -> 更新空间域视图

## 许可证

MIT

