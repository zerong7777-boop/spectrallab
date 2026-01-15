<template>
  <div class="h-full flex flex-col bg-slate-800 border-r border-slate-700">
    <!-- Header -->
    <div class="p-4 border-b border-slate-700">
      <h2 class="text-lg font-semibold text-cyan-300 mb-2">图像库</h2>
      <div class="flex gap-2">
        <button
          @click="triggerFileInput"
          class="flex-1 px-3 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 rounded-lg transition-colors text-sm font-medium border border-cyan-500/30"
        >
          <svg class="w-4 h-4 inline mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          添加图像
        </button>
        <button
          v-if="images.length > 0"
          @click="clearAll"
          class="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors text-sm border border-red-500/30"
          title="清空所有"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        multiple
        class="hidden"
        @change="handleFileSelect"
      />
    </div>

    <!-- Image List -->
    <div class="flex-1 overflow-y-auto p-4">
      <div v-if="images.length === 0" class="text-center py-12 text-slate-500">
        <svg class="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p class="text-sm">拖拽图像到这里</p>
        <p class="text-xs mt-1 text-slate-600">或点击上方按钮添加</p>
      </div>

      <div v-else class="space-y-2">
        <p class="text-xs text-slate-500 px-1 mb-2">点击图像缩略图选择并开始分析</p>
        <div class="grid grid-cols-2 gap-3">
          <div
            v-for="image in images"
            :key="image.id"
            @click="selectImage(image.id)"
            @dragover.prevent
            @drop.prevent="handleDrop"
            class="relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all"
            :class="selectedImageId === image.id 
              ? 'border-cyan-500 shadow-lg shadow-cyan-500/20 ring-2 ring-cyan-500/50' 
              : 'border-slate-700 hover:border-slate-600 hover:border-cyan-500/50'"
          >
            <!-- Thumbnail -->
            <div class="aspect-square bg-slate-900 relative overflow-hidden">
              <img
                :src="image.dataURL"
                :alt="image.name"
                class="w-full h-full object-cover"
              />
              
              <!-- Processing Overlay -->
              <div
                v-if="image.processing"
                class="absolute inset-0 bg-slate-900/80 flex items-center justify-center"
              >
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400"></div>
              </div>

              <!-- Selected Indicator -->
              <div
                v-if="selectedImageId === image.id"
                class="absolute top-2 right-2 w-5 h-5 bg-cyan-500 rounded-full flex items-center justify-center"
              >
                <svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                </svg>
              </div>
            </div>

            <!-- Image Info -->
            <div class="p-2 bg-slate-900/50 backdrop-blur-sm">
              <p class="text-xs font-medium text-slate-200 truncate" :title="image.name">
                {{ image.name }}
              </p>
              <div class="flex items-center justify-between mt-0.5">
                <p class="text-xs text-slate-500">
                  {{ image.width }} × {{ image.height }}
                </p>
                <span 
                  v-if="selectedImageId === image.id"
                  class="text-xs px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400"
                >
                  已选中
                </span>
              </div>
            </div>

            <!-- Delete Button -->
            <button
              @click.stop="removeImage(image.id)"
              class="absolute top-2 left-2 w-6 h-6 bg-red-500/80 hover:bg-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              title="删除"
            >
              <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer Stats -->
    <div v-if="images.length > 0" class="p-4 border-t border-slate-700 text-xs text-slate-500">
      <p>共 {{ images.length }} 张图像</p>
    </div>
  </div>
</template>

<script setup>
import { ref, inject } from 'vue'

const imageManager = inject('imageManager', null)

if (!imageManager) {
  throw new Error('ImageGallery requires imageManager to be provided')
}

const {
  images,
  selectedImageId,
  addImages,
  removeImage,
  selectImage,
  clearAll,
} = imageManager

const fileInput = ref(null)

const triggerFileInput = () => {
  fileInput.value?.click()
}

const handleFileSelect = (event) => {
  const files = event.target.files
  if (files && files.length > 0) {
    addImages(files)
    // 重置 input，允许重复选择相同文件
    event.target.value = ''
  }
}

const handleDrop = (event) => {
  const files = event.dataTransfer.files
  const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'))
  if (imageFiles.length > 0) {
    addImages(imageFiles)
  }
}
</script>
