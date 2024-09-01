'use server'
import { createLogger, format, transports } from 'winston'
import { MongoClient, Filter, ChangeStream, ObjectId } from 'mongodb'
import ConnectDb, { closeConnections } from './utils/connectDb'
import { Identifier } from './types'
import { Schema, Model, Document } from 'mongoose'
import ServerHitCountModule from './utils/get/hitCount.server'
import ServerLastDateModule from './utils/get/lastAccessedDate.server'

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

export const getFromMongo = async <T extends Document>(
  identifier: Identifier,
  schema: Schema<T>,
  model: Model<T>
): Promise<{
  data: T | T[]
  changeStream: ChangeStream<T>
}> => {
  logger.debug('Entering getFromMongo function', { identifier, schema })
  let client: MongoClient | null = null
  try {
    client = (await ConnectDb('get')) as MongoClient
    logger.debug('MongoDB connection established')
    const db = client.db()
    const collection = db.collection<T>(model.collection.name)
    const filter: Filter<T> = {}
    for (const key in identifier) {
      if (schema.path(key)) {
        filter[key as keyof Filter<T>] = identifier[key as keyof Identifier]
      }
    }
    logger.debug('Find filter created', { filter })
    let documents: T[]
    if ('id' in identifier && schema.path('id')) {
      const doc = (await collection.findOne(filter)) as T | null
      documents = doc ? [doc] : []
    } else {
      documents = (await collection.find(filter).toArray()) as T[]
    }
    logger.debug(`${documents.length} document(s) fetched`)
    if (
      documents.length > 0 &&
      schema.path('getHitCount') &&
      schema.path('lastAccessed')
    ) {
      const storeName = model.collection.name
      await Promise.all(
        documents.map(async doc => {
          const docId = doc._id as unknown as ObjectId
          await ServerHitCountModule.incrementGetHitCount(
            async (key: string) => {
              const result = await db.collection('cache').findOne({ key })
              return result ? result.value : null
            },
            async (key: string, value: string) => {
              await db
                .collection('cache')
                .updateOne({ key }, { $set: { value } }, { upsert: true })
            },
            docId.toString(),
            storeName
          )
          await ServerLastDateModule.updateLastAccessedDate(
            async (key: string, value: string) => {
              await db
                .collection('cache')
                .updateOne({ key }, { $set: { value } }, { upsert: true })
            },
            docId.toString(),
            storeName
          )
        })
      )
      if ('id' in identifier && schema.path('id')) {
        const updatedDoc = (await collection.findOne(filter)) as T | null
        documents = updatedDoc ? [updatedDoc] : []
      } else {
        documents = (await collection.find(filter).toArray()) as T[]
      }
    }
    const changeStream = collection.watch<T>([], {
      fullDocument: 'updateLookup',
    })
    changeStream.on('change', change => {
      logger.debug('Change detected', { change })
    })
    changeStream.on('error', error => {
      logger.error('Change stream error', { error })
    })
    const result =
      'id' in identifier && schema.path('id') ? documents[0] : documents
    return {
      data: result,
      changeStream,
    }
  } catch (error) {
    logger.error('Error in getFromMongo', { error, identifier, schema })
    throw error
  } finally {
    if (client) {
      logger.debug('Closing MongoDB connections')
      await closeConnections()
      logger.debug('MongoDB connections closed')
    }
  }
}

process.on(
  'unhandledRejection',
  async (reason: unknown, promise: Promise<unknown>) => {
    await logger.debug('Unhandled Rejection at:', {
      promise,
      reason: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    })
  }
)
