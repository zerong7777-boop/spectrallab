<template>
  <div class="h-full flex flex-col">
    <div class="mb-4 flex items-center justify-between">
      <h2 class="text-xl font-semibold text-cyan-300">频率域视图</h2>
      <span v-if="transformType" class="text-xs px-2 py-1 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
        {{ transformType }}
      </span>
    </div>

    <div class="mb-4 grid gap-3 text-xs text-slate-300" v-if="!isDwt">
      <div class="flex flex-wrap items-center gap-3">
        <label class="text-slate-400">滤波</label>
        <select
          v-model="filterMode"
          class="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-200"
        >
          <option value="none">无</option>
          <option value="lowpass">低通</option>
          <option value="highpass">高通</option>
          <option value="bandpass">带通</option>
          <option value="bandstop">带阻</option>
        </select>
        <label class="text-slate-400">形状</label>
        <select
          v-model="filterShape"
          class="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-200"
        >
          <option value="ideal">理想</option>
          <option value="gaussian">高斯</option>
        </select>
        <label class="flex items-center gap-2 text-slate-400">
          <input v-model="showMask" type="checkbox" class="accent-cyan-500" />
          显示掩码
        </label>
      </div>
      <div v-if="filterMode !== 'none' && filterShape === 'ideal'" class="flex items-center gap-3">
        <label class="text-slate-400">半径</label>
        <input
          v-model.number="filterRadius"
          type="range"
          min="0.02"
          :max="radiusMax"
          step="0.01"
          class="flex-1"
        />
        <span class="text-slate-400">{{ filterRadius.toFixed(2) }}</span>
      </div>
      <div v-if="filterMode !== 'none' && filterShape === 'ideal' && isBandMode" class="flex items-center gap-3">
        <label class="text-slate-400">带宽</label>
        <input
          v-model.number="filterBandwidth"
          type="range"
          min="0.02"
          :max="bandwidthMax"
          step="0.01"
          class="flex-1"
        />
        <span class="text-slate-400">{{ filterBandwidth.toFixed(2) }}</span>
      </div>
      <div v-if="filterMode !== 'none' && filterShape === 'gaussian' && !isBandMode" class="flex items-center gap-3">
        <label class="text-slate-400">sigma</label>
        <input
          v-model.number="filterSigma"
          type="range"
          min="0.02"
          :max="sigmaMax"
          step="0.01"
          class="flex-1"
        />
        <span class="text-slate-400">{{ filterSigma.toFixed(2) }}</span>
      </div>
      <div v-if="filterMode !== 'none' && filterShape === 'gaussian' && isBandMode" class="flex items-center gap-3">
        <label class="text-slate-400">中心</label>
        <input
          v-model.number="filterRadius"
          type="range"
          min="0.05"
          :max="radiusMax"
          step="0.01"
          class="flex-1"
        />
        <span class="text-slate-400">{{ filterRadius.toFixed(2) }}</span>
      </div>
      <div v-if="filterMode !== 'none' && filterShape === 'gaussian' && isBandMode" class="flex items-center gap-3">
        <label class="text-slate-400">带宽</label>
        <input
          v-model.number="filterBandwidth"
          type="range"
          min="0.02"
          :max="bandwidthMax"
          step="0.01"
          class="flex-1"
        />
        <span class="text-slate-400">{{ filterBandwidth.toFixed(2) }}</span>
      </div>
    </div>
    <div class="mb-4 grid gap-3 text-xs text-slate-300" v-else>
      <div class="flex flex-wrap items-center gap-3">
        <label class="text-slate-400">小波</label>
        <select
          v-model="dwtWavelet"
          class="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-200"
        >
          <option v-for="wavelet in dwtWavelets" :key="wavelet" :value="wavelet">
            {{ wavelet }}
          </option>
        </select>
        <label class="text-slate-400">层级</label>
        <select
          v-model.number="dwtLevel"
          class="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-200"
        >
          <option v-for="level in dwtLevels" :key="level" :value="level">
            {{ level }}
          </option>
        </select>
        <label class="text-slate-400">滤波</label>
        <select
          v-model="dwtFilterMode"
          class="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-200"
        >
          <option value="none">无</option>
          <option value="ll-only">仅保留LL</option>
          <option value="suppress-high">抑制高频</option>
          <option value="threshold">阈值去噪</option>
        </select>
      </div>
      <div v-if="dwtFilterMode === 'suppress-high'" class="flex items-center gap-3">
        <label class="text-slate-400">高频增益</label>
        <input
          v-model.number="dwtDetailGain"
          type="range"
          min="0"
          max="1"
          step="0.05"
          class="flex-1"
        />
        <span class="text-slate-400">{{ dwtDetailGain.toFixed(2) }}</span>
      </div>
      <div v-if="dwtFilterMode === 'threshold'" class="flex items-center gap-3">
        <label class="text-slate-400">阈值</label>
        <input
          v-model.number="dwtThreshold"
          type="range"
          min="0"
          max="50"
          step="1"
          class="flex-1"
        />
        <span class="text-slate-400">{{ dwtThreshold.toFixed(0) }}</span>
      </div>
    </div>

    <div class="flex-1 flex items-center justify-center bg-slate-800 rounded-lg border border-slate-700 p-6">
      <div v-if="!imageSrc" class="text-center py-12">
        <svg class="w-20 h-20 mx-auto mb-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <p class="text-slate-500">请先选择图像以查看频率域</p>
      </div>

      <div v-else class="w-full h-full flex items-center justify-center">
        <div class="relative w-full max-w-full">
          <div
            v-if="processing"
            class="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-900/70 rounded border border-slate-700"
          >
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mb-4"></div>
            <p class="text-slate-400">正在计算 {{ transformType }}...</p>
          </div>
          <canvas
            ref="canvasRef"
            class="max-w-full max-h-[60vh] rounded border border-slate-600 shadow-lg bg-slate-900"
            style="display: block;"
          ></canvas>
          <canvas
            v-if="showMask"
            ref="maskCanvasRef"
            class="absolute inset-0 max-w-full max-h-[60vh] rounded border border-transparent opacity-40"
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
import { computed, ref, watch, nextTick } from 'vue'
import {
  applyDWTFilter,
  applyMaskToMatrix,
  applyMaskToSpectrum,
  buildDCTMask,
  buildMask,
  computeBandEnergyFromComplex,
  computeBandEnergyFromMatrix,
  computeDCTDisplayFromCoefficients,
  computeDWTDisplayFromCoefficients,
  computeDWTStats,
  computeIDCTImage,
  computeIDWTImage,
  computeIFFTImage,
  getDwtWavelets,
  getOrCreateDCT,
  getOrCreateDFT,
  getOrCreateDWT,
  renderMatToCanvas,
} from '../composables/useFrequency'
import * as frequencyOps from '../composables/useFrequency'

