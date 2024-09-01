import { config } from 'dotenv'
import mongoose from 'mongoose'
import { MongoClient, MongoClientOptions, ChangeStream } from 'mongodb'
import { createLogger, format, transports } from 'winston'

config({ path: ['.env.local', '.env'] })

const logger = createLogger({
  level: 'debug',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  defaultMeta: { service: 'db-connection' },
  transports: [
    new transports.Console({
      format: format.combine(format.colorize(), format.simple()),
    }),
    new transports.File({ filename: 'db-connection.log' }),
  ],
})

let mongoClient: MongoClient | null = null
let mongooseConnection: mongoose.Connection | null = null
let changeStream: ChangeStream | null = null

function getMongoURI(): string {
  const MONGO_URI = process.env.MONGODB_URI || ''
  if (!MONGO_URI) {
    throw new Error('Please define the MONGODB_URI environment variable.')
  }
  return MONGO_URI
}

async function connectMongoDB(): Promise<MongoClient> {
  if (mongoClient) {
    return mongoClient
  }
  const uri = getMongoURI()
  const options: MongoClientOptions = {
    maxPoolSize: 10,
    minPoolSize: 5,
    maxIdleTimeMS: 30000,
    connectTimeoutMS: 5000,
  }
  try {
    mongoClient = new MongoClient(uri, options)
    await mongoClient.connect()
    logger.info('MongoDB client connected')
    return mongoClient
  } catch (error) {
    logger.error('Error connecting to MongoDB:', error)
    mongoClient = null
    throw error
  }
}

async function connectMongoose(): Promise<mongoose.Connection> {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection
  }
  const uri = getMongoURI()
  try {
    await mongoose.connect(uri, {
      bufferCommands: false,
      autoCreate: true,
    })
    mongooseConnection = mongoose.connection
    logger.info('Mongoose connected')
    return mongooseConnection
  } catch (error) {
    logger.error('Error connecting with Mongoose:', error)
    mongooseConnection = null
    throw error
  }
}

async function setupChangeStream(
  collectionName: string,
  pipeline: object[] = []
): Promise<ChangeStream> {
  if (!mongoClient) {
    await connectMongoDB()
  }
  if (!mongoClient) {
    throw new Error('Failed to connect to MongoDB')
  }
  const db = mongoClient.db()
  const collection = db.collection(collectionName)
  changeStream = collection.watch(pipeline)
  changeStream.on('change', change => {
    logger.info(`Change detected in collection ${collectionName}:`, change)
  })
  changeStream.on('error', error => {
    logger.error(
      `Error in change stream for collection ${collectionName}:`,
      error
    )
  })
  logger.info(`Change stream set up for collection ${collectionName}`)
  return changeStream
}

export default async function ConnectDb(
  operation: 'get' | 'update' | 'watch'
): Promise<MongoClient | mongoose.Connection | ChangeStream> {
  switch (operation) {
    case 'get':
      return await connectMongoDB()
    case 'update':
      return await connectMongoose()
    case 'watch':
      if (!changeStream) {
        throw new Error(
          'Change stream not set up. Use setupChangeStream first.'
        )
      }
      return changeStream
    default:
      throw new Error('Invalid operation. Use "get", "update", or "watch".')
  }
}

export async function closeConnections(): Promise<void> {
  if (mongoClient) {
    await mongoClient.close()
    mongoClient = null
    logger.info('MongoDB client connection closed')
  }
  if (mongooseConnection) {
    await mongoose.disconnect()
    mongooseConnection = null
    logger.info('Mongoose connection closed')
  }
  if (changeStream) {
    await changeStream.close()
    changeStream = null
    logger.info('Change stream closed')
  }
}

export { setupChangeStream }
