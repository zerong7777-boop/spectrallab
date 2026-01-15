# SpectralLab 频域滤波与 iFFT 重建扩展设计文档（草案 v1.1）

## 0. 背景与目标

### 目标

在现有 DFT 频谱可视化链路基础上，扩展完整的频域处理闭环，使用户可以：

1. 构建并可视化频域滤波器（mask）
2. 将 mask 应用于复数频谱（complex spectrum），并执行 iFFT 重建
3. 在空间域对比原图与重建结果
4. 输出可解释、可复现、尺度无关的频域统计指标
5. 提升性能与稳定性：缓存、任务取消、UI 状态一致性、内存可控

### 范围（In Scope）

* 滤波器类型：低通 / 高通 / 带通 / 带阻
* 滤波器形状：理想圆形（Ideal Circular）/ 高斯（Gaussian）
* 频域掩码叠加显示（overlay）
* iFFT 重建与空间域对比
* 频域统计：低/中/高频能量比例、滤波前后能量变化、可选径向能量剖面（radial profile）
* 性能与稳定性：DFT 结果缓存、mask 缓存、统计缓存、任务取消、LRU 清理、UI 状态同步

### 非目标（Out of Scope）

* 深度学习模型/推理、离线批处理、服务端推理
* 多图批量队列、复杂调度系统（但保留未来扩展点）

---

## 1. 当前基线（必须保留/理解）

### 关键代码位置（不改变其“语义职责”，只做扩展）

* 频谱计算与渲染：`src/composables/useFrequency.js`

  * `computeFrequencySpectrum`：灰度化、DFT、幅度、Log、Shift、归一化（用于展示）
  * `fftShift`：四象限交换，将 DC 移到中心
  * `loadImageToMat` / `renderMatToCanvas`：输入与输出渲染
* 图像管理：`src/composables/useImageManager.js`
* 视图组件：

  * `src/components/FrequencyView.vue`
  * `src/components/SpatialView.vue`

### 设计原则

* 现有“展示用频谱”链路继续可用；新增“处理用复数谱”链路必须与之共存。
* 频域处理必须以 OpenCV.js 标准复数谱表示（双通道 Mat）为中心数据结构。
* 所有中间 Mat 必须显式 `.delete()`，缓存中 Mat 必须有可控生命周期与逐出策略。

---

## 2. 总体架构与数据流

### 数据对象定义（建议约定）

* `SpectrumState`

  * `imageId`
  * `origSize`: `{ w, h }`
  * `padSize`: `{ w, h }`（若使用 padding）
  * `complexDFT`: `cv.Mat`（CV_32FC2）
  * `shiftedDFT`: `cv.Mat`（可选缓存：中心化频谱 CV_32FC2）
  * `mag`: `cv.Mat`（CV_32F，用于统计与可视化计算）
  * `magDisplay`: `cv.Mat`（CV_8U 或 CV_32F，用于 canvas 显示）
* `FilterSpec`

  * `mode`: `lowpass | highpass | bandpass | bandstop`
  * `shape`: `ideal | gaussian`
  * `params`（统一归一化口径，见下文）
* `TaskToken`

  * `id`（递增或 uuid）
  * `cancelled: boolean`

### 管线流程（推荐）

1. **准备阶段**

   * 读取图像 -> 灰度 Mat（float）
   * 可选：padding 到最优 DFT 尺寸（padSize），并保留 origSize 用于 iFFT 后 crop
2. **DFT 阶段（核心缓存点）**

   * 得到 `complexDFT`（CV_32FC2）
   * 得到 `shiftedDFT`（可选缓存，便于 mask 可视化与交互）
3. **可视化频谱**

   * 从（shifted）complexDFT 计算 `mag` -> `log(1+mag)` -> normalize -> `magDisplay`
4. **mask 构建与叠加**

   * 根据 `FilterSpec` 生成 `mask`（CV_32F，尺寸=padSize）
   * 生成 overlay 显示（mask -> alpha blend 到频谱 canvas）
5. **mask 应用**

   * `filteredDFT = shiftedDFT ⊙ mask`（逐元素乘；对 real/imag 同时乘同一个 mask）
6. **iFFT 重建**

   * inverse shift（若使用 shiftedDFT）
   * `idft` -> 得到空间域结果（实值输出 + scale）
   * crop 回 origSize，normalize/clip 得到可显示灰度
