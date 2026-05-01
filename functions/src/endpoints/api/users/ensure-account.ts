import logger from '../../../services/firebase/logger';
import { FirebaseJwtToken } from '../../../types';
import { AuthenticatedRequestHandler } from '../../../types/express';
import { StripeFirestoreService } from '../../stripe/db';
import { StripeService } from '../../stripe/service';
import { firebaseAuth } from '../../../services/firebase/admin';

const handler: AuthenticatedRequestHandler<
  { api_user_id?: string; email?: string },
  unknown
> = async (req, res) => {
  try {
    const firebaseUser: FirebaseJwtToken | undefined = req.firebase_user_info;

    if (!firebaseUser) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized: Missing Firebase JWT token',
      });
      return;
    }

    // Extract Firebase user ID
    const firebaseUserId =
      firebaseUser.user_id || firebaseUser.uid || firebaseUser.sub;

    if (!firebaseUserId) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized: Firebase user ID could not be determined',
      });
      return;
    }

    // Get request body (optional, we can extract from token if not provided)
    let { api_user_id, email } = req.body || {};

    // If not provided in body, try to extract from Firebase token
    if (!api_user_id || !email) {
      try {
        // Get user data from Firebase Auth
        const userRecord = await firebaseAuth.getUser(firebaseUserId);

        // Extract api_user_id from custom claims if not provided
        if (!api_user_id && userRecord.customClaims?.api_user_id) {
          api_user_id = userRecord.customClaims.api_user_id;
        }

        // Extract email from Firebase user record if not provided
        if (!email && userRecord.email) {
          email = userRecord.email;
        }
      } catch (firebaseError) {
        logger.error('Failed to fetch Firebase user data for ensure-account', {
          error: firebaseError,
          firebase_user_id: firebaseUserId,
        });
      }
    }

    if (!api_user_id) {
      res.status(400).json({
        success: false,
        error:
          'API user ID is required and could not be determined from Firebase token',
      });
      return;
    }

    if (!email) {
      res.status(400).json({
        success: false,
        error:
          'Email is required and could not be determined from Firebase token',
      });
      return;
    }

    let accountCreated = false;
    let stripeCustomerId: string | undefined;
    let latestSubscriptionObject: any = null; // Store subscription object for timestamps
    let stripeSubscriptionData: {
      subscription_id?: string;
      subscription_status?: string;
      current_period_end?: number;
      cancel_at_period_end?: boolean;
    } = {};

    try {
      // Check if Firestore account already exists
      const firestoreAccount =
        await StripeFirestoreService.getAccountByFirebaseUid(firebaseUserId);

      if (!firestoreAccount) {
        // Create or get Stripe customer first
        try {
          // Get user display name from Firebase if available
          const userRecord = await firebaseAuth.getUser(firebaseUserId);
          const displayName = userRecord.displayName || undefined;

          // Create or get Stripe customer
          const stripeCustomer = await StripeService.createOrGetCustomer(
            email,
            firebaseUserId,
            api_user_id,
            displayName,
          );

          stripeCustomerId = stripeCustomer.id;

          // Try to get the latest subscription for this customer
          try {
            const latestSubscription =
              await StripeService.getLatestActiveSubscription(stripeCustomerId);

            if (latestSubscription) {
              latestSubscriptionObject = latestSubscription; // Store for timestamp use
              stripeSubscriptionData = {
                subscription_id: latestSubscription.id,
                subscription_status: latestSubscription.status,
                current_period_end: (latestSubscription as any)
                  .current_period_end,
                cancel_at_period_end: latestSubscription.cancel_at_period_end,
              };

              logger.info(
                'STRIPE_SUBSCRIPTION_DATA_RETRIEVED_VIA_ENSURE_ENDPOINT',
                {
                  api_user_id: api_user_id,
                  firebase_user_id: firebaseUserId,
                  stripe_customer_id: stripeCustomerId,
                  stripe_subscription_id: latestSubscription.id,
                  subscription_status: latestSubscription.status,
                },
              );
            }
          } catch (subscriptionError) {
            // Log the error but don't fail the account creation process
            logger.warn(
              'STRIPE_SUBSCRIPTION_FETCH_WARNING_VIA_ENSURE_ENDPOINT',
              {
                api_user_id: api_user_id,
                firebase_user_id: firebaseUserId,
                stripe_customer_id: stripeCustomerId,
                error:
                  subscriptionError instanceof Error
                    ? subscriptionError.message
                    : 'Unknown error',
                action: 'continuing_account_creation_without_subscription_data',
              },
            );
          }

          logger.info(
            'STRIPE_CUSTOMER_CREATED_OR_RETRIEVED_VIA_ENSURE_ENDPOINT',
            {
              api_user_id: api_user_id,
              firebase_user_id: firebaseUserId,
              email: email,
              stripe_customer_id: stripeCustomerId,
              subscription_data_included:
                !!stripeSubscriptionData.subscription_id,
            },
          );
        } catch (stripeError) {
          // Log the error but don't fail the account creation process
          logger.warn('STRIPE_CUSTOMER_CREATION_WARNING_VIA_ENSURE_ENDPOINT', {
            api_user_id: api_user_id,
            firebase_user_id: firebaseUserId,
            email: email,
            error:
              stripeError instanceof Error
                ? stripeError.message
                : 'Unknown error',
            action: 'continuing_account_creation_without_stripe_data',
          });
        }

        // Create default Firestore account record with all available Stripe data
        // Use Stripe subscription timestamps if available, otherwise current time
        let accountCreatedAt = new Date().toISOString();
        let accountUpdatedAt = new Date().toISOString();

        // If we have a subscription, try to use its timestamps
        if (latestSubscriptionObject) {
          accountCreatedAt = new Date(
            latestSubscriptionObject.created * 1000,
          ).toISOString();
          accountUpdatedAt = new Date().toISOString(); // Use current time for account creation
        }

        const defaultAccountData = {
          api_user_id: api_user_id,
          firebase_user_id: firebaseUserId,
          email: email,
          stripe_customer_id: stripeCustomerId,
          stripe_subscription_id: stripeSubscriptionData.subscription_id,
          stripe_subscription_status:
            stripeSubscriptionData.subscription_status,
          stripe_current_period_end: stripeSubscriptionData.current_period_end,
          stripe_cancel_at_period_end:
            stripeSubscriptionData.cancel_at_period_end,
          created_at: accountCreatedAt,
          updated_at: accountUpdatedAt,
        };

        await StripeFirestoreService.createAccount(defaultAccountData);
        accountCreated = true;

        logger.info('FIRESTORE_ACCOUNT_CREATED_VIA_ENSURE_ENDPOINT', {
          api_user_id: api_user_id,
          firebase_user_id: firebaseUserId,
          email: email,
          stripe_customer_id: stripeCustomerId,
          stripe_subscription_id: stripeSubscriptionData.subscription_id,
          stripe_data_populated: !!stripeCustomerId,
          subscription_data_populated: !!stripeSubscriptionData.subscription_id,
          account_fields_populated: {
            customer: !!stripeCustomerId,
            subscription: !!stripeSubscriptionData.subscription_id,
            subscription_status: !!stripeSubscriptionData.subscription_status,
            current_period_end: !!stripeSubscriptionData.current_period_end,
            cancel_at_period_end:
              stripeSubscriptionData.cancel_at_period_end !== undefined,
          },
        });
      } else {
        // Update the existing account's updated_at timestamp
        await StripeFirestoreService.updateAccount(api_user_id, {
          updated_at: new Date().toISOString(),
        });

        logger.info('FIRESTORE_ACCOUNT_UPDATED_VIA_ENSURE_ENDPOINT', {
          api_user_id: api_user_id,
          firebase_user_id: firebaseUserId,
        });
      }
    } catch (firestoreError) {
      logger.error('FIRESTORE_ACCOUNT_ENSURE_ERROR', {
        error: firestoreError,
        api_user_id: api_user_id,
        firebase_user_id: firebaseUserId,
        error_details:
          firestoreError instanceof Error
            ? firestoreError.message
            : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        error: 'Failed to ensure Firestore account',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: accountCreated
        ? 'Firestore account created successfully'
        : 'Firestore account already exists',
      account_created: accountCreated,
      api_user_id: api_user_id,
      firebase_user_id: firebaseUserId,
      stripe_data_populated: accountCreated ? !!stripeCustomerId : undefined,
      account_data_completeness: accountCreated
        ? {
            stripe_customer_id: !!stripeCustomerId,
            stripe_subscription_id: !!stripeSubscriptionData?.subscription_id,
            stripe_subscription_status:
              !!stripeSubscriptionData?.subscription_status,
            stripe_current_period_end:
              !!stripeSubscriptionData?.current_period_end,
            stripe_cancel_at_period_end:
              stripeSubscriptionData?.cancel_at_period_end !== undefined,
          }
        : undefined,
    });
  } catch (error) {
    logger.error('Error in firestore ensure-account endpoint:', { error: error instanceof Error ? error.message : String(error) });

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
};

export default handler;
