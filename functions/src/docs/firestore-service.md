# Firestore CRUD Service

A comprehensive Firestore service providing CRUD operations with logging, error handling, and following certifai development patterns.

## Features

- ✅ Complete CRUD operations (Create, Read, Update, Delete)
- ✅ Batch operations for multiple documents
- ✅ Transaction support for atomic operations
- ✅ Query filtering and pagination
- ✅ Document existence checking
- ✅ Automatic timestamps (createdAt, updatedAt)
- ✅ Structured logging with Firebase Functions logger
- ✅ TypeScript support with generic types
- ✅ Error handling and validation

## Basic Usage

```typescript
import { firestoreService, COLLECTIONS } from '../services/firebase/firestore';

// Create a document
const docRef = await firestoreService.create(COLLECTIONS.USERS, {
  name: 'John Doe',
  email: 'john@example.com',
  role: 'student',
});

// Read a document
const user = await firestoreService.read<User>(COLLECTIONS.USERS, docRef.id);

// Update a document
await firestoreService.update(COLLECTIONS.USERS, docRef.id, {
  name: 'John Smith',
});

// Delete a document
await firestoreService.delete(COLLECTIONS.USERS, docRef.id);
```

## Advanced Features

### Querying with Filters

```typescript
// Get active certifications sorted by title
const activeCerts = await firestoreService.list(COLLECTIONS.CERTIFICATIONS, {
  where: [{ field: 'isActive', operator: '==', value: true }],
  orderBy: [{ field: 'title', direction: 'asc' }],
  limit: 20,
});
```

### Batch Operations

```typescript
// Batch create multiple documents
await firestoreService.batch([
  {
    type: 'create',
    collectionPath: COLLECTIONS.USERS,
    docId: 'user1',
    data: { name: 'User 1', email: 'user1@example.com' },
  },
  {
    type: 'update',
    collectionPath: COLLECTIONS.USERS,
    docId: 'user2',
    data: { name: 'Updated Name' },
  },
]);
```

### Transactions

```typescript
// Atomic operations
const result = await firestoreService.runTransaction(async (transaction) => {
  const docRef = firestoreService.getDocument(COLLECTIONS.USERS, 'userId');
  const doc = await transaction.get(docRef);

  if (!doc.exists) {
    throw new Error('Document does not exist');
  }

  transaction.update(docRef, { lastLogin: new Date() });
  return { success: true };
});
```

## Collections

Pre-defined collection paths are available in the `COLLECTIONS` constant:

```typescript
export const COLLECTIONS = {
  USERS: 'users',
  CERTIFICATIONS: 'certifications',
  EXAMS: 'exams',
  EXAM_RESULTS: 'examResults',
  QUESTIONS: 'questions',
} as const;
```

## API Reference

### Methods

#### `create<T>(collectionPath: string, data: T, docId?: string): Promise<DocumentReference>`

Creates a new document with automatic timestamps.

#### `read<T>(collectionPath: string, docId: string): Promise<T | null>`

Reads a single document by ID.

#### `update<T>(collectionPath: string, docId: string, data: Partial<T>): Promise<void>`

Updates a document with automatic updatedAt timestamp.

#### `delete(collectionPath: string, docId: string): Promise<void>`

Deletes a document.

#### `list<T>(collectionPath: string, options?: QueryOptions): Promise<T[]>`

Lists documents with optional filtering and pagination.

#### `count(collectionPath: string, where?: WhereCondition[]): Promise<number>`

Counts documents with optional filtering.

#### `exists(collectionPath: string, docId: string): Promise<boolean>`

Checks if a document exists.

#### `batch(operations: BatchOperation[]): Promise<void>`

Executes multiple operations atomically.

#### `runTransaction<T>(updateFunction: TransactionFunction<T>): Promise<T>`

Runs operations in a transaction.

## Error Handling

All methods include proper error handling and logging. Errors are logged with context and re-thrown for upstream handling:

```typescript
try {
  await firestoreService.create(COLLECTIONS.USERS, userData);
} catch (error) {
  // Error is already logged by the service
  // Handle the error appropriately
  console.error('Failed to create user:', error);
}
```

## Examples

See `src/examples/firestore-usage.ts` for comprehensive examples including:

- User management service
- Certification management service
- Batch operations
- Transaction examples

## Integration with certifai

This service follows certifai patterns:

- Uses Firebase Functions logger for structured logging
- Includes automatic timestamp management
- Supports TypeScript with proper generic types
- Follows error handling conventions
- Uses singleton pattern for service instance
