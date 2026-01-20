import { ref } from 'vue'
import { getTransformBackend } from './transformBackends'

const createLruCache = (maxSize) => {
  const cache = new Map()

  const get = (key) => {
    if (!cache.has(key)) {
      return null
    }
    const value = cache.get(key)
    cache.delete(key)
    cache.set(key, value)
    return value
  }

  const set = (key, value) => {
    if (cache.has(key)) {
      cache.delete(key)
    }
    cache.set(key, value)
    while (cache.size > maxSize) {
      const [oldestKey, oldestValue] = cache.entries().next().value
      if (oldestValue?.dispose) {
        oldestValue.dispose(oldestValue.state)
      }
      cache.delete(oldestKey)
    }
  }

  const clear = () => {
    for (const [, value] of cache) {
      if (value?.dispose) {
        value.dispose(value.state)
      }
    }
    cache.clear()
  }

  return { get, set, clear }
}

export const useTransformEngine = () => {
  const taskToken = ref(0)
  const forwardCache = createLruCache(4)
  const filterCache = createLruCache(6)

  const runTransform = async ({
    transformType,
    imageId,
    imageSrc,
    cv,
    options = {},
    filterSpec = null,
  }) => {
    const token = ++taskToken.value
    const backend = getTransformBackend(transformType)
    if (!backend) {
      return { cancelled: true }
    }

    const forwardKey = backend.getCacheKey(imageId, options)
    let forwardEntry = forwardCache.get(forwardKey)
    if (!forwardEntry) {
      const state = await backend.forward({ imageSrc, cv }, options)
      forwardEntry = { state, dispose: (value) => backend.dispose?.(value) }
      forwardCache.set(forwardKey, forwardEntry)
    }

    if (token !== taskToken.value) {
      return { cancelled: true }
    }

    const normalizedFilter = filterSpec && filterSpec.mode !== 'none' ? filterSpec : null
    let filteredEntry = null
    let filteredState = forwardEntry.state

    if (normalizedFilter) {
      const filterKey = backend.getCacheKey(imageId, options, normalizedFilter)
      filteredEntry = filterCache.get(filterKey)
      if (!filteredEntry) {
        const state = await backend.applyFilter(forwardEntry.state, normalizedFilter, cv)
        filteredEntry = { state, dispose: (value) => backend.dispose?.(value) }
        filterCache.set(filterKey, filteredEntry)
      }
      filteredState = filteredEntry.state
    }

    if (token !== taskToken.value) {
      return { cancelled: true }
    }

    const display = await backend.getDisplay(filteredState, cv)
    const metrics = backend.computeMetrics(filteredState, cv)
    const reconstructedMat = await backend.inverse(filteredState, cv)

    if (token !== taskToken.value) {
      if (display?.displayMat) display.displayMat.delete()
      if (display?.maskDisplay) display.maskDisplay.delete()
      if (reconstructedMat) reconstructedMat.delete()
      return { cancelled: true }
    }

    return {
      token,
      cancelled: false,
      display,
      metrics,
      reconstructedMat,
      meta: filteredState.meta,
    }
  }

  const cancel = () => {
    taskToken.value += 1
  }

  return {
    runTransform,
    cancel,
    clearCache: () => {
      forwardCache.clear()
      filterCache.clear()
    },
  }
}
