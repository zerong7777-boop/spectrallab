<template>
  <div class="h-full flex flex-col">
    <div class="mb-4 flex items-center justify-between">
      <h2 class="text-xl font-semibold text-cyan-300">频率域视图</h2>
      <span v-if="transformType" class="text-xs px-2 py-1 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
        {{ transformType }}
      </span>
    </div>
    
    <div class="flex-1 flex items-center justify-center bg-slate-800 rounded-lg border border-slate-700 p-6">
      <div v-if="!imageSrc" class="text-center py-12">
        <svg class="w-20 h-20 mx-auto mb-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <p class="text-slate-500">请先选择图像以查看频率域</p>
      </div>
      
      <div v-else-if="processing" class="text-center py-12">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto mb-4"></div>
        <p class="text-slate-400">正在计算 {{ transformType }}...</p>
      </div>
      
      <div v-else class="w-full h-full flex items-center justify-center">
        <div class="relative w-full max-w-full">
          <canvas
            ref="canvasRef"
            class="max-w-full max-h-[60vh] rounded border border-slate-600 shadow-lg bg-slate-900"
            style="display: block;"
          ></canvas>
          <div v-if="imageSrc && !processing" class="mt-3 text-xs text-slate-400 text-center">
            <p v-if="transformType === 'DFT'">Log-Magnitude 频谱图（零频率位于中心）</p>
            <p v-else-if="transformType === 'DCT'">DCT 系数可视化</p>
            <p v-else>变换系数可视化</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, onMounted } from 'vue'
import { loadImageToMat, computeFrequencySpectrum, renderMatToCanvas } from '../composables/useFrequency'

const props = defineProps({
  imageSrc: {
    type: String,
    default: null,
  },
  cv: {
    type: Object,
    default: null,
  },
  transformType: {
    type: String,
    default: 'DFT',
  },
})

const canvasRef = ref(null)
const processing = ref(false)

// 执行频率域分析的函数
const performAnalysis = async () => {
  // 等待 DOM 更新
  await nextTick()
  
  if (!props.imageSrc || !props.cv || !canvasRef.value) {
    return
  }

  // 只处理已实现的变换方法
  if (props.transformType === 'DFT') {
    // 防止重复处理
    if (processing.value) {
      return
    }
    
    processing.value = true
    try {
      // 加载图片到 cv.Mat
      const srcMat = await loadImageToMat(props.imageSrc, props.cv)
      
      // 计算频率域频谱
      const spectrumMat = computeFrequencySpectrum(srcMat, props.cv)
      
      // 设置 canvas 尺寸
      if (canvasRef.value) {
        canvasRef.value.width = spectrumMat.cols
        canvasRef.value.height = spectrumMat.rows
        
        // 渲染到 Canvas
        renderMatToCanvas(spectrumMat, canvasRef.value, props.cv)
      }
      
      // 释放内存
      srcMat.delete()
      spectrumMat.delete()
    } catch (error) {
      console.error('频率域计算失败:', error)
      console.error('错误详情:', error.stack)
    } finally {
      processing.value = false
    }
  } else {
    // 其他变换方法待实现
    processing.value = false
  }
}

// 监听图片或变换类型变化并计算
watch([() => props.imageSrc, () => props.transformType, () => props.cv], async () => {
  await performAnalysis()
}, { immediate: true })

// 组件挂载后尝试分析
onMounted(async () => {
  await performAnalysis()
})
</script>
