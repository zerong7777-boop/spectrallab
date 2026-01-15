# SpectralLab 阶段性回顾与进度总结

## 概览
本阶段目标是将频域分析扩展为可配置的变换后端，并形成统一的“可视化-滤波-统计-重建”闭环。当前已完成 DFT、DCT、DWT 的基础链路搭建，并修复了关键交互问题与统计口径问题。

## 已完成事项
### 1) DFT/FFT 频域链路
- DFT 频谱显示：log-magnitude + shift + normalize
- 频域滤波：低通/高通/带通/带阻（理想/高斯）
- iFFT 重建：支持逆变换并在空间域对比
- 统计：基于 raw 频谱能量（real^2 + imag^2）

### 2) DCT 链路（M1）
- 2D DCT / iDCT：优先使用 OpenCV.js，否则回退 JS DCT-II / iDCT
- 系数显示：log + normalize 用于展示
- 系数滤波：低/高/带通/带阻（理想/高斯）
- 统计：基于 raw 系数功率能量（非 display）
- 重建：iDCT 输出对齐原图
- 缓存：DCT 结果缓存（LRU）

### 3) DWT 链路（M2）
- 2D DWT / iDWT：Haar 与 db2，小波层级 1~3
- 系数展示：多层子带拼图（LL/HL/LH/HH）
- 滤波：LL-only、抑制高频、阈值去噪
- 统计：LL 能量 / 高频能量 / 分层能量占比
- 重建：iDWT 回到空间域显示
- 缓存：DWT 结果缓存（LRU）

### 4) 交互与稳定性
- 修复频域视图在切换变换时不更新的问题
- 修复统计口径，确保能量比例覆盖全频谱/全系数域
- DFT 频谱统计与显示解耦（统计走 raw，展示走 display）

## 当前可用功能清单
- 变换选择：DFT / DCT / DWT
- 频域/系数显示：支持多种滤波参数
- 空间域重建：原图 vs 重建对比
- 统计面板：DFT/DCT 三段能量比，DWT LL/高频/分层占比

## 已知问题与风险
- DCT 回退算法为纯 JS，性能对大图可能较慢
- DWT 在奇数尺寸图像时会截断到偶数尺寸（需在 UI 说明）
- 统计基于能量归一，浮点误差存在微小偏差

## 未完成与下一阶段
### M3: WPT
- 分解/重建到 level=3
- packet 节点选择与掩码
- packet 能量直方图与统计

### M4: DT-CWT
- 方向选择性子带可视化
- 简单滤波 + 重建
- 标注为实验特性

### 工程增强
- 统计与 mask 的缓存/LRU 细化
- 滑块交互节流优化
- 变换配置与 UI 文案完善

## 文件变更摘要（本阶段）
- `src/composables/useFrequency.js`：增加 DCT/DWT 算法链路与缓存、滤波、统计
- `src/components/FrequencyView.vue`：多变换 UI 与分析分支、过滤参数与统计输出
- `src/components/StatisticsPanel.vue`：DFT/DCT/DWT 统计显示
- `src/components/TransformSelector.vue`：开放 DCT/DWT 入口
*** End Patch}>>  微信的天天中彩票 to=functions.apply_patch code
