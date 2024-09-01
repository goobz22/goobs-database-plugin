// Change stream types
export type ChangeStreamOperationType = 'update' | 'get' | 'remove'

export type CompanyIdentifier = {
  companyId: string
}

export type CompanyAndCustomerIdentifier = {
  companyId: string
  customerId: string
}

export type CompanyAndIdIdentifier = {
  companyId: string
  id: string
}

export type CompanyAndCustomerAndIdIdentifier = {
  companyId: string
  customerId: string
  id: string
}

export type Identifier =
  | CompanyIdentifier
  | CompanyAndCustomerIdentifier
  | CompanyAndIdIdentifier
  | CompanyAndCustomerAndIdIdentifier
