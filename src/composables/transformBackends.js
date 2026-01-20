import {
  applyDWTFilter,
  applyMaskToMatrix,
  applyMaskToSpectrum,
  buildDCTMask,
  buildMask,
  computeBandEnergyFromComplex,
  computeBandEnergyFromMatrix,
  computeDCTCoefficients,
  computeDCTDisplayFromCoefficients,
  computeDFTComplex,
  computeFrequencyDisplayFromShifted,
  computeDWTDisplayFromCoefficients,
  computeDWTStats,
  computeDWTCoefficients,
  computeDTCWTExperimental,
  computeDTCWTDisplay,
  computeDTCWTInverse,
  computeDTCWTStats,
  computeIDCTImage,
  computeIDWTImage,
  computeIFFTImage,
  computeWPTDisplayFromNodes,
  computeWPTStats,
  computeWPTCoefficients,
  computeIWPTImage,
  loadImageToMat,
} from './useFrequency'

const normalizeFilterSpec = (filterSpec) => {
  if (!filterSpec || filterSpec.mode === 'none') {
    return null
  }
  return filterSpec
}

const buildMaskDisplay = (maskMat, cv) => {
  if (!maskMat) {
    return null
  }
  const display = new cv.Mat()
  maskMat.convertTo(display, cv.CV_8U, 255)
  return display
}

const applyThreshold = (data, mode, lambda) => {
  if (!mode || lambda <= 0) {
    return data
  }
  const output = new Float32Array(data.length)
  for (let i = 0; i < data.length; i += 1) {
    const value = data[i]
    const abs = Math.abs(value)
    if (mode === 'hard') {
      output[i] = abs >= lambda ? value : 0
    } else if (mode === 'soft') {
      const sign = value >= 0 ? 1 : -1
      output[i] = abs >= lambda ? sign * (abs - lambda) : 0
    } else {
      output[i] = value
    }
  }
  return output
}

const computeEnergy = (data) => {
  let total = 0
  for (let i = 0; i < data.length; i += 1) {
    total += data[i] * data[i]
  }
  return total
}

export const DFTBackend = {
  id: 'DFT',
  getCacheKey(imageId, options = {}, filterSpec = null) {
    const base = imageId ? `dft:${imageId}` : 'dft:unknown'
    if (!filterSpec) {
      return base
    }
    return `${base}:${JSON.stringify(filterSpec)}`
  },
  async forward({ imageSrc, cv }) {
    const srcMat = await loadImageToMat(imageSrc, cv)
    try {
      const { complexDFT, shiftedDFT, meta } = computeDFTComplex(srcMat, cv)
      if (complexDFT) {
        complexDFT.delete()
      }
      return { shiftedDFT, meta }
    } finally {
      srcMat.delete()
    }
  },
  async applyFilter(state, filterSpec, cv) {
    const spec = normalizeFilterSpec(filterSpec)
    if (!spec) {
      return state
    }
    const mask = buildMask(spec, state.meta.padSize, cv)
    const filtered = applyMaskToSpectrum(state.shiftedDFT, mask, cv)
    return { shiftedDFT: filtered, meta: state.meta, mask }
  },
  async inverse(state, cv) {
    return computeIFFTImage(state.shiftedDFT, state.meta, cv)
  },
  getDisplay(state, cv) {
    const displayMat = computeFrequencyDisplayFromShifted(state.shiftedDFT, cv)
    const maskDisplay = state.mask ? buildMaskDisplay(state.mask, cv) : null
    return { displayMat, maskDisplay }
  },
  computeMetrics(state, cv) {
    return computeBandEnergyFromComplex(state.shiftedDFT, [
      { min: 0, max: 0.3 },
      { min: 0.3, max: 0.7 },
      { min: 0.7, max: 1 },
    ], cv)
  },
  dispose(state) {
    if (state?.shiftedDFT) state.shiftedDFT.delete()
    if (state?.mask) state.mask.delete()
  },
}

export const DCTBackend = {
  id: 'DCT',
  getCacheKey(imageId, options = {}, filterSpec = null) {
    const base = imageId ? `dct:${imageId}` : 'dct:unknown'
    if (!filterSpec) {
      return base
    }
    return `${base}:${JSON.stringify(filterSpec)}`
  },
  async forward({ imageSrc, cv }) {
    const srcMat = await loadImageToMat(imageSrc, cv)
    try {
      return computeDCTCoefficients(srcMat, cv)
    } finally {
      srcMat.delete()
    }
  },
  async applyFilter(state, filterSpec, cv) {
    const spec = normalizeFilterSpec(filterSpec)
    if (!spec) {
      return state
    }
    const mask = buildDCTMask(spec, {
      width: state.coefficients.cols,
      height: state.coefficients.rows,
    }, cv)
    const filtered = applyMaskToMatrix(state.coefficients, mask, cv)
    return { coefficients: filtered, meta: state.meta, mask }
  },
  async inverse(state, cv) {
    return computeIDCTImage(state.coefficients, state.meta, cv)
  },
  getDisplay(state, cv) {
    const displayMat = computeDCTDisplayFromCoefficients(state.coefficients, cv)
    const maskDisplay = state.mask ? buildMaskDisplay(state.mask, cv) : null
    return { displayMat, maskDisplay }
  },
  computeMetrics(state) {
    return computeBandEnergyFromMatrix(state.coefficients, [
      { min: 0, max: 0.3 },
      { min: 0.3, max: 0.7 },
      { min: 0.7, max: 1 },
    ])
  },
  dispose(state) {
    if (state?.coefficients) state.coefficients.delete()
    if (state?.mask) state.mask.delete()
  },
}

