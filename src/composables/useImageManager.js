import { ref, computed } from 'vue'

/**
 * 多图像管理 Composable
 * 管理图像集合、选择状态和处理结果
 */
export function useImageManager() {
  const images = ref([])
  const selectedImageId = ref(null)

  /**
   * 添加图像到集合
   * @param {File} file - 图像文件
   * @returns {Promise<string>} - 图像ID
   */
  const addImage = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          const imageData = {
            id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: file.name,
            size: file.size,
            dataURL: e.target.result,
            width: img.width,
            height: img.height,
            format: file.type,
            uploadTime: new Date().toISOString(),
            transformResults: {}, // 存储不同变换方法的结果
            processing: false,
          }
          images.value.push(imageData)
          
          // 如果是第一张图片，自动选中
          if (images.value.length === 1) {
            selectedImageId.value = imageData.id
          }
          
          resolve(imageData.id)
        }
        img.onerror = () => reject(new Error('Failed to load image'))
        img.src = e.target.result
      }
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsDataURL(file)
    })
  }

  /**
   * 批量添加图像
   * @param {File[]} files - 图像文件数组
   * @returns {Promise<string[]>} - 图像ID数组
   */
  const addImages = async (files) => {
    const promises = Array.from(files).map(file => addImage(file))
    return Promise.all(promises)
  }

  /**
   * 删除图像
   * @param {string} imageId - 图像ID
   */
  const removeImage = (imageId) => {
    const index = images.value.findIndex(img => img.id === imageId)
    if (index !== -1) {
      images.value.splice(index, 1)
      
      // 如果删除的是当前选中的图像，选择另一张
      if (selectedImageId.value === imageId) {
        if (images.value.length > 0) {
          selectedImageId.value = images.value[0].id
        } else {
          selectedImageId.value = null
        }
      }
    }
  }

  /**
   * 选择图像
   * @param {string} imageId - 图像ID
   */
  const selectImage = (imageId) => {
    if (images.value.some(img => img.id === imageId)) {
      selectedImageId.value = imageId
    }
  }

  /**
   * 清空所有图像
   */
  const clearAll = () => {
    images.value = []
    selectedImageId.value = null
  }

  /**
   * 获取当前选中的图像
   */
  const selectedImage = computed(() => {
    return images.value.find(img => img.id === selectedImageId.value) || null
  })

  /**
   * 更新图像的变换结果
   * @param {string} imageId - 图像ID
   * @param {string} transformType - 变换类型 (DFT, DCT, etc.)
   * @param {Object} result - 变换结果数据
   */
  const updateTransformResult = (imageId, transformType, result) => {
    const image = images.value.find(img => img.id === imageId)
    if (image) {
      image.transformResults[transformType] = result
    }
  }

  /**
   * 设置图像处理状态
   * @param {string} imageId - 图像ID
   * @param {boolean} processing - 是否正在处理
   */
  const setProcessing = (imageId, processing) => {
    const image = images.value.find(img => img.id === imageId)
    if (image) {
      image.processing = processing
    }
  }

  return {
    images,
    selectedImageId,
    selectedImage,
    addImage,
    addImages,
    removeImage,
    selectImage,
    clearAll,
    updateTransformResult,
    setProcessing,
  }
}
