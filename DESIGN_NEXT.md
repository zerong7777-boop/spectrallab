# SpectralLab 下一步推进设计文档（草案）

## 目标与范围
目标：在现有 DFT 频谱可视化基础上，扩展频域处理能力与交互流程，使用户能够构建滤波器并执行 iFFT 重建，同时提供可解释的统计指标与更稳定的分析链路。

范围：
- 新增频域滤波器（低通/高通/带通/带阻，圆形/高斯）。
- 支持 iFFT 重建与空间域对比。
- 实现频域统计与指标可视化。
- 增强性能与稳定性（缓存、任务取消、UI 状态同步）。

非目标：
- 深度学习相关模型、离线批处理、服务端推理。

## 当前基线
- 频谱计算与渲染：`src/composables/useFrequency.js`（DFT -> Log-Magnitude -> FFT Shift -> Normalize）。
- 图像管理：`src/composables/useImageManager.js`。
- 频域视图：`src/components/FrequencyView.vue`。
- 空间域视图：`src/components/SpatialView.vue`。

## 关键算法与核心代码位置（必须保留/理解）
以下代码是频域处理链路的核心基础，后续任何滤波与 iFFT 都要围绕它扩展：
- 频谱计算主流程：`src/composables/useFrequency.js`
  - `computeFrequencySpectrum`：灰度化、DFT、幅度、Log、Shift、归一化。
  - `fftShift`：将 DC 分量移到中心（四象限交换）。
  - `loadImageToMat` / `renderMatToCanvas`：输入转换与输出渲染。

## 新增功能设计

### 1) 频域滤波器构建与可视化
功能：
- 支持低通/高通/带通/带阻。
- 支持理想圆形与高斯两类滤波器。
- 频域掩码可视化（叠加在频谱上）。

设计要点：
- 使用频域掩码与复数谱逐元素相乘。
- 掩码与频谱尺寸一致（考虑 DFT padding 后的尺寸）。
- 支持可控参数（半径、带宽、中心、平滑度）。

建议接口：
- `buildMask(type, shape, params, size)` -> `cv.Mat`（单通道 float）。
- `applyMaskToSpectrum(complexMat, mask)` -> `cv.Mat`（复数谱）。

### 2) iFFT 重建
功能：
- 对滤波后的频谱做 iFFT，输出空间域图像。
- 与原图并排或叠加展示。

设计要点：
- 复数谱保持双通道 Mat（real+imag）。
- iFFT 后需取幅度或实部并归一化/裁剪回原尺寸。
- 记得逆 shift（或一致的频谱中心策略）。

建议接口：
- `computeInverseSpectrum(complexMat, cv)` -> `cv.Mat`（空间域图像）。
- 保证所有中间 Mat `.delete()`。

### 3) 频域统计
功能：
- 低/中/高频能量比例。
- 滤波后频谱能量变化。

设计要点：
- 在频谱幅度矩阵上按半径做分段统计。
- 指标应与图像大小和缩放无关（归一化）。

建议接口：
- `computeBandEnergy(magMat, bands)` -> `{ low, mid, high }`。

### 4) 状态与性能
功能：
- 任务取消、重复计算避免。
- 结果缓存（按 imageId + transform + mask 参数）。

设计要点：
- 频谱计算可缓存原始 DFT 结果，重复计算只改掩码。
- UI 显示应和计算状态一致（避免 canvas 被卸载）。

## UI 与交互建议
- 新增频域控制面板（滤波类型、参数滑块、实时预览）。
- 空间域视图新增“原图 vs 重建”切换或并排。
- 频域视图新增掩码叠加层与参数信息提示。

## 迭代拆分建议
1. 引入 DFT 结果缓存 + iFFT 重建（先无滤波器）。
2. 增加理想低通/高通掩码 + 频谱掩码叠加显示。
3. 增加带通/带阻 + 高斯滤波器。
4. 完成频域统计与 UI 面板。
5. 收敛性能：缓存、取消、尺寸优化。

## 风险与注意事项
- OpenCV.js 无 GC：必须严格释放 Mat。
- 大图性能与 WebAssembly 内存压力。
- 频谱尺寸 padding 导致结果尺寸变化，需要在 UI 层对齐。

## 需要外部编码支持的核心点（建议交给更强 AI）
- 频域掩码构建与复数谱滤波的 OpenCV.js 实现。
- iFFT 复原逻辑与尺寸/数值稳定性处理。
- 频域统计的性能实现（按半径带计算）。