const props = defineProps({
  imageId: {
    type: String,
    default: null,
  },
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

const emit = defineEmits(['reconstruction-ready', 'stats-ready'])

const canvasRef = ref(null)
const maskCanvasRef = ref(null)
const processing = ref(false)
let taskToken = 0
const filterMode = ref('none')
const filterShape = ref('ideal')
const filterRadius = ref(0.2)
const filterBandwidth = ref(0.1)
const filterSigma = ref(0.1)
const showMask = ref(true)
const isBandMode = computed(() => filterMode.value === 'bandpass' || filterMode.value === 'bandstop')
const defaultBands = [
  { min: 0, max: 0.3 },
  { min: 0.3, max: 0.7 },
  { min: 0.7, max: 1 },
]
const isDwt = computed(() => props.transformType === 'DWT')
const radiusMax = computed(() => (props.transformType === 'DCT' ? 1 : 0.5))
const bandwidthMax = computed(() => (props.transformType === 'DCT' ? 1 : 0.5))
const sigmaMax = computed(() => (props.transformType === 'DCT' ? 1 : 0.5))
const dwtWavelets = getDwtWavelets()
const dwtLevels = [1, 2, 3]
const dwtWavelet = ref('haar')
const dwtLevel = ref(2)
const dwtFilterMode = ref('none')
const dwtThreshold = ref(10)
const dwtDetailGain = ref(0.4)

const performAnalysis = async () => {
  const currentToken = ++taskToken
  console.debug('[FrequencyView] performAnalysis:start', {
    hasImage: Boolean(props.imageSrc),
    hasCv: Boolean(props.cv),
    hasCanvas: Boolean(canvasRef.value),
    transformType: props.transformType,
    processing: processing.value,
    imageId: props.imageId,
  })
  await nextTick()

  if (!props.imageSrc || !props.cv || !canvasRef.value) {
    console.debug('[FrequencyView] performAnalysis:skip:missing-input', {
      hasImage: Boolean(props.imageSrc),
      hasCv: Boolean(props.cv),
      hasCanvas: Boolean(canvasRef.value),
    })
    return
  }

  if (!['DFT', 'DCT', 'DWT'].includes(props.transformType)) {
    console.debug('[FrequencyView] performAnalysis:skip:unsupported-transform', {
      transformType: props.transformType,
    })
    processing.value = false
    return
  }

  if (processing.value) {
    console.debug('[FrequencyView] performAnalysis:restart:processing')
  }

  processing.value = true
  await nextTick()
  try {
    if (currentToken !== taskToken) {
      return
    }
    if (!canvasRef.value) {
      console.debug('[FrequencyView] performAnalysis:skip:missing-canvas-after-processing')
      return
    }
    console.debug('[FrequencyView] performAnalysis:loadImage')
    let maskDisplay = null

    if (props.transformType === 'DFT') {
      const dftCacheKey = props.imageId ? `dft:${props.imageId}` : null
      const dftResult = await getOrCreateDFT({
        cacheKey: dftCacheKey,
        imageSrc: props.imageSrc,
        cv: props.cv,
      })
      if (currentToken !== taskToken) {
        return
      }
      let shiftedForDisplay = dftResult.shiftedDFT
      let filteredShifted = null
      let mask = null

      if (filterMode.value !== 'none') {
        mask = buildMask({
          mode: filterMode.value,
          shape: filterShape.value,
          radius: filterRadius.value,
          bandwidth: filterBandwidth.value,
          sigma: filterSigma.value,
        }, dftResult.meta.padSize, props.cv)
        filteredShifted = applyMaskToSpectrum(dftResult.shiftedDFT, mask, props.cv)
        shiftedForDisplay = filteredShifted

        if (showMask.value && maskCanvasRef.value) {
          maskDisplay = new props.cv.Mat()
          mask.convertTo(maskDisplay, props.cv.CV_8U, 255)
          maskCanvasRef.value.width = maskDisplay.cols
          maskCanvasRef.value.height = maskDisplay.rows
          renderMatToCanvas(maskDisplay, maskCanvasRef.value, props.cv)
        }
      }

      if (maskCanvasRef.value && (!showMask.value || filterMode.value === 'none')) {
        const ctx = maskCanvasRef.value.getContext('2d')
        ctx?.clearRect(0, 0, maskCanvasRef.value.width, maskCanvasRef.value.height)
      }

      const spectrumMat = frequencyOps.computeFrequencyDisplayFromShifted(shiftedForDisplay, props.cv)
      canvasRef.value.width = spectrumMat.cols
      canvasRef.value.height = spectrumMat.rows
      renderMatToCanvas(spectrumMat, canvasRef.value, props.cv)
      const stats = computeBandEnergyFromComplex(shiftedForDisplay, defaultBands, props.cv)
      const ratioSum = stats.ratios.reduce((sum, value) => sum + value, 0)
      if (Math.abs(ratioSum - 100) > 1e-3) {
        console.debug('[FrequencyView] stats:ratio-sum', ratioSum)
      }
      spectrumMat.delete()
      console.debug('[FrequencyView] performAnalysis:rendered', {
        cols: canvasRef.value.width,
        rows: canvasRef.value.height,
      })

      if (currentToken !== taskToken) {
        if (filteredShifted) filteredShifted.delete()
        if (mask) mask.delete()
        if (maskDisplay) maskDisplay.delete()
        return
      }

      const reconstructedMat = computeIFFTImage(shiftedForDisplay, dftResult.meta, props.cv)
      const tempCanvas = document.createElement('canvas')
      tempCanvas.width = reconstructedMat.cols
      tempCanvas.height = reconstructedMat.rows
      renderMatToCanvas(reconstructedMat, tempCanvas, props.cv)
      const reconstructedSrc = tempCanvas.toDataURL('image/png')
      reconstructedMat.delete()
      emit('reconstruction-ready', reconstructedSrc)
      emit('stats-ready', stats)

      if (filteredShifted) filteredShifted.delete()
      if (mask) mask.delete()
      if (maskDisplay) maskDisplay.delete()
    }

    if (props.transformType === 'DCT') {
      const dctCacheKey = props.imageId ? `dct:${props.imageId}` : null
      const dctResult = await getOrCreateDCT({
        cacheKey: dctCacheKey,
        imageSrc: props.imageSrc,
        cv: props.cv,
      })
      if (currentToken !== taskToken) {
        return
      }

      let coeffForDisplay = dctResult.coefficients
      let filteredCoeff = null
      let mask = null

      if (filterMode.value !== 'none') {
        mask = buildDCTMask({
          mode: filterMode.value,
          shape: filterShape.value,
          radius: filterRadius.value,
          bandwidth: filterBandwidth.value,
          sigma: filterSigma.value,
        }, { width: dctResult.coefficients.cols, height: dctResult.coefficients.rows }, props.cv)
        filteredCoeff = applyMaskToMatrix(dctResult.coefficients, mask, props.cv)
        coeffForDisplay = filteredCoeff

        if (showMask.value && maskCanvasRef.value) {
          maskDisplay = new props.cv.Mat()
          mask.convertTo(maskDisplay, props.cv.CV_8U, 255)
          maskCanvasRef.value.width = maskDisplay.cols
          maskCanvasRef.value.height = maskDisplay.rows
          renderMatToCanvas(maskDisplay, maskCanvasRef.value, props.cv)
        }
      }

      if (maskCanvasRef.value && (!showMask.value || filterMode.value === 'none')) {
        const ctx = maskCanvasRef.value.getContext('2d')
        ctx?.clearRect(0, 0, maskCanvasRef.value.width, maskCanvasRef.value.height)
      }

      const displayMat = computeDCTDisplayFromCoefficients(coeffForDisplay, props.cv)
      canvasRef.value.width = displayMat.cols
      canvasRef.value.height = displayMat.rows
      renderMatToCanvas(displayMat, canvasRef.value, props.cv)
      const stats = computeBandEnergyFromMatrix(coeffForDisplay, defaultBands)
      const ratioSum = stats.ratios.reduce((sum, value) => sum + value, 0)
      if (Math.abs(ratioSum - 100) > 1e-3) {
        console.debug('[FrequencyView] stats:ratio-sum', ratioSum)
      }
      displayMat.delete()
      console.debug('[FrequencyView] performAnalysis:rendered', {
        cols: canvasRef.value.width,
        rows: canvasRef.value.height,
      })

      if (currentToken !== taskToken) {
        if (filteredCoeff) filteredCoeff.delete()
        if (mask) mask.delete()
        if (maskDisplay) maskDisplay.delete()
        return
      }

      const reconstructedMat = computeIDCTImage(coeffForDisplay, dctResult.meta, props.cv)
      const tempCanvas = document.createElement('canvas')
      tempCanvas.width = reconstructedMat.cols
      tempCanvas.height = reconstructedMat.rows
      renderMatToCanvas(reconstructedMat, tempCanvas, props.cv)
      const reconstructedSrc = tempCanvas.toDataURL('image/png')
      reconstructedMat.delete()
      emit('reconstruction-ready', reconstructedSrc)
      emit('stats-ready', stats)

      if (filteredCoeff) filteredCoeff.delete()
      if (mask) mask.delete()
      if (maskDisplay) maskDisplay.delete()
    }

    if (props.transformType === 'DWT') {
      if (maskCanvasRef.value) {
        const ctx = maskCanvasRef.value.getContext('2d')
        ctx?.clearRect(0, 0, maskCanvasRef.value.width, maskCanvasRef.value.height)
      }
      const dwtCacheKey = props.imageId ? `dwt:${props.imageId}:${dwtWavelet.value}:${dwtLevel.value}` : null
      const dwtResult = await getOrCreateDWT({
        cacheKey: dwtCacheKey,
        imageSrc: props.imageSrc,
        cv: props.cv,
        wavelet: dwtWavelet.value,
        levels: dwtLevel.value,
      })
      if (currentToken !== taskToken) {
        return
      }

      const filteredCoeff = dwtFilterMode.value === 'none'
        ? dwtResult.coefficients
        : applyDWTFilter(dwtResult.coefficients, dwtResult.meta, {
          mode: dwtFilterMode.value,
          threshold: dwtThreshold.value,
          detailGain: dwtDetailGain.value,
        })

      const displayMat = computeDWTDisplayFromCoefficients(filteredCoeff, dwtResult.meta.usedSize, props.cv)
      canvasRef.value.width = displayMat.cols
      canvasRef.value.height = displayMat.rows
      renderMatToCanvas(displayMat, canvasRef.value, props.cv)
      const stats = computeDWTStats(filteredCoeff, dwtResult.meta)
      const ratioSum = stats.llRatio + stats.detailRatio
      if (Math.abs(ratioSum - 100) > 1e-3) {
        console.debug('[FrequencyView] stats:ratio-sum', ratioSum)
      }
      displayMat.delete()
      console.debug('[FrequencyView] performAnalysis:rendered', {
        cols: canvasRef.value.width,
        rows: canvasRef.value.height,
      })

      if (currentToken !== taskToken) {
        return
      }

      const reconstructedMat = computeIDWTImage(filteredCoeff, dwtResult.meta, props.cv)
      const tempCanvas = document.createElement('canvas')
      tempCanvas.width = reconstructedMat.cols
      tempCanvas.height = reconstructedMat.rows
      renderMatToCanvas(reconstructedMat, tempCanvas, props.cv)
      const reconstructedSrc = tempCanvas.toDataURL('image/png')
      reconstructedMat.delete()
      emit('reconstruction-ready', reconstructedSrc)
      emit('stats-ready', { mode: 'dwt', ...stats })
    }
  } catch (error) {
    console.error('[FrequencyView] 频率域计算失败', error)
  } finally {
    processing.value = false
    console.debug('[FrequencyView] performAnalysis:done')
  }
}

watch([
  () => props.imageSrc,
  () => props.transformType,
  () => props.cv,
  () => props.imageId,
  () => filterMode.value,
  () => filterShape.value,
  () => filterRadius.value,
  () => filterBandwidth.value,
  () => filterSigma.value,
  () => showMask.value,
  () => dwtWavelet.value,
  () => dwtLevel.value,
  () => dwtFilterMode.value,
  () => dwtThreshold.value,
  () => dwtDetailGain.value,
], () => {
  console.debug('[FrequencyView] watch:inputs-changed', {
    hasImage: Boolean(props.imageSrc),
    hasCv: Boolean(props.cv),
    transformType: props.transformType,
    imageId: props.imageId,
    filterMode: filterMode.value,
    filterShape: filterShape.value,
    filterRadius: filterRadius.value,
    filterBandwidth: filterBandwidth.value,
    filterSigma: filterSigma.value,
    showMask: showMask.value,
    dwtWavelet: dwtWavelet.value,
    dwtLevel: dwtLevel.value,
    dwtFilterMode: dwtFilterMode.value,
    dwtThreshold: dwtThreshold.value,
    dwtDetailGain: dwtDetailGain.value,
  })
  performAnalysis()
}, { immediate: true })
</script>
