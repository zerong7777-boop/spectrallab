<template>
  <div class="h-screen bg-slate-900 text-slate-200 flex flex-col overflow-hidden">
    <!-- Header -->
    <header class="px-6 py-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-cyan-400">SpectralLab</h1>
          <p class="text-sm text-slate-400 mt-0.5">专业频率域图像分析平台</p>
        </div>
        <div v-if="!opencvReady" class="flex items-center gap-2 text-sm text-slate-400">
          <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-cyan-400"></div>
          <span>正在加载 OpenCV.js...</span>
        </div>
        <div v-else class="flex items-center gap-2 text-xs text-green-400">
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
          </svg>
          <span>就绪</span>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <div v-if="!opencvReady" class="flex-1 flex items-center justify-center">
      <div class="text-center">
        <div class="animate-spin rounded-full h-16 w-16 border-b-2 border-cyan-400 mx-auto mb-4"></div>
        <p class="text-slate-400 text-lg">正在加载 OpenCV.js...</p>
        <p class="text-slate-500 text-sm mt-2">这可能需要几秒钟</p>
      </div>
    </div>

    <div v-else class="flex-1 flex overflow-hidden">
      <!-- Left Sidebar: Image Gallery -->
      <div class="w-64 flex-shrink-0">
        <ImageGallery />
      </div>

      <!-- Center: Spatial View & Controls -->
      <div class="flex-1 flex flex-col overflow-hidden border-x border-slate-800">
        <div class="flex-1 overflow-y-auto p-6">
          <SpatialView :reconstructed-src="reconstructedSrc" />
        </div>
        <div class="p-4 border-t border-slate-800 bg-slate-900/50">
          <TransformSelector
            :selected-transform="selectedTransform"
            @update:selected-transform="selectedTransform = $event"
          />
        </div>
      </div>

      <!-- Right: Frequency View & Statistics -->
      <div class="w-96 flex-shrink-0 flex flex-col overflow-hidden">
        <div class="flex-1 overflow-y-auto p-6">
          <FrequencyView
            :image-id="selectedImage?.id"
            :image-src="selectedImage?.dataURL"
            :cv="cv"
            :transform-type="selectedTransform"
            @reconstruction-ready="reconstructedSrc = $event"
            @stats-ready="frequencyStats = $event"
          />
        </div>
        <div class="p-4 border-t border-slate-800 bg-slate-900/50">
          <StatisticsPanel
            v-if="selectedImage"
            :image="selectedImage"
            :stats="frequencyStats"
            :transform-type="selectedTransform"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, provide, onMounted, watch } from 'vue'
import { useOpenCV } from './composables/useOpenCV'
import { useImageManager } from './composables/useImageManager'
import ImageGallery from './components/ImageGallery.vue'
import SpatialView from './components/SpatialView.vue'
import FrequencyView from './components/FrequencyView.vue'
import TransformSelector from './components/TransformSelector.vue'
import StatisticsPanel from './components/StatisticsPanel.vue'

const { opencvReady, cv, loadOpenCV } = useOpenCV()
const imageManager = useImageManager()
const selectedImage = imageManager.selectedImage
const selectedTransform = ref('DFT')
const reconstructedSrc = ref(null)
const frequencyStats = ref(null)

provide('imageManager', imageManager)

onMounted(() => {
  loadOpenCV()
})

watch(() => selectedImage.value?.id, () => {
  reconstructedSrc.value = null
  frequencyStats.value = null
})

watch(() => selectedTransform.value, () => {
  reconstructedSrc.value = null
  frequencyStats.value = null
})
</script>
