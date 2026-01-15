# SpectralLab 项目概览与当前实现

## 项目简介
SpectralLab 是一个基于浏览器的频率域图像分析工具，提供图像上传、空间域展示与频谱可视化能力。当前实现聚焦于 DFT/FFT 的频谱渲染与基础交互体验。

## 技术栈
- Vue 3（Composition API + `<script setup>`）
- Vite
- Tailwind CSS
- OpenCV.js（WebAssembly）

## 当前实现
- 图像库：支持多图上传、选择、删除、清空，首张自动选中。
- 空间域视图：展示选中图像的基本信息与预览。
- 频率域视图：对选中图像执行 DFT 频谱计算，渲染 Log-Magnitude 频谱图（零频率移到中心）。
- 变换选择：目前仅 DFT 实现，其他变换为占位。
- 统计面板：频域统计占位（暂未实现实际计算）。
- OpenCV.js：运行时动态加载并检测准备状态。

## 关键实现点
- 频谱计算流程：灰度化 -> 最佳 DFT 尺寸填充 -> DFT -> 幅度 -> Log 缩放 -> FFT Shift -> 归一化 -> Canvas 显示。
- 内存管理：所有 `cv.Mat` 对象手动 `.delete()` 释放，避免内存泄漏。
- 频谱渲染：使用 `cv.imshow` 绘制到 Canvas。

## 运行方式
```bash
npm install
npm run dev
```

## 已知限制与待办
- DCT/iFFT 等其他变换尚未实现。
- 频域统计为占位，没有真实指标计算。
- 频谱交互（频域滤波、逆变换回空间域）尚未实现。
*** End Patch}>=json code
