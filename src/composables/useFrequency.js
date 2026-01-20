/**
 * 频率域处理 Composable
 * 实现 FFT、频率域可视化和 iFFT 重建
 * 
 * 关键规则：
 * 1. 所有 cv.Mat 对象必须手动调用 .delete() 释放内存
 * 2. 使用 try...finally 确保内存释放
 * 3. 不要将 cv.Mat 对象包装在 Vue 的 ref/reactive 中
 */

/**
 * FFT Shift (象限交换)
 * 将零频率（DC 分量）移到图像中心
 * 
 * @param {cv.Mat} mat - 输入矩阵（单通道）
 * @param {cv.Mat} cv - OpenCV 对象
 * @returns {cv.Mat} - 交换后的矩阵
 */
export function fftShift(mat, cv) {
  const rows = mat.rows
  const cols = mat.cols
  const halfRows = Math.floor(rows / 2)
  const halfCols = Math.floor(cols / 2)
  
  // 创建结果矩阵
  const result = new cv.Mat.zeros(rows, cols, mat.type())
  
  // 提取四个象限
  const q1 = mat.roi(new cv.Rect(0, 0, halfCols, halfRows))
  const q2 = mat.roi(new cv.Rect(halfCols, 0, cols - halfCols, halfRows))
  const q3 = mat.roi(new cv.Rect(0, halfRows, halfCols, rows - halfRows))
  const q4 = mat.roi(new cv.Rect(halfCols, halfRows, cols - halfCols, rows - halfRows))
  
  try {
    // Q1 -> Q4 位置（右下）
    q1.copyTo(result.roi(new cv.Rect(halfCols, halfRows, halfCols, halfRows)))
    // Q4 -> Q1 位置（左上）
    q4.copyTo(result.roi(new cv.Rect(0, 0, cols - halfCols, rows - halfRows)))
    // Q2 -> Q3 位置（左下）
    q2.copyTo(result.roi(new cv.Rect(0, halfRows, cols - halfCols, halfRows)))
    // Q3 -> Q2 位置（右上）
    q3.copyTo(result.roi(new cv.Rect(halfCols, 0, halfCols, rows - halfRows)))
    
    return result
  } finally {
    // 清理 ROI 对象
    q1.delete()
    q2.delete()
    q3.delete()
    q4.delete()
  }
}

const dftCache = new Map()
const MAX_DFT_CACHE = 3
const dctCache = new Map()
const MAX_DCT_CACHE = 3

const dctCosCache = new Map()
const dwtCache = new Map()
const MAX_DWT_CACHE = 3

const WAVELETS = {
  haar: {
    decLo: [0.7071067811865476, 0.7071067811865476],
    decHi: [-0.7071067811865476, 0.7071067811865476],
    recLo: [0.7071067811865476, 0.7071067811865476],
    recHi: [0.7071067811865476, -0.7071067811865476],
  },
  db2: {
    decLo: [-0.12940952255126034, 0.2241438680420134, 0.8365163037378079, 0.48296291314469025],
    decHi: [-0.48296291314469025, 0.8365163037378079, -0.2241438680420134, -0.12940952255126034],
    recLo: [0.48296291314469025, 0.8365163037378079, 0.2241438680420134, -0.12940952255126034],
    recHi: [-0.12940952255126034, -0.2241438680420134, 0.8365163037378079, -0.48296291314469025],
  },
}

const getDctCosTable = (size) => {
  if (dctCosCache.has(size)) {
    return dctCosCache.get(size)
  }
  const table = new Float32Array(size * size)
  const factor = Math.PI / (2 * size)
  for (let u = 0; u < size; u += 1) {
    for (let x = 0; x < size; x += 1) {
      table[u * size + x] = Math.cos((2 * x + 1) * u * factor)
    }
  }
  dctCosCache.set(size, table)
  return table
}

const dct1d = (input, size, cosTable) => {
  const output = new Float32Array(size)
  const scale0 = Math.sqrt(1 / size)
  const scale = Math.sqrt(2 / size)
  for (let u = 0; u < size; u += 1) {
    let sum = 0
    const rowOffset = u * size
    for (let x = 0; x < size; x += 1) {
      sum += input[x] * cosTable[rowOffset + x]
    }
    output[u] = (u === 0 ? scale0 : scale) * sum
  }
  return output
}

const idct1d = (input, size, cosTable) => {
  const output = new Float32Array(size)
  const scale0 = Math.sqrt(1 / size)
  const scale = Math.sqrt(2 / size)
  for (let x = 0; x < size; x += 1) {
    let sum = 0
    for (let u = 0; u < size; u += 1) {
      const alpha = u === 0 ? scale0 : scale
      sum += alpha * input[u] * cosTable[u * size + x]
    }
    output[x] = sum
  }
  return output
}

const touchCacheKey = (key, value) => {
  if (dftCache.has(key)) {
    dftCache.delete(key)
  }
  dftCache.set(key, value)
}

const evictIfNeeded = () => {
  while (dftCache.size > MAX_DFT_CACHE) {
    const [oldestKey, oldestValue] = dftCache.entries().next().value
    if (oldestValue?.complexDFT) oldestValue.complexDFT.delete()
    if (oldestValue?.shiftedDFT) oldestValue.shiftedDFT.delete()
    dftCache.delete(oldestKey)
  }
}

export const clearDFTCache = () => {
  for (const [, value] of dftCache) {
    if (value?.complexDFT) value.complexDFT.delete()
    if (value?.shiftedDFT) value.shiftedDFT.delete()
  }
  dftCache.clear()
}

export const clearDCTCache = () => {
  for (const [, value] of dctCache) {
    if (value?.coefficients) value.coefficients.delete()
  }
  dctCache.clear()
}

export const clearDWTCache = () => {
  dwtCache.clear()
}

export const getCachedDFT = (cacheKey) => {
  if (!cacheKey || !dftCache.has(cacheKey)) {
    return null
  }
  const value = dftCache.get(cacheKey)
  touchCacheKey(cacheKey, value)
  return value
}

export const setCachedDFT = (cacheKey, value) => {
  if (!cacheKey || !value) {
    return
  }
  touchCacheKey(cacheKey, value)
  evictIfNeeded()
}

const touchDctCacheKey = (key, value) => {
  if (dctCache.has(key)) {
    dctCache.delete(key)
  }
  dctCache.set(key, value)
}

const evictDctIfNeeded = () => {
  while (dctCache.size > MAX_DCT_CACHE) {
    const [oldestKey, oldestValue] = dctCache.entries().next().value
    if (oldestValue?.coefficients) oldestValue.coefficients.delete()
    dctCache.delete(oldestKey)
  }
}

export const getCachedDCT = (cacheKey) => {
  if (!cacheKey || !dctCache.has(cacheKey)) {
    return null
  }
  const value = dctCache.get(cacheKey)
  touchDctCacheKey(cacheKey, value)
  return value
}

export const setCachedDCT = (cacheKey, value) => {
  if (!cacheKey || !value) {
    return
  }
  touchDctCacheKey(cacheKey, value)
  evictDctIfNeeded()
}

const touchDwtCacheKey = (key, value) => {
  if (dwtCache.has(key)) {
    dwtCache.delete(key)
  }
  dwtCache.set(key, value)
}

const evictDwtIfNeeded = () => {
  while (dwtCache.size > MAX_DWT_CACHE) {
    const [oldestKey] = dwtCache.entries().next().value
    dwtCache.delete(oldestKey)
  }
}

export const getCachedDWT = (cacheKey) => {
  if (!cacheKey || !dwtCache.has(cacheKey)) {
    return null
  }
  const value = dwtCache.get(cacheKey)
  touchDwtCacheKey(cacheKey, value)
  return value
}

