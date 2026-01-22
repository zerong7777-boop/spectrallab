# SpectralLab 项目说明文档

## 项目简介
SpectralLab 是一个基于浏览器的频率域图像分析工具，聚焦图像在频域/系数域的可视化、滤波与重建。当前实现以 Vue 3 + Vite + Tailwind CSS 为前端框架，频域算法以 OpenCV.js（WebAssembly）为核心计算引擎。

项目的核心目标是构建一条完整的“可视化 → 滤波 → 统计 → 重建”闭环，帮助用户在浏览器端完成频域分析实验与交互式探索。

## 技术栈
- **Vue 3**（Composition API + `<script setup>`）
- **Vite 5**（构建与开发）
- **Tailwind CSS v4**（样式）
- **OpenCV.js**（WebAssembly，图像处理与频域计算）

## 核心实现概览
### 1) 图像管理与基础 UI
- 支持多图上传、选择、删除、清空
- 首张图片自动选中
- 空间域视图显示选中图像的基本信息与预览

### 2) DFT/FFT 频域链路（已完成）
- 频谱计算流程：灰度化 → DFT → 幅度 → Log 缩放 → FFT Shift → 归一化 → Canvas 显示
- 频域滤波：低通/高通/带通/带阻（理想/高斯）
- iFFT 重建：支持逆变换，空间域对比显示
- 统计口径：基于 raw 频谱能量（real^2 + imag^2）

### 3) DCT 链路（已完成）
- 2D DCT / iDCT：优先使用 OpenCV.js，若不可用则回退 JS DCT-II / iDCT
- 系数显示：log + normalize
- 系数滤波：低/高/带通/带阻（理想/高斯）
- 统计：基于 raw 系数功率能量（非 display）
- 重建：iDCT 输出对齐原图
- 缓存：DCT 结果 LRU

### 4) DWT 链路（已完成）
- 2D DWT / iDWT：Haar 与 db2，小波层级 1~3
- 系数展示：多层子带拼图（LL/HL/LH/HH）
- 滤波：LL-only、抑制高频、阈值去噪
- 统计：LL 能量 / 高频能量 / 分层能量占比
- 重建：iDWT 回到空间域显示
- 缓存：DWT 结果 LRU

### 5) 交互与稳定性
- 修复切换变换时频域视图不更新的问题
- 统计与显示解耦（统计走 raw，展示走 display）
- 严格的 OpenCV.js 内存管理（`cv.Mat` 手动 `.delete()`）

## 关键文件与模块
- `src/composables/useFrequency.js`
  - 频域/系数域计算主流程与滤波
  - DFT/DCT/DWT 的计算、显示、统计、重建逻辑
- `src/components/FrequencyView.vue`
  - 频域视图与控制面板
- `src/components/SpatialView.vue`
  - 空间域视图
- `src/components/StatisticsPanel.vue`
  - 统计展示
- `src/components/TransformSelector.vue`
  - 变换选择入口
- `src/composables/useOpenCV.js`
  - OpenCV.js 加载与初始化

## 当前进度总结（阶段性）
已完成：
- DFT/FFT、DCT、DWT 的基础链路与展示
- 多种滤波器与参数交互
- iFFT / iDCT / iDWT 重建与空间域对比
- 统计口径统一与展示

已知问题与风险：
- DCT 回退算法为纯 JS，大图性能可能较慢
- DWT 在奇数尺寸图像时会截断到偶数尺寸（需要 UI 提示）
- 统计基于能量归一，存在微小浮点误差

## 未来预期（路线图）
### M3: WPT（Wavelet Packet Transform）
- 分解与重建到 level=3
- packet 节点选择与掩码
- packet 能量直方图与统计

### M4: DT-CWT（Dual-Tree Complex Wavelet Transform）
- 方向选择性子带可视化
- 简单滤波 + 重建
- 标注为实验特性

### 工程增强
- 统计与 mask 的缓存/LRU 细化
- 滑块交互节流优化
- 变换配置与 UI 文案完善

## 使用与运行（摘要）
- 本地开发：`npm ci` → `npm run dev`
- Pages 构建：`npm run build:pages`

## 备注
OpenCV.js 无垃圾回收机制，所有 `cv.Mat` 对象必须手动 `.delete()` 释放内存，避免浏览器内存泄漏。
