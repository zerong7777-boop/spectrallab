<template>
  <div class="bg-slate-800 rounded-lg p-4 border border-slate-700">
    <h3 class="text-sm font-semibold text-cyan-300 mb-3">频域统计</h3>

    <div v-if="['DFT', 'DCT'].includes(transformType)" class="space-y-3">
      <div class="text-xs text-slate-400">
        <p>变换方法: <span class="text-cyan-400 font-medium">{{ transformType }}</span></p>
      </div>

      <div v-if="stats" class="space-y-3">
        <div class="space-y-2">
          <div class="flex items-center justify-between text-xs">
          <span class="text-slate-400">低频 (0-0.3)</span>
            <span class="text-slate-200 font-medium">{{ formatPercent(stats.ratios[0]) }}</span>
          </div>
          <div class="w-full bg-slate-700 rounded-full h-1.5">
            <div class="bg-cyan-500 h-1.5 rounded-full" :style="{ width: formatPercent(stats.ratios[0]) }"></div>
          </div>
        </div>

        <div class="space-y-2">
          <div class="flex items-center justify-between text-xs">
          <span class="text-slate-400">中频 (0.3-0.7)</span>
            <span class="text-slate-200 font-medium">{{ formatPercent(stats.ratios[1]) }}</span>
          </div>
          <div class="w-full bg-slate-700 rounded-full h-1.5">
            <div class="bg-blue-500 h-1.5 rounded-full" :style="{ width: formatPercent(stats.ratios[1]) }"></div>
          </div>
        </div>

        <div class="space-y-2">
          <div class="flex items-center justify-between text-xs">
          <span class="text-slate-400">高频 (0.7-1)</span>
            <span class="text-slate-200 font-medium">{{ formatPercent(stats.ratios[2]) }}</span>
          </div>
          <div class="w-full bg-slate-700 rounded-full h-1.5">
            <div class="bg-purple-500 h-1.5 rounded-full" :style="{ width: formatPercent(stats.ratios[2]) }"></div>
          </div>
        </div>
      </div>

      <div v-else class="text-xs text-slate-500 text-center py-6">
        统计信息待生成
      </div>
    </div>

    <div v-else-if="transformType === 'DWT'" class="space-y-3">
      <div class="text-xs text-slate-400">
        <p>变换方法: <span class="text-cyan-400 font-medium">DWT</span></p>
      </div>
      <div v-if="stats" class="space-y-3">
        <div class="space-y-2">
          <div class="flex items-center justify-between text-xs">
            <span class="text-slate-400">LL 能量</span>
            <span class="text-slate-200 font-medium">{{ formatPercent(stats.llRatio) }}</span>
          </div>
          <div class="w-full bg-slate-700 rounded-full h-1.5">
            <div class="bg-cyan-500 h-1.5 rounded-full" :style="{ width: formatPercent(stats.llRatio) }"></div>
          </div>
        </div>
        <div class="space-y-2">
          <div class="flex items-center justify-between text-xs">
            <span class="text-slate-400">高频总能量</span>
            <span class="text-slate-200 font-medium">{{ formatPercent(stats.detailRatio) }}</span>
          </div>
          <div class="w-full bg-slate-700 rounded-full h-1.5">
            <div class="bg-purple-500 h-1.5 rounded-full" :style="{ width: formatPercent(stats.detailRatio) }"></div>
          </div>
        </div>
        <div class="space-y-1">
          <div class="text-xs text-slate-500">层级能量占比</div>
          <div v-for="item in stats.levelDetails" :key="item.level" class="flex items-center justify-between text-xs">
            <span class="text-slate-400">L{{ item.level }}</span>
            <span class="text-slate-200 font-medium">{{ formatPercent(item.ratio) }}</span>
          </div>
        </div>
      </div>
      <div v-else class="text-xs text-slate-500 text-center py-6">
        统计信息待生成
      </div>
    </div>
    <div v-else class="text-center py-8 text-slate-500 text-sm">
      <p>{{ transformType }} 统计信息</p>
      <p class="text-xs mt-2 text-slate-600">待实现</p>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  image: {
    type: Object,
    required: true,
  },
  stats: {
    type: Object,
    default: null,
  },
  transformType: {
    type: String,
    default: 'DFT',
  },
})

const formatPercent = (value) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '--'
  }
  return `${value.toFixed(1)}%`
}
</script>