export const setCachedDWT = (cacheKey, value) => {
  if (!cacheKey || !value) {
    return
  }
  touchDwtCacheKey(cacheKey, value)
  evictDwtIfNeeded()
}

export async function getOrCreateDFT({ cacheKey, imageSrc, cv }) {
  const cached = getCachedDFT(cacheKey)
  if (cached) {
    return cached
  }

  const srcMat = await loadImageToMat(imageSrc, cv)
  try {
    const result = computeDFTComplex(srcMat, cv)
    setCachedDFT(cacheKey, result)
    return result
  } finally {
    srcMat.delete()
  }
}

export async function getOrCreateDCT({ cacheKey, imageSrc, cv }) {
  const cached = getCachedDCT(cacheKey)
  if (cached) {
    return cached
  }

  const srcMat = await loadImageToMat(imageSrc, cv)
  try {
    const result = computeDCTCoefficients(srcMat, cv)
    setCachedDCT(cacheKey, result)
    return result
  } finally {
    srcMat.delete()
  }
}

export async function getOrCreateDWT({ cacheKey, imageSrc, cv, wavelet, levels }) {
  const cached = getCachedDWT(cacheKey)
  if (cached) {
    return cached
  }

  const srcMat = await loadImageToMat(imageSrc, cv)
  try {
    const result = computeDWTCoefficients(srcMat, wavelet, levels, cv)
    setCachedDWT(cacheKey, result)
    return result
  } finally {
    srcMat.delete()
  }
}

const dctFromArray = (data, rows, cols) => {
  const rowCos = getDctCosTable(cols)
  const colCos = getDctCosTable(rows)
  const temp = new Float32Array(rows * cols)
  const output = new Float32Array(rows * cols)

  for (let r = 0; r < rows; r += 1) {
    const row = data.subarray(r * cols, r * cols + cols)
    const dctRow = dct1d(row, cols, rowCos)
    temp.set(dctRow, r * cols)
  }

  for (let c = 0; c < cols; c += 1) {
    const column = new Float32Array(rows)
    for (let r = 0; r < rows; r += 1) {
      column[r] = temp[r * cols + c]
    }
    const dctCol = dct1d(column, rows, colCos)
    for (let r = 0; r < rows; r += 1) {
      output[r * cols + c] = dctCol[r]
    }
  }

  return output
}

const idctFromArray = (data, rows, cols) => {
  const rowCos = getDctCosTable(cols)
  const colCos = getDctCosTable(rows)
  const temp = new Float32Array(rows * cols)
  const output = new Float32Array(rows * cols)

  for (let r = 0; r < rows; r += 1) {
    const row = data.subarray(r * cols, r * cols + cols)
    const idctRow = idct1d(row, cols, rowCos)
    temp.set(idctRow, r * cols)
  }

  for (let c = 0; c < cols; c += 1) {
    const column = new Float32Array(rows)
    for (let r = 0; r < rows; r += 1) {
      column[r] = temp[r * cols + c]
    }
    const idctCol = idct1d(column, rows, colCos)
    for (let r = 0; r < rows; r += 1) {
      output[r * cols + c] = idctCol[r]
    }
  }

  return output
}

export function computeDFTComplex(srcMat, cv) {
  let gray = null
  let padded = null
  let planes = null
  let complexI = null
  let complexDFT = null
  let shiftedDFT = null

  const origSize = { width: srcMat.cols, height: srcMat.rows }

  try {
    gray = new cv.Mat()
    if (srcMat.channels() === 1) {
      srcMat.convertTo(gray, cv.CV_32F)
    } else {
      const tempGray = new cv.Mat()
      cv.cvtColor(srcMat, tempGray, cv.COLOR_BGR2GRAY)
      tempGray.convertTo(gray, cv.CV_32F)
      tempGray.delete()
    }

    const rows = cv.getOptimalDFTSize(gray.rows)
    const cols = cv.getOptimalDFTSize(gray.cols)
    padded = new cv.Mat()
    cv.copyMakeBorder(gray, padded, 0, rows - gray.rows, 0, cols - gray.cols, cv.BORDER_CONSTANT, new cv.Scalar(0))

    planes = new cv.MatVector()
    const realPart = padded.clone()
    const imagPart = new cv.Mat.zeros(padded.rows, padded.cols, cv.CV_32F)
    planes.push_back(realPart)
    planes.push_back(imagPart)

    complexI = new cv.Mat()
    cv.merge(planes, complexI)

    complexDFT = new cv.Mat()
    cv.dft(complexI, complexDFT, cv.DFT_COMPLEX_OUTPUT)
    shiftedDFT = fftShift(complexDFT, cv)

    return {
      complexDFT,
      shiftedDFT,
      meta: {
        origSize,
        padSize: { width: padded.cols, height: padded.rows },
      },
    }
  } finally {
    if (gray) gray.delete()
    if (padded) padded.delete()
    if (planes) planes.delete()
    if (complexI) complexI.delete()
  }
}

export function computeDCTCoefficients(srcMat, cv) {
  let gray = null
  let coeff = null

  try {
    gray = new cv.Mat()
    if (srcMat.channels() === 1) {
      srcMat.convertTo(gray, cv.CV_32F)
    } else {
      const tempGray = new cv.Mat()
      cv.cvtColor(srcMat, tempGray, cv.COLOR_BGR2GRAY)
      tempGray.convertTo(gray, cv.CV_32F)
      tempGray.delete()
    }

    if (typeof cv.dct === 'function') {
      coeff = new cv.Mat()
      cv.dct(gray, coeff)
    } else {
      const data = gray.data32F
      const output = dctFromArray(data, gray.rows, gray.cols)
      coeff = cv.matFromArray(gray.rows, gray.cols, cv.CV_32F, output)
    }

    return {
      coefficients: coeff,
      meta: {
        origSize: { width: srcMat.cols, height: srcMat.rows },
      },
    }
  } finally {
    if (gray) gray.delete()
  }
}

const dwt1d = (input, length, decLo, decHi) => {
  const half = length / 2
  const low = new Float32Array(half)
  const high = new Float32Array(half)
  const filterLen = decLo.length

  for (let k = 0; k < half; k += 1) {
    let sumLo = 0
    let sumHi = 0
    for (let n = 0; n < filterLen; n += 1) {
      const idx = (2 * k + n) % length
      const value = input[idx]
      sumLo += value * decLo[n]
      sumHi += value * decHi[n]
    }
    low[k] = sumLo
    high[k] = sumHi
  }

  return { low, high }
}

const idwt1d = (low, high, length, recLo, recHi) => {
  const output = new Float32Array(length)
  const half = length / 2
  const filterLen = recLo.length

  for (let k = 0; k < half; k += 1) {
    for (let n = 0; n < filterLen; n += 1) {
      const idx = (2 * k + n) % length
      output[idx] += low[k] * recLo[n] + high[k] * recHi[n]
    }
  }

  return output
}

const getMaxLevels = (width, height, levels) => {
  const maxPossible = Math.floor(Math.log2(Math.min(width, height)))
  return Math.max(1, Math.min(levels, maxPossible))
}

const getPadSizeForLevels = (width, height, levels) => {
  const block = 1 << levels
  const padWidth = Math.ceil(width / block) * block
  const padHeight = Math.ceil(height / block) * block
  return { padWidth, padHeight }
}

const padToSize = (data, width, height, padWidth, padHeight) => {
  const output = new Float32Array(padWidth * padHeight)
  for (let y = 0; y < height; y += 1) {
    const srcOffset = y * width
    const dstOffset = y * padWidth
    for (let x = 0; x < width; x += 1) {
      output[dstOffset + x] = data[srcOffset + x]
    }
  }
  return output
}

