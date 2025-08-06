import express, { Router as createRouter } from 'express';
// import thinWebhook from './thinWebhook';
import { verifyFirebaseToken } from '../../middlewares/authCheck';
import { createCheckoutSession } from './createCheckout';
import { createPortalSession } from './createPortal';
import { stripeSnapshotWebhook } from './snapshotWebhooks';
import {
  cancelSubscription,
  getPricingPlans,
  getSubscriptionStatus,
  getSubscriptionHistory,
  reactivateSubscription,
  resumeSubscription,
  updateSubscriptionPlan,
} from './subscriptions';
import { getAccountData, getAccountDataByApiUserId } from './accounts';

const router = createRouter();

// Unified account data endpoints (New)
router.get('/account', verifyFirebaseToken, getAccountData);
router.get(
  '/account/:api_user_id',
  verifyFirebaseToken,
  getAccountDataByApiUserId,
);

// Checkout and portal sessions
router.post(
  '/checkout/create-session',
  verifyFirebaseToken,
  createCheckoutSession,
);
router.post('/portal/create-session', verifyFirebaseToken, createPortalSession);

// Subscription management
router.get('/subscription/status', verifyFirebaseToken, getSubscriptionStatus);
router.get(
  '/subscription/history',
  verifyFirebaseToken,
  getSubscriptionHistory,
);
router.post('/subscription/cancel', verifyFirebaseToken, cancelSubscription);
router.post('/subscription/resume', verifyFirebaseToken, resumeSubscription);
router.post(
  '/subscription/reactivate',
  verifyFirebaseToken,
  reactivateSubscription,
);
router.post(
  '/subscription/update-plan',
  verifyFirebaseToken,
  updateSubscriptionPlan,
);

// Public endpoints
router.get('/pricing-plans', getPricingPlans);

router.post(
  '/webhook-snapshot',
  express.raw({ type: 'application/json' }),
  stripeSnapshotWebhook,
);
// router.use('/webhook-thin', thinWebhook);

export default router;
