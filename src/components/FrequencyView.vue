<template>
  <div class="h-full flex flex-col">
    <div class="mb-4 flex items-center justify-between">
      <h2 class="text-xl font-semibold text-cyan-300">频率域视图</h2>
      <span v-if="transformType" class="text-xs px-2 py-1 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
        {{ transformType }}
      </span>
    </div>

    <div class="mb-4 grid gap-3 text-xs text-slate-300" v-if="isDftOrDct">
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
    <div class="mb-4 grid gap-3 text-xs text-slate-300" v-else-if="isDwt">
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
    <div class="mb-4 grid gap-3 text-xs text-slate-300" v-else-if="isWpt">
      <div class="flex flex-wrap items-center gap-3">
        <label class="text-slate-400">小波</label>
        <select
          v-model="wptWavelet"
          class="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-200"
        >
          <option v-for="wavelet in dwtWavelets" :key="wavelet" :value="wavelet">
            {{ wavelet }}
          </option>
        </select>
        <label class="text-slate-400">层级</label>
        <select
          v-model.number="wptLevel"
          class="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-200"
        >
          <option v-for="level in dwtLevels" :key="level" :value="level">
            {{ level }}
          </option>
        </select>
        <label class="text-slate-400">阈值</label>
        <select
          v-model="wptThresholdMode"
          class="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-200"
        >
          <option value="none">无</option>
          <option value="hard">硬阈值</option>
          <option value="soft">软阈值</option>
        </select>
      </div>
      <div v-if="wptThresholdMode !== 'none'" class="flex items-center gap-3">
        <label class="text-slate-400">lambda</label>
        <input
          v-model.number="wptLambda"
          type="range"
          min="0"
          max="50"
          step="1"
          class="flex-1"
        />
        <span class="text-slate-400">{{ wptLambda.toFixed(0) }}</span>
      </div>
      <div class="flex items-center justify-between text-xs text-slate-400">
        <span>节点选择</span>
        <div class="flex gap-2">
          <button
            type="button"
            class="px-2 py-1 rounded bg-slate-700/60 text-slate-200"
            @click="selectLowFreqWpt"
          >
            仅低频
          </button>
          <button
            type="button"
            class="px-2 py-1 rounded bg-slate-700/60 text-slate-200"
            @click="selectAllWpt"
          >
            全选
          </button>
          <button
            type="button"
            class="px-2 py-1 rounded bg-slate-700/60 text-slate-200"
            @click="clearWptSelection"
          >
            清空
          </button>
        </div>
      </div>
      <div class="max-h-44 overflow-y-auto pr-1">
        <WptTreeNode
          v-if="wptTreeRoot"
          :node="wptTreeRoot"
          :selected="wptSelectedNodes"
          @toggle="toggleWptNode"
        />
      </div>
      <div class="space-y-2">
        <div class="text-xs text-slate-500">Level 能量占比</div>
        <div class="flex items-end gap-2 h-20">
          <div
            v-for="bucket in wptLevelBuckets"
            :key="bucket.level"
            class="flex-1 flex flex-col items-center"
          >
            <div class="w-full bg-slate-700 rounded h-20 flex items-end overflow-hidden">
              <div
                class="w-full bg-cyan-500/70"
                :style="{ height: `${bucket.ratio.toFixed(2)}%` }"
              ></div>
            </div>
            <span class="text-[10px] text-slate-500 mt-1">L{{ bucket.level }}</span>
          </div>
        </div>
      </div>
    </div>
    <div class="mb-4 grid gap-3 text-xs text-slate-300" v-else>
      <div class="flex flex-wrap items-center gap-3">
        <label class="text-slate-400">Experimental</label>
        <label class="flex items-center gap-2 text-slate-400">
          <input v-model="dtcwtEnabled" type="checkbox" class="accent-cyan-500" />
          启用 DT-CWT
        </label>
        <label class="text-slate-400">阈值</label>
        <select
          v-model="dtcwtThresholdMode"
          class="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-200"
          :disabled="!dtcwtEnabled"
        >
          <option value="none">无</option>
          <option value="hard">硬阈值</option>
          <option value="soft">软阈值</option>
        </select>
      </div>
      <div v-if="dtcwtEnabled && dtcwtThresholdMode !== 'none'" class="flex items-center gap-3">
        <label class="text-slate-400">lambda</label>
        <input
          v-model.number="dtcwtLambda"
          type="range"
          min="0"
          max="50"
          step="1"
          class="flex-1"
        />
        <span class="text-slate-400">{{ dtcwtLambda.toFixed(0) }}</span>
      </div>
      <div class="flex items-center justify-between text-xs text-slate-400">
        <span>方向选择</span>
        <div class="flex gap-2">
          <button
            type="button"
            class="px-2 py-1 rounded bg-slate-700/60 text-slate-200"
            @click="selectAllDtcwt"
            :disabled="!dtcwtEnabled"
          >
            全选
          </button>
          <button
            type="button"
            class="px-2 py-1 rounded bg-slate-700/60 text-slate-200"
            @click="clearDtcwtSelection"
            :disabled="!dtcwtEnabled"
          >
            清空
          </button>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto pr-1">
        <label
          v-for="dir in dtcwtDirections"
          :key="dir.id"
          class="flex items-center gap-2 px-2 py-1 rounded border border-slate-700 bg-slate-900/50"
        >
          <input
            type="checkbox"
            :value="dir.id"
            v-model="dtcwtSelectedDirections"
            class="accent-cyan-500"
            :disabled="!dtcwtEnabled"
          />
          <span class="text-slate-300">{{ dir.label }}</span>
          <span class="ml-auto text-slate-500">{{ dir.ratio.toFixed(1) }}%</span>
        </label>
      </div>
      <div v-if="!dtcwtEnabled" class="text-xs text-slate-500">
        实验功能默认关闭，启用后才会计算与重建。
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
            v-if="showMask && isDftOrDct"
            ref="maskCanvasRef"
            class="absolute inset-0 max-w-full max-h-[60vh] rounded border border-transparent opacity-40"
            style="display: block;"
          ></canvas>
          <div v-if="imageSrc && !processing" class="mt-3 text-xs text-slate-400 text-center">
            <p v-if="transformType === 'DFT'">Log-Magnitude 频谱图（零频率位于中心）</p>
            <p v-else-if="transformType === 'DCT'">DCT 系数可视化</p>
            <p v-else-if="transformType === 'DWT'">DWT 子带系数拼图</p>
            <p v-else-if="transformType === 'WPT'">WPT 节点系数拼图</p>
            <p v-else>变换系数可视化</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, defineComponent, ref, watch, nextTick } from 'vue'