7. **统计**

   * 在 `mag`（或 power=mag^2）上做径向 band 能量统计
   * 输出低/中/高频能量比例、滤波前后变化（delta / ratio）

---

## 3. 滤波器设计

### 3.1 参数口径（建议统一为“归一化半径”）

为保证指标和交互不随图像尺寸漂移，推荐在 UI 与缓存 key 中使用归一化半径参数：

* `r0`: 中心半径（0~0.5，0.5 代表到最短边一半的 Nyquist 半径近似）
* `bw`: 带宽（0~0.5）
* `sigma`: 高斯平滑（建议归一化到半径尺度，例如 0.01~0.2）
* `center`: `{ cx, cy }`（默认频谱中心；允许偏移以支持交互拖拽）

内部实现时，将归一化半径映射到像素半径：

* `Rpx = rNorm * Rmax`，其中 `Rmax = min(padW, padH) / 2`

### 3.2 mask 构建规则（必须明确）

mask 输出：`cv.Mat`，类型 `CV_32F`，大小 `padH x padW`，值域 `[0,1]`

* **Ideal 低通**：`mask=1` if `dist<=R`, else `0`

* **Ideal 高通**：`1 - lowpass`

* **Ideal 带通**：`1` if `R1<=dist<=R2`, else `0`

* **Ideal 带阻**：`1 - bandpass`

* **Gaussian 低通**：`mask = exp(-(dist^2)/(2*sigma^2))`

* **Gaussian 高通**：`1 - gaussian_lowpass`

* **Gaussian 带通**：可用两个高斯低通之差的绝对/截断形式（需钉死默认实现）

  * 推荐默认：`bandpass = clamp(gaussLP(sigma2) - gaussLP(sigma1), 0, 1)`，其中 `sigma2 > sigma1`

* **Gaussian 带阻**：`1 - bandpass`

说明：高斯带通/带阻实现形式存在多种，必须在代码与文档里固定“默认公式”，并给出可选实现开关（见第 7 节）。

---

## 4. iFFT 重建设计（数值与尺寸稳定性）

### 关键点（必须钉死）

1. **复数谱类型**：全程保持 `CV_32FC2`
2. **Shift 策略一致**：若对频谱展示与 mask 在中心化域操作，则 iFFT 前必须 inverse shift 回原象限
3. **idft 输出**：

   * 推荐使用 `DFT_SCALE`（避免输出幅值随尺寸爆炸）
   * 推荐输出实值：`DFT_REAL_OUTPUT`（若输入满足共轭对称；但滤波后仍满足）
4. **裁剪回原尺寸**：如果做过 padding，iFFT 后必须 crop 回 `origSize`
5. **显示归一化**：用于展示的空间域结果进行 normalize 到 `[0,255]`（或 `[0,1]`），再渲染
6. **资源释放**：所有临时 Mat 必须 delete；缓存 Mat 有逐出 delete

### 推荐接口（对齐你原有 useFrequency.js 风格）

* `computeDFTComplex(imageMat, options) -> { complexDFT, shiftedDFT, origSize, padSize }`
* `computeIFFTImage(complexMat, meta, options) -> cv.Mat`（空间域灰度 Mat，用于渲染）
* `inverseFftShift(complexMat) -> cv.Mat`（或复用同一个 shift 函数，两次 shift 互逆）

---

## 5. 频域统计与指标

### 指标集合（建议最小可交付）

* `E_total`: 总能量（建议用 power：`sum(mag^2)`，更稳定）
* `E_low / E_mid / E_high`：按半径分段的能量
* `ratio_low/mid/high = E_band / E_total`
* `delta_energy = (E_total_after - E_total_before) / E_total_before`（或 ratio 形式）

### band 划分（必须固定默认值）

默认给出一个可解释的三段划分（归一化半径）：

* low: `[0, 0.15]`
* mid: `(0.15, 0.35]`
* high: `(0.35, 0.5]`
  并允许 UI 调整或未来扩展为多段直方图。

### 性能实现建议（避免逐像素重复算 dist）

* 缓存 `radiusMap`（每个 `padSize` 一份），每个像素存 `rNorm` 或 `binId`
* 统计时只做一次线性累加（power 累加到 bins）
* 可选输出 `radialProfile[b]`（用于小图表展示）

---

## 6. 状态管理、任务取消与缓存策略

### 6.1 任务取消（必须可用）

OpenCV.js 单次操作不可中断，因此采用“步骤级取消”：

