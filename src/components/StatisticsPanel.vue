<template>
  <div class="bg-slate-800 rounded-lg p-4 border border-slate-700">
    <h3 class="text-sm font-semibold text-cyan-300 mb-3">频域统计</h3>
    
    <div v-if="transformType === 'DFT'" class="space-y-3">
      <div class="text-xs text-slate-400">
        <p>变换方法: <span class="text-cyan-400 font-medium">DFT/FFT</span></p>
      </div>
      
      <!-- 频带能量占比 (占位符，待实现实际计算) -->
      <div class="space-y-2">
        <div class="flex items-center justify-between text-xs">
          <span class="text-slate-400">低频 (0-25%)</span>
          <span class="text-slate-200 font-medium">--</span>
        </div>
        <div class="w-full bg-slate-700 rounded-full h-1.5">
          <div class="bg-cyan-500 h-1.5 rounded-full" style="width: 0%"></div>
        </div>
      </div>
      
      <div class="space-y-2">
        <div class="flex items-center justify-between text-xs">
          <span class="text-slate-400">中频 (25-75%)</span>
          <span class="text-slate-200 font-medium">--</span>
        </div>
        <div class="w-full bg-slate-700 rounded-full h-1.5">
          <div class="bg-blue-500 h-1.5 rounded-full" style="width: 0%"></div>
        </div>
      </div>
      
      <div class="space-y-2">
        <div class="flex items-center justify-between text-xs">
          <span class="text-slate-400">高频 (75-100%)</span>
          <span class="text-slate-200 font-medium">--</span>
        </div>
        <div class="w-full bg-slate-700 rounded-full h-1.5">
          <div class="bg-purple-500 h-1.5 rounded-full" style="width: 0%"></div>
        </div>
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
  transformType: {
    type: String,
    default: 'DFT',
  },
})
</script>
