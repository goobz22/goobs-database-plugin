'use server'
import { createLogger, format, transports } from 'winston'
import mongoose, { Schema, Model, Document } from 'mongoose'
import { ChangeStream, ObjectId } from 'mongodb'
import ConnectDb, {
  closeConnections,
  setupChangeStream,
} from './utils/connectDb'
import { Identifier } from './types'

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
  defaultMeta: { service: 'generic-remove' },
  transports: [
    new transports.Console({
      format: format.combine(format.colorize(), format.simple()),
    }),
    new transports.File({ filename: 'generic-remove.log' }),
  ],
})

export const removeFromMongo = async <T extends Document>(
  identifier: Identifier,
  schema: Schema<T>,
  model: Model<T>
): Promise<{ success: boolean; changeStream: ChangeStream }> => {
  logger.debug('Entering removeFromMongo function', {
    identifier,
    schemaName: schema.constructor.name,
    modelName: model.modelName,
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

    logger.debug('Setting up change stream', { modelName: model.modelName })
    changeStream = await setupChangeStream(model.collection.name, [])
    logger.debug('Change stream set up', { modelName: model.modelName })

    const filter: Record<string, ObjectId> = {
      company: new ObjectId(identifier.companyId),
    }

    if ('id' in identifier) {
      filter._id = new ObjectId(identifier.id)
    }

    logger.debug('Delete filter created', {
      filter,
      filterKeys: Object.keys(filter),
    })

    logger.debug('Calling model.deleteOne with filter', {
      filter,
      filterKeys: Object.keys(filter),
    })
    const result = await model.deleteOne(filter)
    logger.debug('deleteOne operation completed', {
      result,
      deletedCount: result.deletedCount,
    })

    const success = result.deletedCount > 0
    logger.info(
      `removeFromMongo - Removed ${result.deletedCount} document(s) for identifier: ${JSON.stringify(identifier)}`,
      {
        result,
        deletedCount: result.deletedCount,
        success,
      }
    )

    if (success) {
      logger.debug('Item successfully removed', {
        identifier,
        modelName: model.modelName,
        schemaName: schema.constructor.name,
      })
    } else {
      logger.debug('No item found to remove', {
        identifier,
        modelName: model.modelName,
        schemaName: schema.constructor.name,
      })
    }

    return { success, changeStream }
  } catch (error) {
    logger.error('Error in removeFromMongo', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace available',
      identifier,
      modelName: model.modelName,
      schemaName: schema.constructor.name,
    })
    throw error
  } finally {
    if (connection) {
      logger.debug('Closing MongoDB connections', {
        connectionType: 'update',
      })
      await closeConnections()
      logger.debug('MongoDB connections closed', {
        connectionType: 'update',
      })
    }
    logger.debug('Exiting removeFromMongo function', {
      identifier,
      modelName: model.modelName,
      schemaName: schema.constructor.name,
    })
  }
}