* 每次用户改参数触发新任务：生成 `TaskToken`，旧 token 标记 cancelled
* 每一步（DFT、mask、apply、iFFT、stat、render）前检查 token；取消则立即释放中间 Mat 并退出
* UI 只接受“最新 token”的结果提交，避免旧结果回写导致闪烁/错配

### 6.2 缓存层级（建议分三层）

1. **DFT 缓存（最高收益）**
   key: `imageId + padSize + grayMode`
   value: `{ complexDFT, shiftedDFT, meta }`

2. **mask 缓存（中收益）**
   key: `padSize + FilterSpec(normalized params)`
   value: `maskMat`

3. **统计缓存（中低收益）**
   key: `imageId + padSize + (before/after) + FilterSpec`
   value: `{ ratios, profile }`

### 6.3 LRU 与内存上限（必须有逐出机制）

* 设定上限：例如最多缓存 N 张图的 DFT（建议 2~4），mask 缓存 M 个（例如 10~20）
* LRU 淘汰时必须 `.delete()` 对应 Mat
* 提供 `clearCache()`（切换项目或显式清理时调用）

---

## 7. 可选实现开关（防止复现分叉）

### A 类（必须在默认实现中钉死）

这些不钉死会导致不同实现输出显著不同：

* padding 策略（是否 pad、pad 到何种尺寸、如何 crop）
* shift 策略（在何处 shift、mask 是在哪个域定义的）
* iFFT 的 flags（是否 `DFT_SCALE`、是否 `REAL_OUTPUT`）
* Gaussian 带通/带阻的默认公式

### B 类（可选，但需明确默认值并提供开关）

* 统计使用 mag 还是 power（默认 power）
* band 划分阈值（默认 low/mid/high 固定阈值）
* overlay 配色与透明度（默认值即可）
* 是否缓存 shiftedDFT（默认缓存以提升交互）

---

## 8. UI 与交互（最小可交付方案）

### FrequencyView（频域视图）

* 新增控制面板：

  * mode：低通/高通/带通/带阻
  * shape：ideal/gaussian
  * r0、bw、sigma（根据 mode/shape 动态显示）
  * “显示 mask 叠加”开关
* 频谱 canvas 增加 overlay 层：

  * 底层：magDisplay
  * 上层：maskOverlay（可选）
* 参数变化触发“实时预览”（受取消机制保护）

### SpatialView（空间域视图）

* 新增 “原图 vs 重建”：

  * 并排（推荐）或 toggle
* 显示重建后统计摘要（low/mid/high ratio，delta energy）

---

## 9. 迭代拆分与验收标准

### 里程碑 M1：iFFT 闭环（无滤波）

交付：

* 从缓存的 complexDFT 直接 iFFT 重建，空间域结果与原图视觉一致
  验收：
* 同一图像，重建与原图的 MSE 小于阈值（允许轻微数值误差）
* UI 切换不闪烁，取消不会回写旧结果

### 里程碑 M2：Ideal 低通/高通 + mask overlay

交付：

* mask 构建、叠加、应用、重建全链路
  验收：
* 调半径时频谱与重建响应符合直觉（低通更平滑，高通更强调边缘）
* Mat 无明显泄漏（重复操作内存不持续上涨）

### 里程碑 M3：带通/带阻 + Gaussian

交付：

* 四种 mode + 两种 shape 全覆盖
  验收：
* 参数边界条件稳定（极小/极大半径不崩溃，输出可解释）

### 里程碑 M4：统计面板

交付：

* low/mid/high 能量比例 + 滤波前后变化
  验收：
* 指标对图像缩放不敏感（同内容不同尺寸，比例近似一致）

### 里程碑 M5：性能收敛

交付：

* DFT 缓存 + LRU + 取消稳定
  验收：
* 连续拖动滑块时不卡死；旧任务不会覆盖新任务；缓存逐出能释放 Mat

---

## 10. 风险与对策

* OpenCV.js 无 GC：必须严格 delete；对缓存 Mat 需要 LRU 清理与显式 clear
* 大图性能：必要时强制 downscale 预览（作为 B 类可选开关）
* padding 导致对齐问题：必须保留 origSize，统一 crop，并在 UI 中用同一布局对齐展示
* 频域交互频繁触发：必须有取消与节流（例如 slider onInput 节流到 30~60ms）

---