const dwt2d = (data, width, height, levels, wavelet) => {
  const { padWidth, padHeight } = getPadSizeForLevels(width, height, levels)
  const levelCount = getMaxLevels(padWidth, padHeight, levels)
  const padded = padToSize(data, width, height, padWidth, padHeight)
  const coeffs = new Float32Array(padWidth * padHeight)

  coeffs.set(padded)

  const { decLo, decHi } = WAVELETS[wavelet]

  for (let level = 1; level <= levelCount; level += 1) {
    const currentWidth = padWidth >> (level - 1)
    const currentHeight = padHeight >> (level - 1)
    const halfWidth = currentWidth / 2
    const halfHeight = currentHeight / 2
    const rowTemp = new Float32Array(currentWidth * currentHeight)

    for (let r = 0; r < currentHeight; r += 1) {
      const row = new Float32Array(currentWidth)
      for (let c = 0; c < currentWidth; c += 1) {
        row[c] = coeffs[r * padWidth + c]
      }
      const { low, high } = dwt1d(row, currentWidth, decLo, decHi)
      for (let c = 0; c < halfWidth; c += 1) {
        rowTemp[r * currentWidth + c] = low[c]
        rowTemp[r * currentWidth + c + halfWidth] = high[c]
      }
    }

      for (let c = 0; c < currentWidth; c += 1) {
        const column = new Float32Array(currentHeight)
        for (let r = 0; r < currentHeight; r += 1) {
          column[r] = rowTemp[r * currentWidth + c]
        }
        const { low, high } = dwt1d(column, currentHeight, decLo, decHi)
        for (let r = 0; r < halfHeight; r += 1) {
          coeffs[r * padWidth + c] = low[r]
          coeffs[(r + halfHeight) * padWidth + c] = high[r]
        }
      }
  }

  return {
    coefficients: coeffs,
    padSize: { width: padWidth, height: padHeight },
    levelCount,
  }
}

const idwt2d = (coeffs, padWidth, padHeight, levels, wavelet) => {
  const output = new Float32Array(coeffs)
  const { recLo, recHi } = WAVELETS[wavelet]

  for (let level = levels; level >= 1; level -= 1) {
    const currentWidth = padWidth >> (level - 1)
    const currentHeight = padHeight >> (level - 1)
    const halfWidth = currentWidth / 2
    const halfHeight = currentHeight / 2
    const colTemp = new Float32Array(currentWidth * currentHeight)

    for (let c = 0; c < currentWidth; c += 1) {
      const low = new Float32Array(halfHeight)
      const high = new Float32Array(halfHeight)
      for (let r = 0; r < halfHeight; r += 1) {
        low[r] = output[r * padWidth + c]
        high[r] = output[(r + halfHeight) * padWidth + c]
      }
      const column = idwt1d(low, high, currentHeight, recLo, recHi)
      for (let r = 0; r < currentHeight; r += 1) {
        colTemp[r * currentWidth + c] = column[r]
      }
    }

    for (let r = 0; r < currentHeight; r += 1) {
      const low = new Float32Array(halfWidth)
      const high = new Float32Array(halfWidth)
      for (let c = 0; c < halfWidth; c += 1) {
        low[c] = colTemp[r * currentWidth + c]
        high[c] = colTemp[r * currentWidth + c + halfWidth]
      }
      const row = idwt1d(low, high, currentWidth, recLo, recHi)
      for (let c = 0; c < currentWidth; c += 1) {
        output[r * padWidth + c] = row[c]
      }
    }
  }

  return output
}

const dwt2dSingle = (data, width, height, wavelet) => {
  const halfWidth = width / 2
  const halfHeight = height / 2
  const { decLo, decHi } = WAVELETS[wavelet]

  const lowRows = new Float32Array(height * halfWidth)
  const highRows = new Float32Array(height * halfWidth)

  for (let r = 0; r < height; r += 1) {
    const row = data.subarray(r * width, r * width + width)
    const { low, high } = dwt1d(row, width, decLo, decHi)
    lowRows.set(low, r * halfWidth)
    highRows.set(high, r * halfWidth)
  }

  const ll = new Float32Array(halfWidth * halfHeight)
  const lh = new Float32Array(halfWidth * halfHeight)
  const hl = new Float32Array(halfWidth * halfHeight)
  const hh = new Float32Array(halfWidth * halfHeight)

  for (let c = 0; c < halfWidth; c += 1) {
    const lowColumn = new Float32Array(height)
    const highColumn = new Float32Array(height)
    for (let r = 0; r < height; r += 1) {
      lowColumn[r] = lowRows[r * halfWidth + c]
      highColumn[r] = highRows[r * halfWidth + c]
    }
    const lowSplit = dwt1d(lowColumn, height, decLo, decHi)
    const highSplit = dwt1d(highColumn, height, decLo, decHi)
    for (let r = 0; r < halfHeight; r += 1) {
      ll[r * halfWidth + c] = lowSplit.low[r]
      lh[r * halfWidth + c] = lowSplit.high[r]
      hl[r * halfWidth + c] = highSplit.low[r]
      hh[r * halfWidth + c] = highSplit.high[r]
    }
  }

  return {
    ll,
    lh,
    hl,
    hh,
    width: halfWidth,
    height: halfHeight,
  }
}

const idwt2dSingle = (ll, lh, hl, hh, width, height, wavelet) => {
  const halfWidth = width / 2
  const halfHeight = height / 2
  const { recLo, recHi } = WAVELETS[wavelet]

  const lowCols = new Float32Array(width * height)
  const highCols = new Float32Array(width * height)

  for (let c = 0; c < halfWidth; c += 1) {
    const low = new Float32Array(halfHeight)
    const high = new Float32Array(halfHeight)
    const lowHigh = new Float32Array(halfHeight)
    const highHigh = new Float32Array(halfHeight)

    for (let r = 0; r < halfHeight; r += 1) {
      low[r] = ll[r * halfWidth + c]
      high[r] = lh[r * halfWidth + c]
      lowHigh[r] = hl[r * halfWidth + c]
      highHigh[r] = hh[r * halfWidth + c]
    }

    const lowColumn = idwt1d(low, high, height, recLo, recHi)
    const highColumn = idwt1d(lowHigh, highHigh, height, recLo, recHi)

    for (let r = 0; r < height; r += 1) {
      lowCols[r * width + c] = lowColumn[r]
      highCols[r * width + c] = highColumn[r]
    }
  }

  const output = new Float32Array(width * height)
  for (let r = 0; r < height; r += 1) {
    const lowRow = new Float32Array(halfWidth)
    const highRow = new Float32Array(halfWidth)
    for (let c = 0; c < halfWidth; c += 1) {
      lowRow[c] = lowCols[r * width + c]
      highRow[c] = highCols[r * width + c]
    }
    const row = idwt1d(lowRow, highRow, width, recLo, recHi)
    output.set(row, r * width)
  }

  return output
}

export function computeDWTCoefficients(srcMat, wavelet, levels, cv) {
  let gray = null

  try {
    gray = new cv.Mat()
    if (srcMat.channels() === 1) {
      srcMat.convertTo(gray, cv.CV_32F)
    } else {
      const tempGray = new cv.Mat()
      cv.cvtColor(srcMat, tempGray, cv.COLOR_BGR2GRAY)
      tempGray.convertTo(gray, cv.CV_32F)
      tempGray.delete()
    }

    const waveletName = WAVELETS[wavelet] ? wavelet : 'haar'
    const result = dwt2d(gray.data32F, gray.cols, gray.rows, levels, waveletName)
    return {
      coefficients: result.coefficients,
      meta: {
        origSize: { width: srcMat.cols, height: srcMat.rows },
        padSize: result.padSize,
        levelCount: result.levelCount,
        wavelet: waveletName,
      },
    }
  } finally {
    if (gray) gray.delete()
  }
}