export const DWTBackend = {
  id: 'DWT',
  getCacheKey(imageId, options = {}, filterSpec = null) {
    const wavelet = options.wavelet || 'haar'
    const level = options.level || 1
    const base = imageId ? `dwt:${imageId}:${wavelet}:${level}` : `dwt:unknown:${wavelet}:${level}`
    if (!filterSpec) {
      return base
    }
    return `${base}:${JSON.stringify(filterSpec)}`
  },
  async forward({ imageSrc, cv }, options) {
    const srcMat = await loadImageToMat(imageSrc, cv)
    try {
      return computeDWTCoefficients(srcMat, options.wavelet, options.level, cv)
    } finally {
      srcMat.delete()
    }
  },
  async applyFilter(state, filterSpec) {
    const spec = normalizeFilterSpec(filterSpec)
    if (!spec) {
      return state
    }
    const filtered = applyDWTFilter(state.coefficients, state.meta, spec)
    return { ...state, coefficients: filtered }
  },
  async inverse(state, cv) {
    return computeIDWTImage(state.coefficients, state.meta, cv)
  },
  getDisplay(state, cv) {
    const displayMat = computeDWTDisplayFromCoefficients(state.coefficients, state.meta.padSize, cv)
    return { displayMat }
  },
  computeMetrics(state) {
    return computeDWTStats(state.coefficients, state.meta)
  },
  dispose(state) {
    if (state?.coefficients && state.coefficients.length) {
      state.coefficients = null
    }
  },
}

export const WPTBackend = {
  id: 'WPT',
  getCacheKey(imageId, options = {}, filterSpec = null) {
    const wavelet = options.wavelet || 'haar'
    const level = options.level || 3
    const base = imageId ? `wpt:${imageId}:${wavelet}:${level}` : `wpt:unknown:${wavelet}:${level}`
    if (!filterSpec) {
      return base
    }
    return `${base}:${JSON.stringify(filterSpec)}`
  },
  async forward({ imageSrc, cv }, options) {
    const srcMat = await loadImageToMat(imageSrc, cv)
    try {
      return computeWPTCoefficients(srcMat, options.wavelet, options.level, cv)
    } finally {
      srcMat.delete()
    }
  },
  async applyFilter(state, filterSpec) {
    const spec = normalizeFilterSpec(filterSpec)
    if (!spec) {
      return state
    }
    const selected = spec.selectedNodes || []
    const isSelected = (path) => selected.some((sel) => path === sel || path.startsWith(`${sel}/`))
    const filtered = state.nodes.map((node) => {
      if (!node.isLeaf) {
        return node
      }
      const keep = selected.length ? isSelected(node.path) : true
      const data = keep ? node.data : new Float32Array(node.data.length)
      const thresholded = keep && spec.thresholdMode ? applyThreshold(data, spec.thresholdMode, spec.lambda || 0) : data
      return { ...node, data: thresholded, energy: computeEnergy(thresholded) }
    })
    return { ...state, nodes: filtered }
  },
  async inverse(state, cv) {
    return computeIWPTImage(state.nodes, state.meta, cv)
  },
  getDisplay(state, cv) {
    const displayMat = computeWPTDisplayFromNodes(state.nodes, state.meta, cv)
    return { displayMat }
  },
  computeMetrics(state) {
    return computeWPTStats(state.nodes, state.meta)
  },
  dispose(state) {
    if (state?.nodes) {
      state.nodes = null
    }
  },
}

export const DTCWTBackend = {
  id: 'DT-CWT',
  getCacheKey(imageId, options = {}, filterSpec = null) {
    const base = imageId ? `dtcwt:${imageId}` : 'dtcwt:unknown'
    if (!filterSpec) {
      return base
    }
    return `${base}:${JSON.stringify(filterSpec)}`
  },
  async forward({ imageSrc, cv }) {
    const srcMat = await loadImageToMat(imageSrc, cv)
    try {
      return computeDTCWTExperimental(srcMat, cv)
    } finally {
      srcMat.delete()
    }
  },
  async applyFilter(state, filterSpec) {
    const spec = normalizeFilterSpec(filterSpec)
    if (!spec) {
      return state
    }
    const selected = spec.selectedDirections || []
    const filtered = state.directions.map((dir) => {
      const keep = selected.length ? selected.includes(dir.id) : true
      const data = keep ? dir.data : new Float32Array(dir.data.length)
      const thresholded = keep && spec.thresholdMode ? applyThreshold(data, spec.thresholdMode, spec.lambda || 0) : data
      return { ...dir, data: thresholded }
    })
    return { ...state, directions: filtered }
  },
  async inverse(state, cv) {
    return computeDTCWTInverse(state.directions, state.lowpass, state.meta.size, cv)
  },
  getDisplay(state, cv) {
    const displayMat = computeDTCWTDisplay(state.directions, state.meta.size, cv)
    return { displayMat }
  },
  computeMetrics(state) {
    return computeDTCWTStats(state.directions)
  },
  dispose(state) {
    if (state?.directions) {
      state.directions = null
    }
  },
}

export const getTransformBackend = (transformType) => {
  if (transformType === 'DFT') return DFTBackend
  if (transformType === 'DCT') return DCTBackend
  if (transformType === 'DWT') return DWTBackend
  if (transformType === 'WPT') return WPTBackend
  if (transformType === 'DT-CWT') return DTCWTBackend
  return null
}
