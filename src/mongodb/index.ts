// Importing from get.ts
import { getFromMongo } from './get'

// Importing from remove.ts
import { removeFromMongo } from './remove'

// Importing from update.ts
import { updateItemInMongo } from './update'

// Importing from types.ts
import type {
  BaseDocument,
  BaseSerializableData,
  WithCompanyAndUser,
  GenericDocument,
  GenericSerializableData,
} from './types'

import { createGenericSchema, serializeDocument } from './types'

// Exporting all imported items
export { getFromMongo, removeFromMongo, updateItemInMongo }

// Exporting types
export type {
  BaseDocument,
  BaseSerializableData,
  WithCompanyAndUser,
  GenericDocument,
  GenericSerializableData,
}

// Exporting functions
export { createGenericSchema, serializeDocument }