export function computeFrequencyDisplayFromShifted(shiftedDFT, cv) {
  let planes = null
  let real = null
  let imag = null
  let mag = null
  let logMag = null
  let normalized = null
  let ones = null

  try {
    planes = new cv.MatVector()
    cv.split(shiftedDFT, planes)
    real = planes.get(0)
    imag = planes.get(1)

    mag = new cv.Mat()
    cv.magnitude(real, imag, mag)

    logMag = new cv.Mat()
    ones = new cv.Mat.ones(mag.rows, mag.cols, cv.CV_32F)
    cv.add(mag, ones, logMag)
    cv.log(logMag, logMag)

    normalized = new cv.Mat()
    cv.normalize(logMag, normalized, 0, 255, cv.NORM_MINMAX, cv.CV_8U)

    return normalized
  } finally {
    if (real) real.delete()
    if (imag) imag.delete()
    if (planes) planes.delete()
    if (ones) ones.delete()
    if (mag) mag.delete()
    if (logMag) logMag.delete()
  }
}

export function computeIFFTImage(shiftedDFT, meta, cv) {
  let unshifted = null
  let spatial = null
  let cropped = null
  let normalized = null

  try {
    unshifted = fftShift(shiftedDFT, cv)

    spatial = new cv.Mat()
    if (typeof cv.idft === 'function') {
      cv.idft(unshifted, spatial, cv.DFT_SCALE | cv.DFT_REAL_OUTPUT)
    } else {
      cv.dft(unshifted, spatial, cv.DFT_INVERSE | cv.DFT_SCALE | cv.DFT_REAL_OUTPUT)
    }

    const rect = new cv.Rect(0, 0, meta.origSize.width, meta.origSize.height)
    cropped = spatial.roi(rect).clone()

    normalized = new cv.Mat()
    cv.normalize(cropped, normalized, 0, 255, cv.NORM_MINMAX, cv.CV_8U)

    return normalized
  } finally {
    if (unshifted) unshifted.delete()
    if (spatial) spatial.delete()
    if (cropped) cropped.delete()
  }
}

export function computeDCTDisplayFromCoefficients(coefficients, cv) {
  let absMat = null
  let logMat = null
  let normalized = null
  let ones = null
  let zeros = null

  try {
    absMat = new cv.Mat()
    zeros = new cv.Mat.zeros(coefficients.rows, coefficients.cols, cv.CV_32F)
    cv.absdiff(coefficients, zeros, absMat)

    logMat = new cv.Mat()
    ones = new cv.Mat.ones(absMat.rows, absMat.cols, cv.CV_32F)
    cv.add(absMat, ones, logMat)
    cv.log(logMat, logMat)

    normalized = new cv.Mat()
    cv.normalize(logMat, normalized, 0, 255, cv.NORM_MINMAX, cv.CV_8U)

    return normalized
  } finally {
    if (absMat) absMat.delete()
    if (logMat) logMat.delete()
    if (ones) ones.delete()
    if (zeros) zeros.delete()
  }
}

export function computeIDCTImage(coefficients, meta, cv) {
  let spatial = null
  let normalized = null

  try {
    if (typeof cv.idct === 'function') {
      spatial = new cv.Mat()
      cv.idct(coefficients, spatial)
    } else {
      const data = coefficients.data32F
      const output = idctFromArray(data, coefficients.rows, coefficients.cols)
      spatial = cv.matFromArray(coefficients.rows, coefficients.cols, cv.CV_32F, output)
    }

    normalized = new cv.Mat()
    cv.normalize(spatial, normalized, 0, 255, cv.NORM_MINMAX, cv.CV_8U)

    return normalized
  } finally {
    if (spatial) spatial.delete()
  }
}

export const getDwtWavelets = () => Object.keys(WAVELETS)

const DTCWT_KERNELS = [
  { id: 'dir0', label: '0°', angle: 0, data: [-1, 0, 1, -2, 0, 2, -1, 0, 1] },
  { id: 'dir30', label: '30°', angle: 30, data: [-1, -1, 2, -1, 2, 1, 2, 1, -1] },
  { id: 'dir60', label: '60°', angle: 60, data: [-1, 2, 1, -1, 2, 1, -1, -1, 2] },
  { id: 'dir90', label: '90°', angle: 90, data: [-1, -2, -1, 0, 0, 0, 1, 2, 1] },
  { id: 'dir120', label: '120°', angle: 120, data: [2, 1, -1, 1, 2, -1, -1, -1, 2] },
  { id: 'dir150', label: '150°', angle: 150, data: [2, -1, -1, 1, 2, -1, -1, 1, 2] },
]

const createKernelMat = (kernel, cv) => cv.matFromArray(3, 3, cv.CV_32F, kernel)

export function computeDTCWTExperimental(srcMat, cv) {
  let gray = null
  let lowpass = null
  const directions = []

  try {
    gray = new cv.Mat()
    if (srcMat.channels() === 1) {
      srcMat.convertTo(gray, cv.CV_32F)
    } else {
      const tempGray = new cv.Mat()
      cv.cvtColor(srcMat, tempGray, cv.COLOR_BGR2GRAY)
      tempGray.convertTo(gray, cv.CV_32F)
      tempGray.delete()
    }

    lowpass = new cv.Mat()
    cv.GaussianBlur(gray, lowpass, new cv.Size(5, 5), 0)

    DTCWT_KERNELS.forEach((kernel) => {
      const kernelMat = createKernelMat(kernel.data, cv)
      const response = new cv.Mat()
      cv.filter2D(gray, response, cv.CV_32F, kernelMat)
      directions.push({
        id: kernel.id,
        label: kernel.label,
        angle: kernel.angle,
        data: new Float32Array(response.data32F),
      })
      response.delete()
      kernelMat.delete()
    })

    return {
      directions,
      lowpass: new Float32Array(lowpass.data32F),
      meta: {
        origSize: { width: srcMat.cols, height: srcMat.rows },
        size: { width: gray.cols, height: gray.rows },
      },
    }
  } finally {
    if (gray) gray.delete()
    if (lowpass) lowpass.delete()
  }
}

export function computeDTCWTDisplay(directions, size, cv) {
  const rows = size.height
  const cols = size.width
  const gridCols = 3
  const gridRows = 2
  const tileWidth = Math.floor(cols / gridCols)
  const tileHeight = Math.floor(rows / gridRows)
  const mosaic = new Float32Array(cols * rows)

  directions.forEach((dir, index) => {
    const row = Math.floor(index / gridCols)
    const col = index % gridCols
    for (let y = 0; y < tileHeight; y += 1) {
      const dstOffset = (row * tileHeight + y) * cols + col * tileWidth
      const srcOffset = y * tileWidth
      mosaic.set(dir.data.subarray(srcOffset, srcOffset + tileWidth), dstOffset)
    }
  })

  let absMat = null
  let logMat = null
  let normalized = null
  let ones = null
  let zeros = null
  let coeffMat = null

  try {
    coeffMat = cv.matFromArray(rows, cols, cv.CV_32F, mosaic)
    absMat = new cv.Mat()
    zeros = new cv.Mat.zeros(rows, cols, cv.CV_32F)
    cv.absdiff(coeffMat, zeros, absMat)

    logMat = new cv.Mat()
    ones = new cv.Mat.ones(rows, cols, cv.CV_32F)
    cv.add(absMat, ones, logMat)
    cv.log(logMat, logMat)

    normalized = new cv.Mat()
    cv.normalize(logMat, normalized, 0, 255, cv.NORM_MINMAX, cv.CV_8U)

    return normalized
  } finally {
    if (coeffMat) coeffMat.delete()
    if (absMat) absMat.delete()
    if (logMat) logMat.delete()
    if (ones) ones.delete()
    if (zeros) zeros.delete()
  }
}

