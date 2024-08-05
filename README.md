# goobs-database-plugin

A flexible and extensible multi-database plugin for managing generic document operations with TypeScript support. Currently featuring MongoDB integration, with plans to support additional databases in the future.

## Installation

To install the plugin, run:

```bash
npm install goobs-database-plugin
```

or

```bash
yarn add goobs-database-plugin
```

## Configuration

1. Create a `.env` file in your project root with the following content:

```
MONGODB_URI=your_mongodb_connection_string_here
```

2. Make sure to include the `.env` file in your `.gitignore` to keep your credentials secure.

## Usage (MongoDB)

First, import the necessary functions and types from the plugin:

```typescript
import {
  getFromMongo,
  removeFromMongo,
  updateItemInMongo,
  createGenericSchema,
  GenericDocument,
  GenericSerializableData,
} from 'goobs-database-plugin'
```

### Defining a Schema

Create a schema for your document using `createGenericSchema`:

```typescript
import { Schema } from 'mongoose'

interface MyDocument {
  name: string
  age: number
}

const mySchema = createGenericSchema<MyDocument>({
  name: { type: String, required: true },
  age: { type: Number, required: true },
})
```

### Retrieving Data

Use `getFromMongo` to retrieve data:

```typescript
async function fetchData(companyId: string, userId: string) {
  const result = await getFromMongo<
    MyDocument,
    GenericSerializableData<MyDocument>
  >(companyId, userId, 'MyModel', {
    filter: { age: { $gte: 18 } },
    // Optional: provide cached data and a function to get updatedAt
    cachedData: previouslyFetchedData,
    getUpdatedAt: item => new Date(item.updatedAt),
  })

  console.log(result.data)
  console.log('Is data stale?', result.isStale)
}
```

### Updating Data

Use `updateItemInMongo` to update or insert data:

```typescript
async function updateData(
  companyId: string,
  userId: string,
  itemData: Partial<MyDocument> & { _id?: string }
) {
  const updatedItem = await updateItemInMongo<
    MyDocument,
    GenericSerializableData<MyDocument>
  >(companyId, userId, 'MyModel', mySchema, itemData, data => {
    // Validate required fields
    if (!data.name || !data.age) {
      throw new Error('Name and age are required')
    }
  })

  console.log('Updated item:', updatedItem)
}
```

### Removing Data

Use `removeFromMongo` to delete data:

```typescript
async function removeData(companyId: string, userId: string, itemId: string) {
  const isRemoved = await removeFromMongo<MyDocument>(
    companyId,
    userId,
    itemId,
    'MyModel',
    mySchema
  )

  console.log('Item removed:', isRemoved)
}
```

## API Reference (MongoDB)

### `getFromMongo<T, S>`

Retrieves data from MongoDB.

- `companyId`: string
- `userId`: string
- `mongoModelName`: string
- `options`:
  - `itemId?`: string
  - `filter?`: Record<string, unknown>
  - `cachedData?`: GenericSerializableData<S>[]
  - `getUpdatedAt?`: (item: GenericSerializableData<S>) => Date

Returns: `Promise<{ data: GenericSerializableData<S>[] | GenericSerializableData<S> | null, isStale: boolean }>`

### `updateItemInMongo<T, S>`

Updates or inserts a document in MongoDB.

- `companyId`: string
- `userId`: string
- `mongoModelName`: string
- `schema`: Schema
- `itemData`: Partial<T> & { \_id?: string }
- `validateFields`: (data: Partial<T>) => void

Returns: `Promise<GenericSerializableData<S>>`

### `removeFromMongo<T>`

Removes a document from MongoDB.

- `companyId`: string
- `userId`: string
- `identifier`: string
- `mongoModelName`: string
- `schema`: Schema<GenericDocument<T>>
- `additionalFilter?`: Record<string, unknown>

Returns: `Promise<boolean>`

### `createGenericSchema<T>`

Creates a Mongoose schema with additional fields for company, user, and metadata.

- `schemaFields`: Record<keyof T, SchemaDefinitionProperty>

Returns: `Schema<GenericDocument<T>>`

## Types

- `BaseDocument`: Extends Mongoose's `Document` with additional fields.
- `BaseSerializableData`: Serializable version of `BaseDocument`.
- `WithCompanyAndUser`: Interface for documents with company and user fields.
- `GenericDocument<T>`: Combines a custom type `T` with `BaseDocument` and `WithCompanyAndUser`.
- `GenericSerializableData<T>`: Serializable version of `GenericDocument<T>`.

## Error Handling

The plugin uses Winston for logging. Check the log files (`generic-get.log`, `generic-update.log`, `generic-remove.log`, `db-connection.log`) for detailed error information.

## Future Database Support

While this plugin currently supports MongoDB, it is designed with extensibility in mind. Future versions will include support for additional databases, allowing for seamless integration with various database systems.

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct, and the process for submitting pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.
