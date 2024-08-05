'use server'
import { createLogger, format, transports } from 'winston'
import {
  MongoClient,
  ObjectId,
  Document,
  Sort,
  WithId,
  Filter,
  UpdateFilter,
} from 'mongodb'
import ConnectDb, { closeConnections } from './connectDb'
import {
  GenericSerializableData,
  BaseSerializableData,
  serializeDocument,
  GenericDocument,
} from './types'

const logger = createLogger({
  level: 'debug',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.splat(),
    format.json(),
    format.printf(({ level, message, timestamp, ...metadata }) => {
      let msg = `${timestamp} [${level}] : ${message} `
      if (Object.keys(metadata).length > 0) {
        msg += JSON.stringify(metadata)
      }
      return msg
    })
  ),
  defaultMeta: { service: 'generic-get' },
  transports: [
    new transports.Console({
      format: format.combine(format.colorize(), format.simple()),
    }),
    new transports.File({ filename: 'generic-get.log' }),
  ],
})

export async function getFromMongo<
  T extends Document,
  S extends BaseSerializableData,
>(
  companyId: string,
  userId: string,
  mongoModelName: string,
  options: {
    itemId?: string
    filter?: Record<string, unknown>
    cachedData?: GenericSerializableData<S>[]
    getUpdatedAt?: (item: GenericSerializableData<S>) => Date
  } = {}
): Promise<{
  data: GenericSerializableData<S>[] | GenericSerializableData<S> | null
  isStale: boolean
}> {
  const { itemId, filter = {}, cachedData, getUpdatedAt } = options

  logger.debug('Entering getFromMongo function', {
    companyId,
    userId,
    mongoModelName,
    itemId: itemId || 'all',
    filter,
  })

  let client: MongoClient | null = null
  try {
    client = (await ConnectDb('get')) as MongoClient
    logger.debug('MongoDB connection established')

    const db = client.db()
    const collection = db.collection<T>(mongoModelName)

    const baseFilter: Record<string, unknown> = {
      company: new ObjectId(companyId),
      user: new ObjectId(userId),
    }

    const fullFilter: Filter<T> = {
      ...baseFilter,
      ...filter,
    } as Filter<T>

    if (itemId) {
      fullFilter._id = new ObjectId(itemId) as unknown as Filter<T>['_id']
    }

    logger.debug('Find filter created', { fullFilter })

    let isStale = true
    if (cachedData && cachedData.length > 0 && getUpdatedAt) {
      const sort: Sort = { updatedAt: -1 }
      const latestDocument = await collection.findOne(fullFilter, { sort })
      if (latestDocument) {
        const latestUpdatedAt = latestDocument.updatedAt as Date
        const cachedUpdatedAt = getUpdatedAt(cachedData[0])
        logger.debug('Comparing dates', { latestUpdatedAt, cachedUpdatedAt })
        isStale = latestUpdatedAt > cachedUpdatedAt
      }

      logger.info(
        `Stale status for companyId: ${companyId}, userId: ${userId}`,
        { isStale }
      )
      if (!isStale) {
        logger.debug('Returning cached data')
        return {
          data: itemId ? cachedData[0] || null : cachedData,
          isStale,
        }
      }
    }

    let documents: WithId<T>[]
    if (itemId) {
      const doc = await collection.findOne(fullFilter)
      logger.debug('Single document fetched', { doc })
      documents = doc ? [doc] : []
    } else {
      documents = await collection.find(fullFilter).toArray()
      logger.debug(`${documents.length} documents fetched`)
    }

    // Increment getHitCount for all retrieved documents
    if (documents.length > 0) {
      const bulkOps = documents.map(doc => ({
        updateOne: {
          filter: { _id: doc._id } as Filter<T>,
          update: {
            $inc: { getHitCount: 1 },
            $set: { lastAccessed: new Date() },
          } as unknown as UpdateFilter<T>,
        },
      }))
      const bulkResult = await collection.bulkWrite(bulkOps)
      logger.debug('Bulk write result', { bulkResult })
    }

    logger.debug(
      `Fetched ${documents.length} document(s) for companyId: ${companyId}, userId: ${userId}`
    )

    const serializedDocuments = documents.map(doc =>
      serializeDocument<T, S>(doc as unknown as GenericDocument<T>)
    )

    logger.debug('Documents serialized', {
      count: serializedDocuments.length,
      serializedDocuments,
    })

    let result: GenericSerializableData<S>[] | GenericSerializableData<S> | null
    if (itemId) {
      result = serializedDocuments.length > 0 ? serializedDocuments[0] : null
    } else {
      result = serializedDocuments
    }

    logger.debug('Final result', { result, resultType: typeof result })

    return {
      data: result,
      isStale,
    }
  } catch (error) {
    logger.error('Error in getFromMongo', {
      error,
      companyId,
      userId,
      mongoModelName,
      itemId: itemId || 'all',
      filter,
    })
    throw error
  } finally {
    if (client) {
      logger.debug('Closing MongoDB connections')
      await closeConnections()
      logger.debug('MongoDB connections closed')
    }
  }
}
