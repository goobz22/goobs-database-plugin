import mongoose, { Document, Schema, SchemaDefinitionProperty } from 'mongoose'

export interface BaseDocument extends Document {
  updatedAt: Date
  lastAccessed: Date
  getHitCount: number
  setHitCount: number
}

export interface BaseSerializableData {
  _id: string
  updatedAt: string
  lastAccessed: string
  getHitCount: number
  setHitCount: number
}

export interface WithCompanyAndUser {
  company: mongoose.Types.ObjectId
  user: mongoose.Types.ObjectId
}

export type GenericDocument<T> = T & BaseDocument & WithCompanyAndUser

export type GenericSerializableData<T> = T &
  BaseSerializableData & {
    company: string
    user: string
  }

export function createGenericSchema<T>(
  schemaFields: Record<keyof T, SchemaDefinitionProperty>
): Schema<GenericDocument<T>> {
  return new Schema<GenericDocument<T>>({
    ...schemaFields,
    company: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedAt: { type: Date, default: Date.now },
    lastAccessed: { type: Date, default: Date.now },
    getHitCount: { type: Number, default: 0 },
    setHitCount: { type: Number, default: 0 },
  })
}

export function serializeDocument<T, S extends BaseSerializableData>(
  doc: GenericDocument<T>
): GenericSerializableData<S> {
  const obj = doc.toObject()
  return {
    ...obj,
    _id: obj._id.toString(),
    company: obj.company.toString(),
    user: obj.user.toString(),
    updatedAt: obj.updatedAt.toISOString(),
    lastAccessed: obj.lastAccessed.toISOString(),
  } as GenericSerializableData<S>
}
