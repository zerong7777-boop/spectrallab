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

