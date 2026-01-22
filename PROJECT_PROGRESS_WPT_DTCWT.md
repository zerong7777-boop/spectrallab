# SpectralLab 工作记录与当前进度（WPT Tree + DT-CWT Experimental）

## 目标回顾
本阶段目标是在不破坏已有 DFT/DCT/DWT/WPT 稳定性的前提下：
- 建立轻量 TransformBackend 契约与调度层
- 完成 WPT Tree 展示 + level 能量聚合图
- 接入 DT-CWT Experimental（默认关闭，启用后可视化/重建）

## 已完成工作

### 1) TransformBackend 契约与调度层
- 新增 backend 适配层：统一 forward/applyFilter/inverse/getDisplay/computeMetrics 接口
- 新增 engine：负责 TaskToken、LRU 缓存、取消与结果提交
- 适配 DFT/DCT/DWT/WPT/DT-CWT

关键文件：
- `src/composables/transformBackends.js`
- `src/composables/useTransformEngine.js`

### 2) WPT Tree + Level 聚合图
- WPT 统计结构升级为树结构
  - 节点包含 `id/path/level/energy/energyRatio/parentId/childrenIds`
  - 叶子节点能量用于统计与 level 聚合
- UI 由列表改为树形节点选择
  - 点击节点 toggle 选中（子树保留语义）
  - 快捷操作：仅低频/全选/清空
- Level 聚合图：按 level 汇总 energy ratio 的柱状图

关键文件：
- `src/composables/useFrequency.js`
- `src/components/FrequencyView.vue`
- `src/components/StatisticsPanel.vue`

### 3) DT-CWT Experimental 接入
- 实验性接入 DT-CWT（方向滤波近似实现）
- 默认关闭，仅启用后参与计算与重建
- 方向选择 + 阈值（hard/soft）可用
- 统计输出 per-direction energy ratio

关键文件：
- `src/composables/useFrequency.js`
- `src/composables/transformBackends.js`
- `src/components/FrequencyView.vue`
- `src/components/StatisticsPanel.vue`
- `src/components/TransformSelector.vue`

## 统计口径与一致性
所有统计均基于 raw 系数能量（power）计算：
- DFT/DCT：基于 real/imag 或 raw coefficient power
- DWT/WPT：基于 raw 子带/packet 系数
- DT-CWT：基于方向响应能量

display 图（log/normalize）仅用于渲染，不参与统计。

## 关键接口与数据结构
### WPT 节点结构
```
{
  id, path, level,
  energy, energyRatio,
  parentId, childrenIds[]
}
```

### Level 聚合
```
levelBuckets: [{ level, ratio }]
```

### DT-CWT 统计
```
perDirectionEnergy: [{ id, label, ratio }]
```

## 当前功能状态
- DFT/DCT/DWT/WPT：闭环（显示/滤波/统计/重建）可用
- WPT Tree：可交互节点选择 + level 能量柱状图
- DT-CWT：Experimental（默认关闭，可启用）

## 文件变更清单（本阶段）
- 新增：`src/composables/transformBackends.js`
- 新增：`src/composables/useTransformEngine.js`
- 更新：`src/composables/useFrequency.js`
- 更新：`src/components/FrequencyView.vue`
- 更新：`src/components/StatisticsPanel.vue`
- 更新：`src/components/TransformSelector.vue`

## 自检与验收要点
- 变换切换不乱序：旧任务不会覆盖新任务
- 统计比率总和≈100%（允许浮点误差）
- WPT Tree 选择与重建结果一致
- DT-CWT 默认关闭时不影响系统表现

## 后续建议
- WPT Tree 交互可视化进一步优化（折叠/展开、搜索）
- DT-CWT 改为更严谨的实现或引入可靠第三方库
- 增加 PSNR/MSE 自检入口用于重建质量评估
