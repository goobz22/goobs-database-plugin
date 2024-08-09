'use server'
import { createLogger, format, transports } from 'winston'
import mongoose, { Schema, Document } from 'mongoose'
import { ChangeStream } from 'mongodb'
import ConnectDb, { closeConnections, setupChangeStream } from './connectDb'
import { GenericDocument } from './types'

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

export async function removeFromMongo<T extends Document>(
  companyId: string,
  userId: string,
  identifier: string,
  mongoModelName: string,
  schema: Schema<GenericDocument<T>>,
  additionalFilter: Record<string, unknown> = {},
  onChangeCallback?: (change: unknown) => void
): Promise<boolean> {
  logger.debug('Entering removeFromMongo function', {
    companyId,
    userId,
    identifier,
    mongoModelName,
    schemaName: schema.obj.constructor.name,
    additionalFilterKeys: Object.keys(additionalFilter),
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
      changeStream = await setupChangeStream(mongoModelName, [], onChangeCallback)
      logger.debug('Change stream set up', { mongoModelName })
    }

    const filter = {
      _id: new mongoose.Types.ObjectId(identifier),
      company: new mongoose.Types.ObjectId(companyId),
      user: new mongoose.Types.ObjectId(userId),
      ...additionalFilter,
    }
    logger.debug('Delete filter created', {
      filter,
      filterKeys: Object.keys(filter),
    })

    logger.debug('Calling Model.deleteOne with filter', {
      filter,
      filterKeys: Object.keys(filter),
    })
    const result = await Model.deleteOne(filter)
    logger.debug('deleteOne operation completed', {
      result,
      deletedCount: result.deletedCount,
    })

    const itemRemoved = result.deletedCount > 0
    logger.info(
      `removeFromMongo - Removed ${result.deletedCount} document(s) for companyId: ${companyId}, userId: ${userId}, and identifier: ${identifier}`,
      {
        result,
        deletedCount: result.deletedCount,
        itemRemoved,
      }
    )

    if (itemRemoved) {
      logger.debug('Item successfully removed', {
        companyId,
        userId,
        identifier,
        mongoModelName,
        schemaName: schema.obj.constructor.name,
      })
    } else {
      logger.debug('No item found to remove', {
        companyId,
        userId,
        identifier,
        mongoModelName,
        schemaName: schema.obj.constructor.name,
      })
    }

    return itemRemoved
  } catch (error) {
    logger.error('Error in removeFromMongo', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace available',
      companyId,
      userId,
      identifier,
      mongoModelName,
      schemaName: schema.obj.constructor.name,
      additionalFilterKeys: Object.keys(additionalFilter),
    })
    throw error
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
    logger.debug('Exiting removeFromMongo function', {
      companyId,
      userId,
      identifier,
      mongoModelName,
      schemaName: schema.obj.constructor.name,
      additionalFilterKeys: Object.keys(additionalFilter),
    })
  }
}