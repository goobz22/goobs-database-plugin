'use server'
import { createLogger, format, transports } from 'winston'
import mongoose, { Schema, Document } from 'mongoose'
import { ChangeStream } from 'mongodb'
import ConnectDb, { closeConnections } from './connectDb'
import {
  GenericDocument,
  GenericSerializableData,
  BaseSerializableData,
  serializeDocument,
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
  defaultMeta: { service: 'generic-update' },
  transports: [
    new transports.Console({
      format: format.combine(format.colorize(), format.simple()),
    }),
    new transports.File({ filename: 'generic-update.log' }),
  ],
})

export async function updateItemInMongo<
  T extends Document,
  S extends BaseSerializableData,
>(
  companyId: string,
  userId: string,
  mongoModelName: string,
  schema: Schema,
  itemData: Partial<T> & { _id?: string },
  validateFields: (data: Partial<T>) => void,
  onChangeCallback?: (change: unknown) => void,
  pipeline: Record<string, unknown>[] = []
): Promise<GenericSerializableData<S>> {
  logger.info('Starting updateItemInMongo', {
    companyId,
    userId,
    mongoModelName,
    schemaName: schema.obj.constructor.name,
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

    logger.debug('Creating Mongoose model', {
      mongoModelName,
      schemaName: schema.obj.constructor.name,
    })
    const Model = connection.model<GenericDocument<T>>(mongoModelName, schema)
    logger.debug('Mongoose model created', {
      mongoModelName,
      schemaName: schema.obj.constructor.name,
    })

    if (onChangeCallback) {
      logger.debug('Setting up change stream', { mongoModelName })
      changeStream = Model.watch(pipeline, { fullDocument: 'updateLookup' })
      changeStream.on('change', async change => {
        logger.debug('Change detected', { change })
        onChangeCallback(change)
      })
      changeStream.on('error', error => {
        logger.error('Change stream error', { error })
      })
      logger.debug('Change stream set up', { mongoModelName })
    }

    logger.debug('Validating required fields', {
      itemDataKeys: Object.keys(itemData),
    })
    validateFields(itemData)
    logger.debug('Required fields validated successfully', {
      itemDataKeys: Object.keys(itemData),
    })

    const filter = itemData._id
      ? {
          _id: new mongoose.Types.ObjectId(itemData._id),
          company: new mongoose.Types.ObjectId(companyId),
          user: new mongoose.Types.ObjectId(userId),
        }
      : {
          company: new mongoose.Types.ObjectId(companyId),
          user: new mongoose.Types.ObjectId(userId),
        }
    logger.debug('Filter created', {
      filter,
      filterKeys: Object.keys(filter),
    })

    const update = {
      $set: {
        ...itemData,
        company: new mongoose.Types.ObjectId(companyId),
        user: new mongoose.Types.ObjectId(userId),
        updatedAt: new Date(),
        lastAccessed: new Date(),
      },
    }
    logger.debug('Update object created', {
      update,
      updateKeys: Object.keys(update.$set),
    })

    const options = {
      new: true,
      upsert: true,
      runValidators: true,
    }

    logger.debug('Calling Model.findOneAndUpdate with filter and update', {
      filter,
      filterKeys: Object.keys(filter),
      update,
      updateKeys: Object.keys(update.$set),
      options,
    })
    const updatedDoc = await Model.findOneAndUpdate(filter, update, options)
    logger.debug('findOneAndUpdate operation completed', {
      updatedDoc,
      updatedDocKeys: updatedDoc ? Object.keys(updatedDoc.toObject()) : [],
    })

    if (!updatedDoc) {
      const errorMessage = 'Failed to update or insert document'
      logger.error(errorMessage, { filter, update })
      throw new Error(errorMessage)
    }

    logger.debug('Document updated successfully', {
      updatedDoc,
      updatedDocKeys: Object.keys(updatedDoc.toObject()),
    })

    logger.debug('Incrementing setHitCount for updated document', {
      _id: updatedDoc._id,
    })
    await Model.updateOne({ _id: updatedDoc._id }, { $inc: { setHitCount: 1 } })
    logger.debug('setHitCount incremented successfully', {
      _id: updatedDoc._id,
    })

    logger.debug('Verifying updated document in the database', {
      _id: updatedDoc._id,
    })
    const verifiedDoc = await Model.findById(updatedDoc._id)
    logger.debug('Final verification', {
      exists: !!verifiedDoc,
      verifiedDoc,
      verifiedDocKeys: verifiedDoc ? Object.keys(verifiedDoc.toObject()) : [],
    })

    if (!verifiedDoc) {
      const errorMessage = 'Document not found in final verification'
      logger.error(errorMessage, {
        _id: updatedDoc._id,
      })
      throw new Error(errorMessage)
    }

    logger.debug('Serializing updated document', {
      verifiedDoc,
      verifiedDocKeys: Object.keys(verifiedDoc.toObject()),
    })
    const serializedDoc = serializeDocument<T, S>(verifiedDoc)
    logger.info('Update successful', {
      serializedDoc,
      serializedDocKeys: Object.keys(serializedDoc),
    })

    return serializedDoc
  } catch (error) {
    logger.error('Error in updateItemInMongo', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace available',
      companyId,
      userId,
      mongoModelName,
      schemaName: schema.obj.constructor.name,
      itemDataKeys: Object.keys(itemData),
    })
    if (error instanceof Error) {
      throw error
    } else {
      throw new Error('An unknown error occurred')
    }
  } finally {
    if (changeStream) {
      logger.debug('Closing change stream', { mongoModelName })
      await changeStream.close()
      logger.debug('Change stream closed', { mongoModelName })
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
      companyId,
      userId,
      mongoModelName,
      schemaName: schema.obj.constructor.name,
      itemDataKeys: Object.keys(itemData),
    })
  }
}
