import { ServerLogger } from 'goobs-testing'

async function measureAsyncExecutionTime<T>(
  func: () => Promise<T>
): Promise<{ result: T; duration: number }> {
  const start = performance.now()
  const result = await func()
  const end = performance.now()
  return { result, duration: end - start }
}

export const ServerLastAccessedDateModule = (function () {
  async function getLastAccessedDateKey(
    identifier: string,
    storeName: string
  ): Promise<string> {
    const key = `${identifier}:${storeName}:lastAccessed`
    await ServerLogger.debug('Generated lastAccessed key', {
      key,
      identifier,
      storeName,
    })
    return key
  }

  async function parseDate(dateString: string | null): Promise<Date> {
    const date = dateString ? new Date(dateString) : new Date(0)
    await ServerLogger.debug('Parsed date', {
      date: date.toISOString(),
      dateString,
    })
    return date
  }

  return {
    async getLastAccessedDate(
      get: (key: string) => Promise<string | null>,
      identifier: string,
      storeName: string
    ): Promise<Date> {
      const { result, duration } = await measureAsyncExecutionTime(async () => {
        try {
          await ServerLogger.debug('Fetching last accessed date', {
            identifier,
            storeName,
          })
          const lastAccessedKey = await getLastAccessedDateKey(
            identifier,
            storeName
          )
          const result = await parseDate(await get(lastAccessedKey))
          await ServerLogger.debug('Retrieved last accessed date', {
            identifier,
            storeName,
            date: result.toISOString(),
          })
          return result
        } catch (error: unknown) {
          await ServerLogger.debug('Error in getLastAccessedDate', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            identifier,
            storeName,
          })
          throw error
        }
      })
      await ServerLogger.debug('getLastAccessedDate execution time', {
        duration,
      })
      return result
    },

    async updateLastAccessedDate(
      set: (key: string, value: string) => Promise<void>,
      identifier: string,
      storeName: string,
      date: Date = new Date()
    ): Promise<void> {
      const { duration } = await measureAsyncExecutionTime(async () => {
        try {
          await ServerLogger.debug('Updating last accessed date', {
            identifier,
            storeName,
            date: date.toISOString(),
          })
          const lastAccessedKey = await getLastAccessedDateKey(
            identifier,
            storeName
          )
          await set(lastAccessedKey, date.toISOString())
          await ServerLogger.debug('Last accessed date set successfully', {
            identifier,
            storeName,
            date: date.toISOString(),
          })
        } catch (error: unknown) {
          await ServerLogger.debug('Error in updateLastAccessedDate', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            identifier,
            storeName,
            date: date.toISOString(),
          })
          throw error
        }
      })
      await ServerLogger.debug('updateLastAccessedDate execution time', {
        duration,
      })
    },

    getLastAccessedDateKey,
    parseDate,
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

export default ServerLastAccessedDateModule
