# Firestore Exam Reports Nested Structure Refactoring

## Overview

This refactoring changes the Firestore data structure for exam reports from a flat collection to a nested subcollection structure to better organize data by user and certification.

## Changes Made

### Before (Flat Structure)

```
exam_reports/
  ├── exam_abc123/
  ├── exam_def456/
  └── exam_ghi789/
```

### After (Nested Structure)

```
users/
  └── [user_id]/
      └── certs/
          └── [cert_id]/
              └── exam_reports/
                  ├── exam_abc123/
                  ├── exam_def456/
                  └── exam_ghi789/
```

## Benefits

1. **Better Data Organization**: Exam reports are naturally grouped by user and certification
2. **Improved Query Performance**: Can efficiently query reports for a specific user/certification combination
3. **Enhanced Security**: Data is naturally isolated by user, making security rules easier to implement
4. **Scalability**: Reduces the size of individual collections as data grows
5. **Logical Hierarchy**: Reflects the actual relationship between users, certifications, and exams

## Files Modified

### Core Service (`examReportFirestore.ts`)

**Method Signature Changes:**

- `storeExamReport(examId, userId, certId, certificationName, reportData)` - Added `certId` parameter
- `getExamReport(examId, userId, certId)` - Added `userId` and `certId` parameters
- `updateExamReport(examId, userId, certId, reportData)` - Added `userId` and `certId` parameters
- `deleteExamReport(examId, userId, certId)` - Added `userId` and `certId` parameters
- `examReportExists(examId, userId, certId)` - Added `userId` and `certId` parameters
- `getLastExamReportForUser(userId, certId, certificationName?)` - Changed to use `certId` instead of just `certificationName`
- `getUserExamReports(userId, certId, limit?)` - Changed to scope by `certId`

**Internal Changes:**

- Added `buildExamReportsPath(userId, certId)` helper method
- Updated all methods to use the new nested collection path
- Removed the static `COLLECTION_NAME` constant since paths are now dynamic

### API Endpoints

**`examReportGenerator.ts`:**

- Updated to pass `cert_id` from exam data to Firestore service calls
- Both `getExamReport` and `storeExamReport` calls updated

**`getExamReport.ts`:**

- Added exam lookup to retrieve `cert_id` before accessing Firestore
- Updated both GET and POST (regenerate) endpoints
- Added additional security validation by checking exam ownership

**`createExam.ts`:**

- Updated `getLastExamReportForUser` call to use `cert_id` instead of just certification name

### Test Files

**`testFirestoreExamReports.ts`:**

- Added `TEST_CERT_ID` constant
- Updated all test method calls to include required `userId` and `certId` parameters

## Migration Considerations

### Data Migration Required

Existing exam reports in the flat `exam_reports` collection need to be migrated to the new nested structure. This would require:

1. Reading all existing reports from `exam_reports/`
2. For each report, determining the `user_id` and `cert_id` from the exam data
3. Creating the report in the new path: `users/{user_id}/certs/{cert_id}/exam_reports/{exam_id}`
4. Verifying migration success
5. Cleaning up old flat structure (optional)

### Backwards Compatibility

⚠️ **Breaking Change**: This is a breaking change that requires all callers to be updated. The old method signatures will no longer work.

### Security Rules Update

Firestore security rules will need to be updated to reflect the new nested structure:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Exam reports nested under users and certifications
    match /users/{userId}/certs/{certId}/exam_reports/{examId} {
      allow read, write: if request.auth != null
        && request.auth.uid == resource.data.firebase_user_id
        && resource.data.user_id == userId;
    }
  }
}
```

## Deployment Steps

1. **Deploy Code Changes**: Deploy the updated service methods and API endpoints
2. **Update Security Rules**: Apply new Firestore security rules for the nested structure
3. **Run Migration Script**: Create and run a migration script to move existing data
4. **Verify Migration**: Test that all reports are accessible via the new structure
5. **Monitor**: Watch for any issues with the new data access patterns
6. **Cleanup**: Optionally remove old flat structure data after verification

## Testing

All existing tests have been updated but will need to be run to verify:

```bash
npm run test:firestore
```

The test script creates a complete exam report in the new nested structure and verifies all CRUD operations work correctly.

## Impact Assessment

- ✅ **No Breaking Changes to Frontend**: API endpoints maintain the same external interface
- ✅ **Improved Performance**: More efficient queries scoped by user and certification
- ✅ **Better Security**: Natural data isolation by user
- ⚠️ **Migration Required**: Existing data needs to be moved to new structure
- ⚠️ **Security Rules Update**: Firestore rules must be updated to match new paths

## Next Steps

1. Test the changes in a development environment
2. Create a data migration script
3. Update Firestore security rules
4. Plan the production deployment and migration
5. Monitor the system after deployment
