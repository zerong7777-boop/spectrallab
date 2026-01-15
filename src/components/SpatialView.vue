<template>
  <div class="h-full flex flex-col">
    <h2 class="text-xl font-semibold text-cyan-300 mb-4">空间域视图</h2>
    
    <div class="flex-1 flex items-center justify-center">
      <div v-if="!selectedImage" class="text-center py-12">
        <svg class="w-24 h-24 mx-auto mb-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p class="text-slate-500 text-lg">从左侧图像库选择图像</p>
        <p class="text-slate-600 text-sm mt-2">点击图像缩略图即可自动开始分析</p>
        <div class="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
          <svg class="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span class="text-sm text-cyan-400">选择图像后会自动进行频率域分析</span>
        </div>
      </div>
      
      <div v-else class="w-full max-w-4xl">
        <div class="bg-slate-800 rounded-lg p-6 border border-slate-700 shadow-xl">
          <div class="mb-4 flex items-center justify-between">
            <div>
              <h3 class="text-lg font-medium text-slate-200">{{ selectedImage.name }}</h3>
              <p class="text-sm text-slate-400 mt-1">
                {{ selectedImage.width }} × {{ selectedImage.height }} 像素
              </p>
            </div>
            <div class="text-xs text-slate-500">
              {{ formatFileSize(selectedImage.size) }}
            </div>
          </div>
          
          <div class="relative rounded-lg overflow-hidden border border-slate-700 bg-slate-900">
            <img
              :src="selectedImage.dataURL"
              :alt="selectedImage.name"
              class="w-full h-auto max-h-[60vh] object-contain mx-auto"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { inject } from 'vue'

const imageManager = inject('imageManager', null)

if (!imageManager) {
  throw new Error('SpatialView requires imageManager to be provided')
}

const selectedImage = imageManager.selectedImage

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}
</script>
