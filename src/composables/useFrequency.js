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

const dwt2d = (data, width, height, levels, wavelet) => {
  const usedWidth = width % 2 === 0 ? width : width - 1
  const usedHeight = height % 2 === 0 ? height : height - 1
  const levelCount = getMaxLevels(usedWidth, usedHeight, levels)
  const coeffs = new Float32Array(usedWidth * usedHeight)

  for (let y = 0; y < usedHeight; y += 1) {
    for (let x = 0; x < usedWidth; x += 1) {
      coeffs[y * usedWidth + x] = data[y * width + x]
    }
  }

  const { decLo, decHi } = WAVELETS[wavelet]

  for (let level = 1; level <= levelCount; level += 1) {
    const currentWidth = usedWidth >> (level - 1)
    const currentHeight = usedHeight >> (level - 1)
    const halfWidth = currentWidth / 2
    const halfHeight = currentHeight / 2
    const rowTemp = new Float32Array(currentWidth * currentHeight)

    for (let r = 0; r < currentHeight; r += 1) {
      const row = new Float32Array(currentWidth)
      for (let c = 0; c < currentWidth; c += 1) {
        row[c] = coeffs[r * usedWidth + c]
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
        coeffs[r * usedWidth + c] = low[r]
        coeffs[(r + halfHeight) * usedWidth + c] = high[r]
      }
    }
  }

  return {
    coefficients: coeffs,
    usedSize: { width: usedWidth, height: usedHeight },
    levelCount,
  }
}

const idwt2d = (coeffs, usedWidth, usedHeight, levels, wavelet) => {
  const output = new Float32Array(coeffs)
  const { recLo, recHi } = WAVELETS[wavelet]

  for (let level = levels; level >= 1; level -= 1) {
    const currentWidth = usedWidth >> (level - 1)
    const currentHeight = usedHeight >> (level - 1)
    const halfWidth = currentWidth / 2
    const halfHeight = currentHeight / 2
    const colTemp = new Float32Array(currentWidth * currentHeight)

    for (let c = 0; c < currentWidth; c += 1) {
      const low = new Float32Array(halfHeight)
      const high = new Float32Array(halfHeight)
      for (let r = 0; r < halfHeight; r += 1) {
        low[r] = output[r * usedWidth + c]
        high[r] = output[(r + halfHeight) * usedWidth + c]
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
        output[r * usedWidth + c] = row[c]
      }
    }
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

    const result = dwt2d(gray.data32F, gray.cols, gray.rows, levels, wavelet)
    return {
      coefficients: result.coefficients,
      meta: {
        origSize: { width: srcMat.cols, height: srcMat.rows },
        usedSize: result.usedSize,
        levelCount: result.levelCount,
        wavelet,
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
  const reconstructed = idwt2d(coefficients, meta.usedSize.width, meta.usedSize.height, meta.levelCount, meta.wavelet)
  let mat = null
  let normalized = null

  try {
    mat = cv.matFromArray(meta.usedSize.height, meta.usedSize.width, cv.CV_32F, reconstructed)
    normalized = new cv.Mat()
    cv.normalize(mat, normalized, 0, 255, cv.NORM_MINMAX, cv.CV_8U)

    if (meta.usedSize.width === meta.origSize.width && meta.usedSize.height === meta.origSize.height) {
      return normalized
    }

    const padded = new cv.Mat.zeros(meta.origSize.height, meta.origSize.width, cv.CV_8U)
    const roi = padded.roi(new cv.Rect(0, 0, meta.usedSize.width, meta.usedSize.height))
    normalized.copyTo(roi)
    roi.delete()
    normalized.delete()
    return padded
  } finally {
    if (mat) mat.delete()
  }
}

export function applyDWTFilter(coefficients, meta, filter) {
  const output = new Float32Array(coefficients)
  const { width, height } = meta.usedSize
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
  const { width, height } = meta.usedSize
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