import { renderMatToCanvas, getDwtWavelets } from '../composables/useFrequency'
import { useTransformEngine } from '../composables/useTransformEngine'

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

const engine = useTransformEngine()

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
const isDwt = computed(() => props.transformType === 'DWT')
const isWpt = computed(() => props.transformType === 'WPT')
const isDtcwt = computed(() => props.transformType === 'DT-CWT')
const isDftOrDct = computed(() => ['DFT', 'DCT'].includes(props.transformType))
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
const wptWavelet = ref('haar')
const wptLevel = ref(3)
const wptSelectedNodes = ref([])
const wptThresholdMode = ref('none')
const wptLambda = ref(10)
const wptNodes = ref([])
const wptLevelBuckets = ref([])
const wptLeafNodes = ref([])
const dtcwtEnabled = ref(false)
const dtcwtThresholdMode = ref('none')
const dtcwtLambda = ref(10)
const dtcwtDirections = ref([])
const dtcwtSelectedDirections = ref([])
let debounceTimer = null

const buildTree = (nodes) => {
  if (!nodes.length) {
    return null
  }
  const map = new Map()
  nodes.forEach((node) => {
    map.set(node.id, { ...node, children: [] })
  })
  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId).children.push(node)
    }
  }
  return map.get('root') || map.values().next().value
}

const wptTreeRoot = computed(() => buildTree(wptNodes.value))

const isWptNodeSelected = (path) => {
  if (!path) {
    return false
  }
  return wptSelectedNodes.value.some((selected) => path === selected || selected.startsWith(`${path}/`))
}

const toggleWptNode = (path) => {
  if (!path) {
    return
  }
  const selected = new Set(wptSelectedNodes.value)
  if (selected.has(path)) {
    selected.delete(path)
  } else {
    selected.add(path)
  }
  wptSelectedNodes.value = Array.from(selected)
}

