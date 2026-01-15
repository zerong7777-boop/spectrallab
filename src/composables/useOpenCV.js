import { ref } from 'vue'

/**
 * OpenCV.js 异步加载和管理
 * 处理 OpenCV.js WebAssembly 的加载和初始化
 */
export function useOpenCV() {
  const opencvReady = ref(false)
  const cv = ref(null)
  const loadingError = ref(null)

  /**
   * 加载 OpenCV.js
   * 从 CDN 加载 OpenCV.js WebAssembly 版本
   */
  const loadOpenCV = async () => {
    try {
      // 检查是否已经加载
      if (window.cv) {
        cv.value = window.cv
        opencvReady.value = true
        return
      }

      // 动态加载 OpenCV.js
      const script = document.createElement('script')
      script.src = 'https://docs.opencv.org/4.x/opencv.js'
      script.async = true
      script.onload = () => {
        // OpenCV.js 加载完成后，等待 cv 对象初始化
        const checkCV = setInterval(() => {
          if (window.cv && window.cv.Mat) {
            cv.value = window.cv
            opencvReady.value = true
            clearInterval(checkCV)
          }
        }, 100)
      }
      script.onerror = () => {
        loadingError.value = 'Failed to load OpenCV.js'
        console.error('OpenCV.js 加载失败')
      }
      document.head.appendChild(script)
    } catch (error) {
      loadingError.value = error.message
      console.error('加载 OpenCV.js 时出错:', error)
    }
  }

  return {
    opencvReady,
    cv,
    loadingError,
    loadOpenCV,
  }
}

