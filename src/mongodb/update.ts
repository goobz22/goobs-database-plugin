'use server'
import { createLogger, format, transports } from 'winston'
import mongoose, { Schema, Model, Document } from 'mongoose'
import {
  ChangeStream,
  ObjectId,
  Filter,
  UpdateFilter,
  FindOneAndUpdateOptions,
  WithId,
} from 'mongodb'
import ConnectDb, { closeConnections } from './utils/connectDb'
import { Identifier } from './types'
import ServerSetHitCountModule from './utils/update/hitCount.server'
import ServerLastUpdatedDateModule from './utils/update/lastUpdatedDate.server'

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
  defaultMeta: { service: 'generic-update' },
  transports: [
    new transports.Console({
      format: format.combine(format.colorize(), format.simple()),
    }),
    new transports.File({ filename: 'generic-update.log' }),
  ],
})

export async function updateItemInMongo<T extends Document>(
  identifier: Identifier,
  schema: Schema<T>,
  model: Model<T>,
  itemData: Partial<T> & { _id?: string },
  validateFields: (data: Partial<T>) => void,
  pipeline: Record<string, unknown>[] = []
): Promise<WithId<T> | null> {
  logger.debug('Starting updateItemInMongo', {
    identifier,
    schemaName: schema.constructor.name,
  })
  logger.debug('Item data received', {
    itemData,
    itemDataKeys: Object.keys(itemData),
  })

  let connection: mongoose.Connection | null = null
  let changeStream: ChangeStream | null = null
  try {
    logger.debug('Calling ConnectDb to establish MongoDB connection', {
      connectionType: 'update',
    })
    connection = (await ConnectDb('update')) as mongoose.Connection
    logger.debug('MongoDB connection established', {
      connectionType: 'update',
    })

    if (!connection) {
      throw new Error('Failed to establish MongoDB connection')
    }

    const collection = connection.db.collection<T>(model.collection.name)

    logger.debug('Setting up change stream', {
      collectionName: model.collection.name,
    })
    changeStream = collection.watch<T>(pipeline, {
      fullDocument: 'updateLookup',
    })
    changeStream.on('change', change => {
      logger.debug('Change detected', { change })
    })
    changeStream.on('error', error => {
      logger.error('Change stream error', { error })
    })
    logger.debug('Change stream set up', {
      collectionName: model.collection.name,
    })

    logger.debug('Validating required fields', {
      itemDataKeys: Object.keys(itemData),
    })
    validateFields(itemData)
    logger.debug('Required fields validated successfully', {
      itemDataKeys: Object.keys(itemData),
    })

    const filter: Filter<T> = {}
    Object.assign(filter, { company: new ObjectId(identifier.companyId) })
    if ('id' in identifier) {
      Object.assign(filter, { _id: new ObjectId(identifier.id) })
    } else if (itemData._id) {
      Object.assign(filter, { _id: new ObjectId(itemData._id) })
    }
    logger.debug('Filter created', {
      filter,
      filterKeys: Object.keys(filter),
    })

    const update: UpdateFilter<T> = {
      $set: {
        ...itemData,
        company: new ObjectId(identifier.companyId),
        updatedAt: new Date(),
        lastAccessed: new Date(),
      } as Partial<T>,
    }
    logger.debug('Update object created', {
      update,
      updateKeys: Object.keys(update.$set || {}),
    })

    const options: FindOneAndUpdateOptions = {
      returnDocument: 'after',
      upsert: true,
    }

    logger.debug('Calling findOneAndUpdate with filter and update', {
      filter,
      filterKeys: Object.keys(filter),
      update,
      updateKeys: Object.keys(update.$set || {}),
      options,
    })
    const updatedDoc = await collection.findOneAndUpdate(
      filter,
      update,
      options
    )
    logger.debug('findOneAndUpdate operation completed', {
      updatedDoc,
      updatedDocKeys: updatedDoc ? Object.keys(updatedDoc) : [],
    })

    if (!updatedDoc) {
      const errorMessage = 'Failed to update or insert document'
      logger.error(errorMessage, { filter, update })
      throw new Error(errorMessage)
    }

    logger.debug('Document updated successfully', {
      updatedDoc: updatedDoc,
      updatedDocKeys: Object.keys(updatedDoc),
    })

    logger.debug('Updating hit counts and last updated date', {
      _id: updatedDoc._id,
    })
    await ServerSetHitCountModule.incrementSetHitCount(
      async (key: string) => {
        if (!connection) throw new Error('MongoDB connection is null')
        const result = await connection.db.collection('cache').findOne({ key })
        return result ? (result.value as string | null) : null
      },
      async (key: string, value: string) => {
        if (!connection) throw new Error('MongoDB connection is null')
        await connection.db
          .collection('cache')
          .updateOne({ key }, { $set: { value } }, { upsert: true })
      },
      updatedDoc._id.toString(),
      model.collection.name
    )
    await ServerLastUpdatedDateModule.updateLastUpdatedDate(
      async (key: string, value: string) => {
        if (!connection) throw new Error('MongoDB connection is null')
        await connection.db
          .collection('cache')
          .updateOne({ key }, { $set: { value } }, { upsert: true })
      },
      updatedDoc._id.toString(),
      model.collection.name
    )
    logger.debug('Hit counts and last updated date updated successfully', {
      _id: updatedDoc._id,
    })

    logger.debug('Verifying updated document in the database', {
      _id: updatedDoc._id,
    })
    const verifiedDoc = await collection.findOne({
      _id: updatedDoc._id,
    } as Filter<T>)
    logger.debug('Final verification', {
      exists: !!verifiedDoc,
      verifiedDoc,
      verifiedDocKeys: verifiedDoc ? Object.keys(verifiedDoc) : [],
    })

    if (!verifiedDoc) {
      const errorMessage = 'Document not found in final verification'
      logger.error(errorMessage, {
        _id: updatedDoc._id,
      })
      throw new Error(errorMessage)
    }

    logger.info('Update successful', {
      verifiedDoc,
      verifiedDocKeys: Object.keys(verifiedDoc),
    })

    return verifiedDoc
  } catch (error) {
    logger.error('Error in updateItemInMongo', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace available',
      identifier,
      schemaName: schema.constructor.name,
      itemDataKeys: Object.keys(itemData),
    })
    if (error instanceof Error) {
      throw error
    } else {
      throw new Error('An unknown error occurred')
    }
  } finally {
    if (changeStream) {
      logger.debug('Closing change stream', {
        collectionName: model.collection.name,
      })
      await changeStream.close()
      logger.debug('Change stream closed', {
        collectionName: model.collection.name,
      })
    }
    if (connection) {
      logger.debug('Closing MongoDB connections', {
        connectionType: 'update',
      })
      await closeConnections()
      logger.debug('MongoDB connections closed', {
        connectionType: 'update',
      })
    }
    logger.debug('Exiting updateItemInMongo', {
      identifier,
      schemaName: schema.constructor.name,
      itemDataKeys: Object.keys(itemData),
    })
  }
}