export function computeDTCWTInverse(directions, lowpass, size, cv) {
  const combined = new Float32Array(size.width * size.height)

  for (const dir of directions) {
    for (let i = 0; i < combined.length; i += 1) {
      combined[i] += dir.data[i]
    }
  }
  for (let i = 0; i < combined.length; i += 1) {
    combined[i] += lowpass[i]
  }

  let mat = null
  let normalized = null

  try {
    mat = cv.matFromArray(size.height, size.width, cv.CV_32F, combined)
    normalized = new cv.Mat()
    cv.normalize(mat, normalized, 0, 255, cv.NORM_MINMAX, cv.CV_8U)
    return normalized
  } finally {
    if (mat) mat.delete()
  }
}

export function computeDTCWTStats(directions) {
  const energies = directions.map((dir) => dir.data.reduce((sum, value) => sum + value * value, 0))
  const totalEnergy = energies.reduce((sum, value) => sum + value, 0)
  const perDirectionEnergy = directions.map((dir, index) => ({
    id: dir.id,
    label: dir.label,
    ratio: totalEnergy > 0 ? (energies[index] / totalEnergy) * 100 : 0,
  }))

  return {
    totalEnergy,
    perDirectionEnergy,
  }
}

export function computeDWTDisplayFromCoefficients(coefficients, size, cv) {
  let absMat = null
  let logMat = null
  let normalized = null
  let ones = null
  let zeros = null
  let coeffMat = null

  try {
    coeffMat = cv.matFromArray(size.height, size.width, cv.CV_32F, coefficients)
    absMat = new cv.Mat()
    zeros = new cv.Mat.zeros(size.height, size.width, cv.CV_32F)
    cv.absdiff(coeffMat, zeros, absMat)

    logMat = new cv.Mat()
    ones = new cv.Mat.ones(size.height, size.width, cv.CV_32F)
    cv.add(absMat, ones, logMat)
    cv.log(logMat, logMat)

    normalized = new cv.Mat()
    cv.normalize(logMat, normalized, 0, 255, cv.NORM_MINMAX, cv.CV_8U)

    return normalized
  } finally {
    if (coeffMat) coeffMat.delete()
    if (absMat) absMat.delete()
    if (logMat) logMat.delete()
    if (ones) ones.delete()
    if (zeros) zeros.delete()
  }
}

export function computeIDWTImage(coefficients, meta, cv) {
  const reconstructed = idwt2d(coefficients, meta.padSize.width, meta.padSize.height, meta.levelCount, meta.wavelet)
  let mat = null
  let normalized = null

  try {
    mat = cv.matFromArray(meta.padSize.height, meta.padSize.width, cv.CV_32F, reconstructed)
    normalized = new cv.Mat()
    cv.normalize(mat, normalized, 0, 255, cv.NORM_MINMAX, cv.CV_8U)

    const roi = normalized.roi(new cv.Rect(0, 0, meta.origSize.width, meta.origSize.height))
    const cropped = roi.clone()
    roi.delete()
    normalized.delete()
    return cropped
  } finally {
    if (mat) mat.delete()
  }
}

export function applyDWTFilter(coefficients, meta, filter) {
  const output = new Float32Array(coefficients)
  const { width, height } = meta.padSize
  const levels = meta.levelCount

  const threshold = filter?.threshold ?? 0
  const detailGain = filter?.detailGain ?? 1
  const mode = filter?.mode ?? 'none'

  for (let level = 1; level <= levels; level += 1) {
    const currentWidth = width >> (level - 1)
    const currentHeight = height >> (level - 1)
    const halfWidth = currentWidth / 2
    const halfHeight = currentHeight / 2

    for (let y = 0; y < currentHeight; y += 1) {
      for (let x = 0; x < currentWidth; x += 1) {
        const inDetail = x >= halfWidth || y >= halfHeight
        if (!inDetail) {
          continue
        }
        const index = y * width + x
        let value = output[index]

        if (mode === 'll-only') {
          value = 0
        } else if (mode === 'suppress-high') {
          value *= detailGain
        } else if (mode === 'threshold') {
          const sign = value >= 0 ? 1 : -1
          const abs = Math.abs(value)
          value = abs > threshold ? sign * (abs - threshold) : 0
        }

        output[index] = value
      }
    }
  }

  return output
}

export function computeDWTStats(coefficients, meta) {
  const { width, height } = meta.padSize
  const levels = meta.levelCount
  let totalEnergy = 0

  for (let y = 0; y < height; y += 1) {
    const offset = y * width
    for (let x = 0; x < width; x += 1) {
      const value = coefficients[offset + x]
      totalEnergy += value * value
    }
  }

  const llWidth = width >> levels
  const llHeight = height >> levels
  let llEnergy = 0
  for (let y = 0; y < llHeight; y += 1) {
    const offset = y * width
    for (let x = 0; x < llWidth; x += 1) {
      const value = coefficients[offset + x]
      llEnergy += value * value
    }
  }

  const detailEnergy = totalEnergy - llEnergy
  const levelDetails = []

  for (let level = 1; level <= levels; level += 1) {
    const currentWidth = width >> (level - 1)
    const currentHeight = height >> (level - 1)
    const halfWidth = currentWidth / 2
    const halfHeight = currentHeight / 2
    let levelEnergy = 0

    for (let y = 0; y < currentHeight; y += 1) {
      for (let x = 0; x < currentWidth; x += 1) {
        if (x < halfWidth && y < halfHeight) {
          continue
        }
        const value = coefficients[y * width + x]
        levelEnergy += value * value
      }
    }

    levelDetails.push({
      level,
      ratio: totalEnergy > 0 ? (levelEnergy / totalEnergy) * 100 : 0,
    })
  }

  return {
    totalEnergy,
    llRatio: totalEnergy > 0 ? (llEnergy / totalEnergy) * 100 : 0,
    detailRatio: totalEnergy > 0 ? (detailEnergy / totalEnergy) * 100 : 0,
    levelDetails,
  }
}

export function computeWPTCoefficients(srcMat, wavelet, levels, cv) {
  let gray = null

  try {
    gray = new cv.Mat()
    if (srcMat.channels() === 1) {
      srcMat.convertTo(gray, cv.CV_32F)
    } else {
      const tempGray = new cv.Mat()
      cv.cvtColor(srcMat, tempGray, cv.COLOR_BGR2GRAY)
      tempGray.convertTo(gray, cv.CV_32F)
      tempGray.delete()
    }

    const waveletName = WAVELETS[wavelet] ? wavelet : 'haar'
    const { padWidth, padHeight } = getPadSizeForLevels(gray.cols, gray.rows, levels)
    const levelCount = getMaxLevels(padWidth, padHeight, levels)
    const padded = padToSize(gray.data32F, gray.cols, gray.rows, padWidth, padHeight)
    const nodes = []

    const buildNodes = (data, width, height, level, path) => {
      const currentLevel = levelCount - level
      const energy = data.reduce((sum, value) => sum + value * value, 0)
      nodes.push({
        id: path || 'root',
        path,
        level: currentLevel,
        width,
        height,
        data,
        energy,
        isLeaf: level === 0,
      })

      if (level === 0) {
        return
      }

      const { ll, lh, hl, hh, width: nextWidth, height: nextHeight } = dwt2dSingle(data, width, height, waveletName)
      buildNodes(ll, nextWidth, nextHeight, level - 1, path ? `${path}/LL` : 'LL')
      buildNodes(lh, nextWidth, nextHeight, level - 1, path ? `${path}/LH` : 'LH')
      buildNodes(hl, nextWidth, nextHeight, level - 1, path ? `${path}/HL` : 'HL')
      buildNodes(hh, nextWidth, nextHeight, level - 1, path ? `${path}/HH` : 'HH')
    }

    buildNodes(padded, padWidth, padHeight, levelCount, '')

    const root = nodes.find((node) => node.path === '')
    const totalEnergy = root ? root.energy : nodes.reduce((sum, node) => sum + node.energy, 0)

    return {
      nodes,
      meta: {
        origSize: { width: srcMat.cols, height: srcMat.rows },
        padSize: { width: padWidth, height: padHeight },
        wavelet: waveletName,
        levelCount,
        totalEnergy,
      },
    }
  } finally {
    if (gray) gray.delete()
  }
}

