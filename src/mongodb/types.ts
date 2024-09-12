import { ObjectId } from 'mongodb'

// Change stream types
export type ChangeStreamOperationType = 'update' | 'get' | 'remove'

export type CompanyIdentifier = {
  companyId: ObjectId
}

export type CompanyAndCustomerIdentifier = {
  companyId: ObjectId
  customerId: ObjectId
}

export type CompanyAndIdIdentifier = {
  companyId: ObjectId
  id: ObjectId
}

export type CompanyAndCustomerAndIdIdentifier = {
  companyId: ObjectId
  customerId: ObjectId
  id: ObjectId
}

export type CompanyAndCustomerAndIdandAdditionalIdentifier = {
  companyId: ObjectId
  customerId: ObjectId
  id: ObjectId
  additionalIdentifier: string
}

export type CompanyAndIdandAdditionalIdentifier = {
  companyId: ObjectId
  id: ObjectId
  additionalIdentifier: string
}

export type IdIdentifier = {
  id: ObjectId
}

export type Identifier =
  | CompanyIdentifier
  | CompanyAndCustomerIdentifier
  | CompanyAndIdIdentifier
  | CompanyAndCustomerAndIdIdentifier
  | CompanyAndCustomerAndIdandAdditionalIdentifier
  | CompanyAndIdandAdditionalIdentifier
  | IdIdentifier
