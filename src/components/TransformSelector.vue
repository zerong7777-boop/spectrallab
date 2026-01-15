<template>
  <div class="bg-slate-800 rounded-lg p-4 border border-slate-700">
    <h3 class="text-sm font-semibold text-cyan-300 mb-3">变换方法</h3>
    <div class="grid grid-cols-2 gap-2">
      <button
        v-for="transform in transforms"
        :key="transform.value"
        @click="selectTransform(transform.value)"
        class="px-3 py-2 rounded-lg text-sm font-medium transition-all border"
        :class="selectedTransform === transform.value
          ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400 shadow-lg shadow-cyan-500/10'
          : 'bg-slate-700/50 border-slate-600 text-slate-300 hover:bg-slate-700 hover:border-slate-500'"
      >
        <div class="flex items-center justify-between">
          <span>{{ transform.label }}</span>
          <span
            v-if="transform.available"
            class="text-xs px-1.5 py-0.5 rounded bg-green-500/20 text-green-400"
          >
            ✓
          </span>
          <span
            v-else
            class="text-xs px-1.5 py-0.5 rounded bg-slate-600 text-slate-500"
          >
            待实现
          </span>
        </div>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  selectedTransform: {
    type: String,
    default: 'DFT',
  },
})

const emit = defineEmits(['update:selectedTransform'])

const transforms = [
  { value: 'DFT', label: 'DFT/FFT', available: true },
  { value: 'DCT', label: 'DCT', available: true },
  { value: 'DWT', label: 'DWT', available: true },
  { value: 'WPT', label: 'WPT', available: false },
  { value: 'DT-CWT', label: 'DT-CWT', available: false },
]

const selectTransform = (value) => {
  const transform = transforms.find(t => t.value === value)
  if (transform && transform.available) {
    emit('update:selectedTransform', value)
  }
}
</script>