const getLeafTilePosition = (path) => {
  if (!path) {
    return { row: 0, col: 0 }
  }
  const parts = path.split('/')
  let row = 0
  let col = 0
  for (const part of parts) {
    const rowBit = part[0] === 'H' ? 1 : 0
    const colBit = part[1] === 'H' ? 1 : 0
    row = row * 2 + rowBit
    col = col * 2 + colBit
  }
  return { row, col }
}

export function computeWPTDisplayFromNodes(nodes, meta, cv) {
  const leafNodes = nodes.filter((node) => node.isLeaf)
  const levels = meta.levelCount
  const grid = 1 << levels
  const tileWidth = meta.padSize.width / grid
  const tileHeight = meta.padSize.height / grid
  const mosaic = new Float32Array(meta.padSize.width * meta.padSize.height)

  for (const node of leafNodes) {
    const { row, col } = getLeafTilePosition(node.path)
    const startX = col * tileWidth
    const startY = row * tileHeight
    for (let y = 0; y < tileHeight; y += 1) {
      const dstOffset = (startY + y) * meta.padSize.width + startX
      const srcOffset = y * tileWidth
      mosaic.set(node.data.subarray(srcOffset, srcOffset + tileWidth), dstOffset)
    }
  }

  let absMat = null
  let logMat = null
  let normalized = null
  let ones = null
  let zeros = null
  let coeffMat = null

  try {
    coeffMat = cv.matFromArray(meta.padSize.height, meta.padSize.width, cv.CV_32F, mosaic)
    absMat = new cv.Mat()
    zeros = new cv.Mat.zeros(meta.padSize.height, meta.padSize.width, cv.CV_32F)
    cv.absdiff(coeffMat, zeros, absMat)

    logMat = new cv.Mat()
    ones = new cv.Mat.ones(absMat.rows, absMat.cols, cv.CV_32F)
    cv.add(absMat, ones, logMat)
    cv.log(logMat, logMat)

    normalized = new cv.Mat()
    cv.normalize(logMat, normalized, 0, 255, cv.NORM_MINMAX, cv.CV_8U)

    return normalized
  } finally {
    if (coeffMat) coeffMat.delete()
    if (absMat) absMat.delete()
    if (logMat) logMat.delete()
    if (ones) ones.delete()
    if (zeros) zeros.delete()
  }
}

export function computeIWPTImage(nodes, meta, cv) {
  const levels = meta.levelCount
  const leafNodes = nodes.filter((node) => node.isLeaf)
  const leafMap = new Map()
  for (const node of leafNodes) {
    leafMap.set(node.path, node.data)
  }

  const reconstructNode = (path, level) => {
    if (level === levels) {
      return leafMap.get(path) || new Float32Array((meta.padSize.width >> levels) * (meta.padSize.height >> levels))
    }
    const nextLevel = level + 1
    const ll = reconstructNode(path ? `${path}/LL` : 'LL', nextLevel)
    const lh = reconstructNode(path ? `${path}/LH` : 'LH', nextLevel)
    const hl = reconstructNode(path ? `${path}/HL` : 'HL', nextLevel)
    const hh = reconstructNode(path ? `${path}/HH` : 'HH', nextLevel)
    const width = meta.padSize.width >> level
    const height = meta.padSize.height >> level
    return idwt2dSingle(ll, lh, hl, hh, width, height, meta.wavelet)
  }

  const reconstructed = reconstructNode('', 0)
  let mat = null
  let normalized = null

  try {
    mat = cv.matFromArray(meta.padSize.height, meta.padSize.width, cv.CV_32F, reconstructed)
    normalized = new cv.Mat()
    cv.normalize(mat, normalized, 0, 255, cv.NORM_MINMAX, cv.CV_8U)

    const roi = normalized.roi(new cv.Rect(0, 0, meta.origSize.width, meta.origSize.height))
    const cropped = roi.clone()
    roi.delete()
    normalized.delete()
    return cropped
  } finally {
    if (mat) mat.delete()
  }
}

export function computeWPTStats(nodes, meta) {
  const leafNodes = nodes.filter((node) => node.isLeaf)
  const leafEnergy = new Map()
  let totalEnergy = 0

  for (const node of leafNodes) {
    const energy = node.data.reduce((sum, value) => sum + value * value, 0)
    leafEnergy.set(node.path, energy)
    totalEnergy += energy
  }

  const nodeMap = new Map()
  nodes.forEach((node) => {
    nodeMap.set(node.id, {
      id: node.id,
      path: node.path,
      level: node.level,
      energy: 0,
      energyRatio: 0,
      parentId: node.path ? node.path.split('/').slice(0, -1).join('/') || 'root' : null,
      childrenIds: [],
      isLeaf: node.isLeaf,
    })
  })

  for (const node of nodeMap.values()) {
    if (node.parentId && nodeMap.has(node.parentId)) {
      nodeMap.get(node.parentId).childrenIds.push(node.id)
    }
  }

  for (const [path, energy] of leafEnergy.entries()) {
    let current = path || 'root'
    while (current) {
      const node = nodeMap.get(current)
      if (node) {
        node.energy += energy
      }
      const parent = current.split('/').slice(0, -1).join('/')
      current = parent || (current === 'root' ? null : 'root')
    }
  }

  for (const node of nodeMap.values()) {
    node.energyRatio = totalEnergy > 0 ? node.energy / totalEnergy : 0
  }

  const leafStats = leafNodes.map((node) => ({
    path: node.path,
    ratio: totalEnergy > 0 ? (leafEnergy.get(node.path) / totalEnergy) * 100 : 0,
    level: node.level,
  }))
  leafStats.sort((a, b) => b.ratio - a.ratio)

  const levelBuckets = Array.from({ length: meta.levelCount + 1 }, (_, index) => ({
    level: index,
    ratio: 0,
  }))

  for (const stat of leafStats) {
    const bucket = levelBuckets[stat.level]
    if (bucket) {
      bucket.ratio += stat.ratio
    }
  }

  return {
    totalEnergy,
    nodes: Array.from(nodeMap.values()),
    leafNodes: leafStats,
    levelBuckets,
  }
}

const clamp01 = (value) => Math.max(0, Math.min(1, value))

