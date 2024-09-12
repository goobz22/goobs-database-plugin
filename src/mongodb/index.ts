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
  AuthEmailAndCompanyIdentifier,
  AuthEmailAndCompanyAndCustomerIdentifier,
  AuthEmailIdentifier,
  IdIdentifier,
} from './types'

import ServerGetHitCountModule from './utils/get/hitCount.server'
import ServerGetLastAccessedDateModule from './utils/get/lastAccessedDate.server'
import ServerSetHitCountModule from './utils/update/hitCount.server'
import ServerLastUpdatedDateModule from './utils/update/lastUpdatedDate.server'

// Importing from connectDb.ts
import ConnectDb, { closeConnections } from './utils/connectDb'

// Exporting all imported items
export { ConnectDb, closeConnections }

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
  AuthEmailAndCompanyIdentifier,
  AuthEmailAndCompanyAndCustomerIdentifier,
  AuthEmailIdentifier,
}

export {
  ServerGetHitCountModule,
  ServerGetLastAccessedDateModule,
  ServerSetHitCountModule,
  ServerLastUpdatedDateModule,
}