const selectAllWpt = () => {
  wptSelectedNodes.value = wptLeafNodes.value.map((node) => node.path)
}

const clearWptSelection = () => {
  wptSelectedNodes.value = []
}

const selectLowFreqWpt = () => {
  wptSelectedNodes.value = wptLeafNodes.value
    .filter((node) => node.path && node.path.startsWith('LL'))
    .map((node) => node.path)
}

const selectAllDtcwt = () => {
  dtcwtSelectedDirections.value = dtcwtDirections.value.map((dir) => dir.id)
}

const clearDtcwtSelection = () => {
  dtcwtSelectedDirections.value = []
}

const WptTreeNode = defineComponent({
  name: 'WptTreeNode',
  props: {
    node: {
      type: Object,
      required: true,
    },
    selected: {
      type: Array,
      default: () => [],
    },
  },
  emits: ['toggle'],
  setup(props, { emit }) {
    const isSelected = computed(() => {
      if (!props.node.path) {
        return false
      }
      return props.selected.some((item) => props.node.path === item || item.startsWith(`${props.node.path}/`))
    })

    const onToggle = () => {
      if (props.node.path) {
        emit('toggle', props.node.path)
      }
    }

    return { isSelected, onToggle }
  },
  template: `
    <div class="space-y-1">
      <div class="flex items-center gap-2 text-xs px-2 py-1 rounded border border-slate-700 bg-slate-900/50">
        <button
          type="button"
          class="w-4 h-4 rounded border border-slate-600 flex items-center justify-center text-[10px]"
          :class="isSelected ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500' : 'text-slate-400'"
          @click="onToggle"
        >
          <span v-if="isSelected">✓</span>
        </button>
        <span class="text-slate-300">{{ node.path || 'root' }}</span>
        <span class="ml-auto text-slate-500">{{ (node.energyRatio * 100).toFixed(1) }}%</span>
      </div>
      <div v-if="node.children && node.children.length" class="ml-4 space-y-1">
        <WptTreeNode
          v-for="child in node.children"
          :key="child.id"
          :node="child"
          :selected="selected"
          @toggle="$emit('toggle', $event)"
        />
      </div>
    </div>
  `,
})

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

  if (!['DFT', 'DCT', 'DWT', 'WPT', 'DT-CWT'].includes(props.transformType)) {
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

    const options = {}
    if (isDwt.value) {
      options.wavelet = dwtWavelet.value
      options.level = dwtLevel.value
    }
    if (isWpt.value) {
      options.wavelet = wptWavelet.value
      options.level = wptLevel.value
    }
    if (isDtcwt.value && !dtcwtEnabled.value) {
      const ctx = canvasRef.value?.getContext('2d')
      ctx?.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height)
      emit('stats-ready', null)
      return
    }

    let filterSpec = { mode: 'none' }
    if (isDftOrDct.value) {
      filterSpec = {
        mode: filterMode.value,
        shape: filterShape.value,
        radius: filterRadius.value,
        bandwidth: filterBandwidth.value,
        sigma: filterSigma.value,
      }
    }
    if (isDwt.value) {
      filterSpec = {
        mode: dwtFilterMode.value,
        threshold: dwtThreshold.value,
        detailGain: dwtDetailGain.value,
      }
    }
    if (isWpt.value) {
      filterSpec = {
        mode: wptSelectedNodes.value.length || wptThresholdMode.value !== 'none' ? 'wpt' : 'none',
        selectedNodes: wptSelectedNodes.value,
        thresholdMode: wptThresholdMode.value,
        lambda: wptLambda.value,
      }
    }
    if (isDtcwt.value) {
      filterSpec = {
        mode: dtcwtEnabled.value ? 'dtcwt' : 'none',
        selectedDirections: dtcwtSelectedDirections.value,
        thresholdMode: dtcwtThresholdMode.value,
        lambda: dtcwtLambda.value,
      }
    }

    const result = await engine.runTransform({
      transformType: props.transformType,
      imageId: props.imageId,
      imageSrc: props.imageSrc,
      cv: props.cv,
      options,
      filterSpec,
    })

    if (currentToken !== taskToken || result.cancelled) {
      return
    }

    const displayMat = result.display?.displayMat
    const maskDisplay = result.display?.maskDisplay

    if (displayMat) {
      canvasRef.value.width = displayMat.cols
      canvasRef.value.height = displayMat.rows
      renderMatToCanvas(displayMat, canvasRef.value, props.cv)
      displayMat.delete()
    }

    if (showMask.value && maskDisplay && maskCanvasRef.value) {
      maskCanvasRef.value.width = maskDisplay.cols
      maskCanvasRef.value.height = maskDisplay.rows
      renderMatToCanvas(maskDisplay, maskCanvasRef.value, props.cv)
      maskDisplay.delete()
    } else if (maskCanvasRef.value) {
      const ctx = maskCanvasRef.value.getContext('2d')
      ctx?.clearRect(0, 0, maskCanvasRef.value.width, maskCanvasRef.value.height)
    }

    if (result.reconstructedMat) {
      const tempCanvas = document.createElement('canvas')
      tempCanvas.width = result.reconstructedMat.cols
      tempCanvas.height = result.reconstructedMat.rows
      renderMatToCanvas(result.reconstructedMat, tempCanvas, props.cv)
      const reconstructedSrc = tempCanvas.toDataURL('image/png')
      result.reconstructedMat.delete()
      emit('reconstruction-ready', reconstructedSrc)
    }

    if (result.metrics) {
      emit('stats-ready', result.metrics)
      if (isWpt.value && result.metrics.nodes) {
        wptNodes.value = result.metrics.nodes
        wptLeafNodes.value = result.metrics.leafNodes || []
        wptLevelBuckets.value = result.metrics.levelBuckets || []
        if (wptSelectedNodes.value.length === 0) {
          wptSelectedNodes.value = (result.metrics.leafNodes || []).map((node) => node.path)
        }
      }
      if (isDtcwt.value && result.metrics.perDirectionEnergy) {
        dtcwtDirections.value = result.metrics.perDirectionEnergy
        if (dtcwtSelectedDirections.value.length === 0) {
          dtcwtSelectedDirections.value = result.metrics.perDirectionEnergy.map((dir) => dir.id)
        }
      }
      if (Array.isArray(result.metrics.ratios)) {
        const ratioSum = result.metrics.ratios.reduce((sum, value) => sum + value, 0)
        if (Math.abs(ratioSum - 100) > 1e-3) {
          console.debug('[FrequencyView] metrics:ratio-sum', ratioSum)
        }
      } else if (typeof result.metrics.llRatio === 'number') {
        const ratioSum = result.metrics.llRatio + (result.metrics.detailRatio || 0)
        if (Math.abs(ratioSum - 100) > 1e-3) {
          console.debug('[FrequencyView] metrics:ratio-sum', ratioSum)
        }
      } else if (Array.isArray(result.metrics.nodes)) {
        const ratioSum = result.metrics.nodes.reduce((sum, node) => sum + node.ratio, 0)
        if (Math.abs(ratioSum - 100) > 1e-3) {
          console.debug('[FrequencyView] metrics:ratio-sum', ratioSum)
        }
      }
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
  () => wptWavelet.value,
  () => wptLevel.value,
  () => wptThresholdMode.value,
  () => wptLambda.value,
  () => wptSelectedNodes.value.join('|'),
  () => dtcwtEnabled.value,
  () => dtcwtThresholdMode.value,
  () => dtcwtLambda.value,
  () => dtcwtSelectedDirections.value.join('|'),
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
    wptWavelet: wptWavelet.value,
    wptLevel: wptLevel.value,
    wptThresholdMode: wptThresholdMode.value,
    wptLambda: wptLambda.value,
    wptSelectedNodes: wptSelectedNodes.value.length,
    dtcwtEnabled: dtcwtEnabled.value,
    dtcwtThresholdMode: dtcwtThresholdMode.value,
    dtcwtLambda: dtcwtLambda.value,
    dtcwtSelectedDirections: dtcwtSelectedDirections.value.length,
  })
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }
  if (isWpt.value || isDtcwt.value) {
    debounceTimer = setTimeout(() => {
      performAnalysis()
    }, 150)
  } else {
    performAnalysis()
  }
}, { immediate: true })

watch([() => wptWavelet.value, () => wptLevel.value], () => {
  wptSelectedNodes.value = []
})

watch([() => dtcwtEnabled.value], () => {
  if (!dtcwtEnabled.value) {
    dtcwtSelectedDirections.value = []
  }
})
</script>