export function buildIdealMask({ mode, radius, bandwidth }, padSize, cv) {
  const rows = padSize.height
  const cols = padSize.width
  const centerX = Math.floor(cols / 2)
  const centerY = Math.floor(rows / 2)
  const maxRadius = Math.min(cols, rows) / 2
  const radiusPx = clamp01(Math.min(0.5, radius)) * maxRadius
  const bandPx = clamp01(Math.min(0.5, bandwidth ?? 0.1)) * maxRadius
  const innerPx = Math.max(0, radiusPx - bandPx / 2)
  const outerPx = Math.max(innerPx, radiusPx + bandPx / 2)

  const mask = new cv.Mat(rows, cols, cv.CV_32F)
  for (let y = 0; y < rows; y += 1) {
    const row = mask.floatPtr(y)
    const dy = y - centerY
    for (let x = 0; x < cols; x += 1) {
      const dx = x - centerX
      const dist = Math.sqrt(dx * dx + dy * dy)
      const isInside = dist <= radiusPx
      const isBand = dist >= innerPx && dist <= outerPx
      if (mode === 'lowpass') {
        row[x] = isInside ? 1 : 0
      } else if (mode === 'highpass') {
        row[x] = isInside ? 0 : 1
      } else if (mode === 'bandpass') {
        row[x] = isBand ? 1 : 0
      } else if (mode === 'bandstop') {
        row[x] = isBand ? 0 : 1
      } else {
        row[x] = 1
      }
    }
  }

  return mask
}

export function buildMask(filterSpec, padSize, cv) {
  if (!filterSpec || filterSpec.mode === 'none') {
    return null
  }
  if (filterSpec.shape === 'gaussian') {
    return buildGaussianMask(filterSpec, padSize, cv)
  }
  return buildIdealMask(filterSpec, padSize, cv)
}

export function buildGaussianMask({ mode, radius, bandwidth, sigma }, padSize, cv) {
  const rows = padSize.height
  const cols = padSize.width
  const centerX = Math.floor(cols / 2)
  const centerY = Math.floor(rows / 2)
  const maxRadius = Math.min(cols, rows) / 2

  const radiusPx = clamp01(Math.min(0.5, radius)) * maxRadius
  const bandPx = clamp01(Math.min(0.5, bandwidth ?? 0.1)) * maxRadius
  const innerPx = Math.max(0, radiusPx - bandPx / 2)
  const outerPx = Math.max(innerPx, radiusPx + bandPx / 2)
  const sigmaPx = clamp01(Math.min(0.5, sigma ?? 0.08)) * maxRadius

  const mask = new cv.Mat(rows, cols, cv.CV_32F)

  // Gaussian bandpass uses outerLP - innerLP, then clamps to [0, 1].
  const gaussianLP = (dist, sigmaValue) => {
    if (sigmaValue <= 0) {
      return 0
    }
    const denom = 2 * sigmaValue * sigmaValue
    return Math.exp(-(dist * dist) / denom)
  }

  for (let y = 0; y < rows; y += 1) {
    const row = mask.floatPtr(y)
    const dy = y - centerY
    for (let x = 0; x < cols; x += 1) {
      const dx = x - centerX
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (mode === 'lowpass') {
        row[x] = gaussianLP(dist, sigmaPx)
      } else if (mode === 'highpass') {
        row[x] = 1 - gaussianLP(dist, sigmaPx)
      } else if (mode === 'bandpass') {
        const outerLP = gaussianLP(dist, Math.max(outerPx, 1))
        const innerLP = gaussianLP(dist, Math.max(innerPx, 1))
        row[x] = clamp01(outerLP - innerLP)
      } else if (mode === 'bandstop') {
        const outerLP = gaussianLP(dist, Math.max(outerPx, 1))
        const innerLP = gaussianLP(dist, Math.max(innerPx, 1))
        row[x] = 1 - clamp01(outerLP - innerLP)
      } else {
        row[x] = 1
      }
    }
  }

  return mask
}

export function buildDCTMask(filterSpec, size, cv) {
  if (!filterSpec || filterSpec.mode === 'none') {
    return null
  }
  const rows = size.height
  const cols = size.width
  const maxRadius = Math.sqrt((cols - 1) * (cols - 1) + (rows - 1) * (rows - 1))
  const radiusPx = clamp01(Math.min(1, filterSpec.radius ?? 0.3)) * maxRadius
  const bandPx = clamp01(Math.min(1, filterSpec.bandwidth ?? 0.1)) * maxRadius
  const innerPx = Math.max(0, radiusPx - bandPx / 2)
  const outerPx = Math.max(innerPx, radiusPx + bandPx / 2)
  const sigmaPx = clamp01(Math.min(1, filterSpec.sigma ?? 0.1)) * maxRadius

  const mask = new cv.Mat(rows, cols, cv.CV_32F)
  const gaussianLP = (dist, sigmaValue) => {
    if (sigmaValue <= 0) {
      return 0
    }
    const denom = 2 * sigmaValue * sigmaValue
    return Math.exp(-(dist * dist) / denom)
  }

  for (let y = 0; y < rows; y += 1) {
    const row = mask.floatPtr(y)
    for (let x = 0; x < cols; x += 1) {
      const dist = Math.sqrt(x * x + y * y)
      if (filterSpec.shape === 'gaussian') {
        if (filterSpec.mode === 'lowpass') {
          row[x] = gaussianLP(dist, sigmaPx)
        } else if (filterSpec.mode === 'highpass') {
          row[x] = 1 - gaussianLP(dist, sigmaPx)
        } else if (filterSpec.mode === 'bandpass') {
          const outerLP = gaussianLP(dist, Math.max(outerPx, 1))
          const innerLP = gaussianLP(dist, Math.max(innerPx, 1))
          row[x] = clamp01(outerLP - innerLP)
        } else if (filterSpec.mode === 'bandstop') {
          const outerLP = gaussianLP(dist, Math.max(outerPx, 1))
          const innerLP = gaussianLP(dist, Math.max(innerPx, 1))
          row[x] = 1 - clamp01(outerLP - innerLP)
        } else {
          row[x] = 1
        }
      } else {
        const isInside = dist <= radiusPx
        const isBand = dist >= innerPx && dist <= outerPx
        if (filterSpec.mode === 'lowpass') {
          row[x] = isInside ? 1 : 0
        } else if (filterSpec.mode === 'highpass') {
          row[x] = isInside ? 0 : 1
        } else if (filterSpec.mode === 'bandpass') {
          row[x] = isBand ? 1 : 0
        } else if (filterSpec.mode === 'bandstop') {
          row[x] = isBand ? 0 : 1
        } else {
          row[x] = 1
        }
      }
    }
  }

  return mask
}

export function applyMaskToMatrix(source, mask, cv) {
  const filtered = new cv.Mat()
  cv.multiply(source, mask, filtered)
  return filtered
}

export function applyMaskToSpectrum(shiftedDFT, mask, cv) {
  let planes = null
  let real = null
  let imag = null
  let filteredReal = null
  let filteredImag = null
  let filtered = null

  try {
    planes = new cv.MatVector()
    cv.split(shiftedDFT, planes)
    real = planes.get(0)
    imag = planes.get(1)

    filteredReal = new cv.Mat()
    filteredImag = new cv.Mat()
    cv.multiply(real, mask, filteredReal)
    cv.multiply(imag, mask, filteredImag)

    const merged = new cv.MatVector()
    merged.push_back(filteredReal)
    merged.push_back(filteredImag)
    filtered = new cv.Mat()
    cv.merge(merged, filtered)
    merged.delete()

    return filtered
  } finally {
    if (planes) planes.delete()
    if (real) real.delete()
    if (imag) imag.delete()
    if (filteredReal) filteredReal.delete()
    if (filteredImag) filteredImag.delete()
  }
}

const bandMapCache = new Map()

const getBandMapKey = (cols, rows, bands, mode) => {
  const bandKey = bands.map((band) => `${band.min}-${band.max}`).join('|')
  return `${cols}x${rows}:${mode}:${bandKey}`
}

