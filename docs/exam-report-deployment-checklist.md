# Exam Report Firestore Migration - Deployment Checklist

## Pre-Deployment Checklist

### 1. Code Review

- [ ] All new files have been reviewed
- [ ] TypeScript compilation passes without errors
- [ ] ESLint passes without errors
- [ ] All imports and exports are correct

### 2. Testing

- [ ] Run Firestore service tests: `npm run test:firestore`
- [ ] Test API endpoints locally using Firebase emulator
- [ ] Test frontend integration with new endpoints
- [ ] Verify migration utility works in dry-run mode

### 3. Configuration

- [ ] Firestore security rules are configured for `exam_reports` collection
- [ ] Firebase project has Firestore enabled
- [ ] Service account has proper Firestore permissions
- [ ] Environment variables are set correctly

### 4. Backup

- [ ] Backup existing exam reports from Prisma database
- [ ] Document current exam report count in database
- [ ] Save migration script for rollback if needed

## Deployment Steps

### Phase 1: Deploy New Code (Parallel Operation)

1. **Deploy Backend Changes**

   ```bash
   cd certifai-api
   firebase deploy --only functions
   ```

2. **Deploy Frontend Changes**

   ```bash
   cd certifai-app
   npm run build
   firebase deploy --only hosting
   ```

3. **Verify Deployment**
   - [ ] New API endpoints respond correctly
   - [ ] Exam report generation stores in Firestore
   - [ ] Adaptive learning reads from Firestore
   - [ ] Frontend displays exam reports correctly

### Phase 2: Data Migration

1. **Check Migration Status**

   ```bash
   curl -X GET "{API_BASE_URL}/api/admin/migrate-exam-reports" \
     -H "Authorization: Bearer {ADMIN_TOKEN}"
   ```

2. **Run Dry-Run Migration**

   ```bash
   curl -X POST "{API_BASE_URL}/api/admin/migrate-exam-reports" \
     -H "Authorization: Bearer {ADMIN_TOKEN}" \
     -H "Content-Type: application/json" \
     -d '{"dry_run": true, "batch_size": 10}'
   ```

3. **Run Actual Migration**

   ```bash
   curl -X POST "{API_BASE_URL}/api/admin/migrate-exam-reports" \
     -H "Authorization: Bearer {ADMIN_TOKEN}" \
     -H "Content-Type: application/json" \
     -d '{"dry_run": false, "batch_size": 50}'
   ```

4. **Verify Migration**
   - [ ] Check Firestore console for migrated reports
   - [ ] Verify report count matches Prisma count
   - [ ] Test adaptive learning with migrated data
   - [ ] Spot-check report content accuracy

### Phase 3: Monitoring and Validation

1. **Monitor Performance**

   - [ ] Firestore read/write metrics
   - [ ] API response times
   - [ ] Error rates and logs
   - [ ] User experience with exam reports

2. **Validate Functionality**
   - [ ] Generate new exam reports
   - [ ] View existing exam reports
   - [ ] Adaptive learning with previous reports
   - [ ] Report regeneration works correctly

## Post-Deployment Monitoring

### Key Metrics to Watch

1. **Performance Metrics**

   - Firestore read/write operations per minute
   - Average response time for exam report endpoints
   - Memory usage in Firebase Functions
   - Database connection pool usage (should decrease)

2. **Error Metrics**

   - Failed exam report generations
   - Firestore timeout errors
   - Authentication failures
   - Migration errors

3. **User Experience Metrics**
   - Time to display exam reports
   - Success rate of report generation
   - User engagement with structured report data

### Monitoring Tools

1. **Firebase Console**

   - Functions logs and metrics
   - Firestore usage and performance
   - Error reporting

2. **Application Logs**

   ```bash
   # View exam report related logs
   firebase functions:log --filter "EXAM_REPORT\|FIRESTORE"
   ```

3. **Custom Dashboards**
   - Set up alerts for error rates > 5%
   - Monitor Firestore document count growth
   - Track migration progress

## Rollback Plan

### If Issues Arise

1. **Immediate Rollback (API Level)**

   - Revert to previous Firebase Functions deployment
   - Switch adaptive learning back to Prisma queries
   - Use legacy exam report endpoints temporarily

2. **Data Rollback (If Needed)**

   - Exam reports remain in Prisma database
   - Can disable Firestore operations via feature flag
   - Migration can be reversed with custom script

3. **Complete Rollback**

   ```bash
   # Revert to previous deployment
   firebase deploy --only functions --force

   # Or specific version
   firebase functions:config:set deployment.use_firestore=false
   ```

## Success Criteria

### Technical Success

- [ ] All exam reports generated after deployment are stored in Firestore
- [ ] Adaptive learning uses Firestore data for new exams
- [ ] API response times remain under 2 seconds
- [ ] Zero data loss during migration
- [ ] Error rates remain under 1%

### Business Success

- [ ] Users can view exam reports without issues
- [ ] Adaptive learning continues to improve exam difficulty
- [ ] Report generation time improves or stays the same
- [ ] No user complaints about exam reports

### Infrastructure Success

- [ ] Firestore scales with increased usage
- [ ] PostgreSQL load decreases as expected
- [ ] Firebase Functions remain within resource limits
- [ ] Monitoring and alerting work correctly

## Troubleshooting

### Common Issues

1. **Firestore Permission Errors**

   ```bash
   # Check service account permissions
   gcloud projects get-iam-policy YOUR_PROJECT_ID
   ```

2. **Migration Timeout**

   - Reduce batch size in migration script
   - Run migration during off-peak hours
   - Monitor Firestore quotas

3. **Data Inconsistency**

   - Compare Firestore and Prisma report counts
   - Validate random sample of migrated reports
   - Check for duplicate or missing reports

4. **Performance Issues**
   - Monitor Firestore read/write patterns
   - Optimize queries with proper indexing
   - Consider Firestore regional deployment

### Debug Commands

```bash
# Check Firestore rules
firebase firestore:rules:get

# View function logs
firebase functions:log --limit 100

# Test specific endpoint
curl -X GET "{API_BASE_URL}/api/users/{USER_ID}/exams/{EXAM_ID}/exam-report" \
  -H "Authorization: Bearer {TOKEN}"
```

## Communication Plan

### Internal Team

- [ ] Notify development team of deployment schedule
- [ ] Share monitoring dashboard access
- [ ] Document any configuration changes
- [ ] Schedule post-deployment review meeting

### External Stakeholders

- [ ] Inform customer success of potential user impact
- [ ] Prepare support documentation for any user-facing changes
- [ ] Have rollback communication ready if needed

## Completion

- [ ] All deployment steps completed successfully
- [ ] Migration completed with acceptable success rate
- [ ] Monitoring shows healthy system performance
- [ ] Documentation updated with final deployment notes
- [ ] Rollback plan tested and documented
- [ ] Team notified of successful deployment

---

**Deployment Lead**: ******\_\_\_\_******  
**Date**: ******\_\_\_\_******  
**Deployment Version**: ******\_\_\_\_******  
**Sign-off**: ******\_\_\_\_******