## 11. 需要外部编码支持的核心点（交给强 AI 的清单）

* OpenCV.js：mask 构建（ideal + gaussian）与复数谱逐元素滤波（real/imag 同乘）
* iFFT 稳定实现：inverse shift、idft flags、crop、normalize、delete 全链路
* 频域统计高性能实现：radiusMap/binMap 缓存 + power 累加

---

# 给 Agent 的执行 Prompt（可直接粘贴）

你是一个资深前端/图像处理工程师，请在不破坏现有 SpectralLab 基线结构的前提下，按以下要求实现“频域滤波 + iFFT 重建 + 统计 + 缓存/取消”的最小可交付版本，并提供清晰的 patch 说明（改了哪些文件、增加了哪些导出函数、UI 新增哪些 props/状态）。

约束与上下文：

* 现有关键文件：

  * `src/composables/useFrequency.js`：已经有 DFT -> Log-Magnitude -> FFT Shift -> Normalize 的展示链路，以及 `fftShift / loadImageToMat / renderMatToCanvas` 等基础函数。后续扩展必须围绕它，不要推倒重写。
  * `src/components/FrequencyView.vue` 与 `src/components/SpatialView.vue`：分别为频域与空间域视图。
* OpenCV.js 无 GC：所有 `cv.Mat` 必须显式 `.delete()`；缓存中的 Mat 必须有 LRU/逐出时 delete。
* 必须提供“任务取消”机制，避免用户拖动滑块时旧结果覆盖新结果（步骤级取消即可）。
* 必须实现 DFT 缓存：相同 `imageId + padSize` 下，DFT 不重复计算；只重新构建 mask / apply / iFFT / stat。

实现目标（按优先级交付）：

1. DFT 结果缓存与 iFFT 重建闭环（先不加滤波器）

   * 产出：能从 complexDFT 直接 iFFT 得到空间域图像，并在 SpatialView 显示“原图 vs 重建”
   * 明确 shift/inverse shift 策略、idft flags（建议 DFT_SCALE + REAL_OUTPUT），以及 padding/crop 策略
2. Ideal 低通/高通 mask（圆形）

   * 新增 `buildMask(mode, shape, params, size, cv)`：返回 `CV_32F` mask，值域 [0,1]
   * 新增 `applyMaskToSpectrum(complexMat, mask, cv)`：对 `CV_32FC2` 的 real/imag 同乘 mask
   * FrequencyView 增加 mask overlay（可以单独 canvas 叠加）
3. 增加 bandpass/bandstop + gaussian

   * Gaussian 公式与默认实现必须固定写在代码注释中，避免复现分叉
4. 频域统计

   * `computeBandEnergy(magOrPowerMat, bands)` 输出 low/mid/high ratio 与 total energy
   * 使用 radiusMap/binMap 缓存以提升性能
5. 性能与稳定性

   * 任务 token：新任务创建 token，旧任务 cancelled；每一步前检查 token；只提交最新 token 的结果
   * LRU：DFT cache（建议最多 2~4 张）、mask cache（建议 10~20 个）；淘汰时 delete Mat
   * 提供 `clearCache()` 供 UI 或图像切换时调用

接口建议（你可调整，但要做到职责清晰）：

* `computeDFTComplex(imageMat, options, cv) -> { complexDFT, shiftedDFT, meta }`
* `computeFrequencyDisplay(shiftedDFT, cv) -> { magMat, magDisplayMat }`
* `computeIFFTImage(filteredShiftedDFT, meta, cv) -> spatialMat`
* `buildMask(filterSpec, padSize, cv) -> maskMat`
* `applyMaskToSpectrum(shiftedDFT, maskMat, cv) -> filteredShiftedDFT`
* `computeBandEnergy(powerMat, bands, cv) -> metrics`

输出要求：

* 给出具体修改清单（文件级别），并解释关键设计选择（shift、padding、idft flags、缓存 key、LRU 删除点）。
* 给出最小可运行的实现，不要只给伪代码。
* 在关键函数内添加必要的注释，强调 Mat 的 delete 责任归属（谁创建谁释放/缓存例外如何释放）。

验收标准（请你在实现里自检）：

* 同一张图：无滤波 iFFT 重建结果与原图视觉一致（允许微小误差）
* 拖动滑块：不会出现旧结果覆盖新结果
* 连续多次操作：内存不持续上涨（至少通过 LRU 删除与 delete 控制住）


