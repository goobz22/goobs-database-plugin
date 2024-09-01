import { ServerLogger } from 'goobs-testing'

async function measureAsyncExecutionTime<T>(
  func: () => Promise<T>
): Promise<{ result: T; duration: number }> {
  const start = performance.now()
  const result = await func()
  const end = performance.now()
  return { result, duration: end - start }
}

export const ServerSetHitCountModule = (function () {
  async function getSetHitCountKey(
    identifier: string,
    storeName: string
  ): Promise<string> {
    const key = `${identifier}:${storeName}:setHitCount`
    await ServerLogger.debug('Generated setHitCount key', {
      key,
      identifier,
      storeName,
    })
    return key
  }

  async function parseHitCount(hitCountString: string | null): Promise<number> {
    const hitCount = hitCountString ? parseInt(hitCountString, 10) : 0
    await ServerLogger.debug('Parsed hit count', { hitCount, hitCountString })
    return hitCount
  }

  async function incrementHitCount(currentHitCount: number): Promise<number> {
    const newHitCount = currentHitCount + 1
    await ServerLogger.debug('Incremented hit count', {
      currentHitCount,
      newHitCount,
    })
    return newHitCount
  }

  return {
    async incrementSetHitCount(
      get: (key: string) => Promise<string | null>,
      set: (key: string, value: string) => Promise<void>,
      identifier: string,
      storeName: string
    ): Promise<number> {
      const { result: newHitCount, duration } = await measureAsyncExecutionTime(
        async () => {
          try {
            await ServerLogger.debug('Incrementing set hit count', {
              identifier,
              storeName,
            })
            const hitCountKey = await getSetHitCountKey(identifier, storeName)
            const currentHitCount = await parseHitCount(await get(hitCountKey))
            const newHitCount = await incrementHitCount(currentHitCount)

            await set(hitCountKey, newHitCount.toString())

            await ServerLogger.debug('Incremented set hit count', {
              identifier,
              storeName,
              oldHitCount: currentHitCount,
              newHitCount,
            })
            return newHitCount
          } catch (error) {
            await ServerLogger.debug('Error incrementing set hit count', {
              error: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined,
              identifier,
              storeName,
            })
            throw error
          }
        }
      )
      await ServerLogger.debug('incrementSetHitCount execution time', {
        duration,
      })
      return newHitCount
    },

    getSetHitCountKey,
    parseHitCount,
    incrementHitCount,
  }
})()

process.on(
  'unhandledRejection',
  async (reason: unknown, promise: Promise<unknown>) => {
    await ServerLogger.debug('Unhandled Rejection at:', {
      promise,
      reason: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    })
  }
)

export default ServerSetHitCountModule