const getOrCreateBandMap = (cols, rows, bands, mode) => {
  const key = getBandMapKey(cols, rows, bands, mode)
  if (bandMapCache.has(key)) {
    return bandMapCache.get(key)
  }
  const centerX = mode === 'origin' ? 0 : Math.floor(cols / 2)
  const centerY = mode === 'origin' ? 0 : Math.floor(rows / 2)
  const cornerX = mode === 'origin' ? cols - 1 : centerX
  const cornerY = mode === 'origin' ? rows - 1 : centerY
  const rCorner = Math.sqrt(cornerX * cornerX + cornerY * cornerY)
  const bandMap = new Int8Array(cols * rows)

  for (let y = 0; y < rows; y += 1) {
    const dy = y - centerY
    for (let x = 0; x < cols; x += 1) {
      const dx = x - centerX
      const dist = Math.sqrt(dx * dx + dy * dy)
      const rNorm = rCorner > 0 ? dist / rCorner : 0
      let bin = -1
      for (let i = 0; i < bands.length; i += 1) {
        const band = bands[i]
        if (rNorm >= band.min && rNorm <= band.max) {
          bin = i
          break
        }
      }
      bandMap[y * cols + x] = bin
    }
  }

  bandMapCache.set(key, bandMap)
  return bandMap
}

export function computeBandEnergyFromComplex(shiftedDFT, bands, cv) {
  // Stats must be computed from raw/power spectrum, not display spectrum.
  const rows = shiftedDFT.rows
  const cols = shiftedDFT.cols
  const bandMap = getOrCreateBandMap(cols, rows, bands, 'center')

  let planes = null
  let real = null
  let imag = null

  try {
    planes = new cv.MatVector()
    cv.split(shiftedDFT, planes)
    real = planes.get(0)
    imag = planes.get(1)

    const totals = bands.map(() => 0)
    let totalEnergy = 0

    for (let y = 0; y < rows; y += 1) {
      const realRow = real.floatPtr(y)
      const imagRow = imag.floatPtr(y)
      const offset = y * cols
      for (let x = 0; x < cols; x += 1) {
        const r = realRow[x]
        const i = imagRow[x]
        const power = r * r + i * i
        totalEnergy += power
        const bin = bandMap[offset + x]
        if (bin >= 0) {
          totals[bin] += power
        }
      }
    }

    const ratios = totals.map((energy) => (totalEnergy > 0 ? (energy / totalEnergy) * 100 : 0))
    return {
      totalEnergy,
      bands: totals,
      ratios,
    }
  } finally {
    if (real) real.delete()
    if (imag) imag.delete()
    if (planes) planes.delete()
  }
}

export function computeBandEnergyFromMatrix(matrix, bands) {
  // Stats must be computed from raw coefficients, not display spectrum.
  const rows = matrix.rows
  const cols = matrix.cols
  const bandMap = getOrCreateBandMap(cols, rows, bands, 'origin')

  const totals = bands.map(() => 0)
  let totalEnergy = 0

  for (let y = 0; y < rows; y += 1) {
    const row = matrix.floatPtr(y)
    const offset = y * cols
    for (let x = 0; x < cols; x += 1) {
      const value = row[x]
      const power = value * value
      totalEnergy += power
      const bin = bandMap[offset + x]
      if (bin >= 0) {
        totals[bin] += power
      }
    }
  }

  const ratios = totals.map((energy) => (totalEnergy > 0 ? (energy / totalEnergy) * 100 : 0))
  return {
    totalEnergy,
    bands: totals,
    ratios,
  }
}

/**
 * 计算频率域频谱（Log-Magnitude）
 * 按照标准流程：灰度化 -> DFT -> 幅度 -> Log 缩放 -> 归一化 -> Shift
 * 
 * @param {cv.Mat} srcMat - 输入图像（BGR 或灰度）
 * @param {cv.Mat} cv - OpenCV 对象
 * @returns {cv.Mat} - 归一化后的 Log-Magnitude 频谱（单通道，0-255）
 */
export function computeFrequencySpectrum(srcMat, cv) {
  let gray = null
  let padded = null
  let planes = null
  let complexI = null
  let dft = null
  let mag = null
  let logMag = null
  let normalized = null
  
  try {
    // 1. 灰度化：转换为单通道 CV_64F
    gray = new cv.Mat()
    if (srcMat.channels() === 1) {
      srcMat.convertTo(gray, cv.CV_64F)
    } else {
      const tempGray = new cv.Mat()
      cv.cvtColor(srcMat, tempGray, cv.COLOR_BGR2GRAY)
      tempGray.convertTo(gray, cv.CV_64F)
      tempGray.delete()
    }
    
    // 2. 扩展图像到最佳 DFT 尺寸（2的幂次）
    const rows = cv.getOptimalDFTSize(gray.rows)
    const cols = cv.getOptimalDFTSize(gray.cols)
    padded = new cv.Mat()
    cv.copyMakeBorder(gray, padded, 0, rows - gray.rows, 0, cols - gray.cols, cv.BORDER_CONSTANT, new cv.Scalar(0))
    
    // 3. 准备复数矩阵：实部 + 虚部
    planes = new cv.MatVector()
    const realPart = padded.clone()
    const imagPart = new cv.Mat.zeros(padded.rows, padded.cols, cv.CV_64F)
    planes.push_back(realPart)
    planes.push_back(imagPart)
    
    complexI = new cv.Mat()
    cv.merge(planes, complexI)
    
    // 4. DFT：执行离散傅里叶变换
    dft = new cv.Mat()
    cv.dft(complexI, dft, cv.DFT_COMPLEX_OUTPUT)
    
    // 5. 分离实部和虚部
    const dftPlanes = new cv.MatVector()
    cv.split(dft, dftPlanes)
    const real = dftPlanes.get(0)
    const imag = dftPlanes.get(1)
    
    // 6. 计算幅度：M = sqrt(real^2 + imag^2)
    mag = new cv.Mat()
    cv.magnitude(real, imag, mag)
    
    // 7. Log 缩放：M' = log(1 + M) 使高频可见
    logMag = new cv.Mat()
    cv.add(mag, new cv.Mat.ones(mag.rows, mag.cols, cv.CV_64F), logMag)
    cv.log(logMag, logMag)
    
    // 8. FFT Shift：将零频率移到中心
    const shifted = fftShift(logMag, cv)
    
    // 9. 归一化到 [0, 255] 用于显示
    normalized = new cv.Mat()
    cv.normalize(shifted, normalized, 0, 255, cv.NORM_MINMAX, cv.CV_8U)
    
    // 清理中间对象
    real.delete()
    imag.delete()
    dftPlanes.delete()
    shifted.delete()
    
    return normalized.clone() // 返回克隆，调用者负责删除
  } finally {
    // 确保所有临时对象都被释放
    if (gray) gray.delete()
    if (padded) padded.delete()
    if (planes) planes.delete()
    if (complexI) complexI.delete()
    if (dft) dft.delete()
    if (mag) mag.delete()
    if (logMag) logMag.delete()
    if (normalized) normalized.delete()
  }
}

/**
 * 将图像 URL/DataURL 转换为 cv.Mat
 * 
 * @param {string} imageSrc - 图片的 Data URL 或 URL
 * @param {cv.Mat} cv - OpenCV 对象
 * @returns {Promise<cv.Mat>} - 加载的图像矩阵
 */
export function loadImageToMat(imageSrc, cv) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const mat = cv.imread(img)
        resolve(mat)
      } catch (error) {
        reject(error)
      }
    }
    img.onerror = () => {
      reject(new Error('Failed to load image'))
    }
    img.src = imageSrc
  })
}

/**
 * 将 cv.Mat 渲染到 Canvas
 * 
 * @param {cv.Mat} mat - 要渲染的矩阵
 * @param {HTMLCanvasElement} canvas - 目标 Canvas 元素
 * @param {cv.Mat} cv - OpenCV 对象
 */
export function renderMatToCanvas(mat, canvas, cv) {
  cv.imshow(canvas, mat)
}
