// Importing from get.ts
import { getFromMongo } from './get'

// Importing from remove.ts
import { removeFromMongo } from './remove'

// Importing from update.ts
import { updateItemInMongo } from './update'

// Importing from types.ts
import type {
  ChangeStreamOperationType,
  Identifier,
  CompanyAndIdandAdditionalIdentifier,
  CompanyAndCustomerAndIdIdentifier,
  CompanyAndCustomerAndIdandAdditionalIdentifier,
  CompanyAndCustomerIdentifier,
  CompanyIdentifier,
  CompanyAndIdIdentifier,
  IdIdentifier,
} from './types'

import ServerGetHitCountModule from './utils/get/hitCount.server'
import ServerGetLastAccessedDateModule from './utils/get/lastAccessedDate.server'
import ServerSetHitCountModule from './utils/update/hitCount.server'
import ServerLastUpdatedDateModule from './utils/update/lastUpdatedDate.server'

// Exporting all imported items
export { getFromMongo, removeFromMongo, updateItemInMongo }

// Exporting types
export type {
  ChangeStreamOperationType,
  Identifier,
  CompanyAndIdandAdditionalIdentifier,
  CompanyAndCustomerAndIdIdentifier,
  CompanyAndCustomerAndIdandAdditionalIdentifier,
  CompanyAndCustomerIdentifier,
  CompanyIdentifier,
  CompanyAndIdIdentifier,
  IdIdentifier,
}

export {
  ServerGetHitCountModule,
  ServerGetLastAccessedDateModule,
  ServerSetHitCountModule,
  ServerLastUpdatedDateModule,
}
