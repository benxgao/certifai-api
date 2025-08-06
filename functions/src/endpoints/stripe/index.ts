import express, { Router as createRouter } from 'express';
// import thinWebhook from './thinWebhook';
import { verifyFirebaseToken } from '../../middlewares/authCheck';
import { createCheckoutSession } from './createCheckout';
import { createPortalSession } from './createPortal';
import { stripeSnapshotWebhook } from './snapshotWebhook';
import {
  cancelSubscription,
  getPricingPlans,
  getSubscriptionStatus,
  getSubscriptionHistory,
  reactivateSubscription,
  resumeSubscription,
  updateSubscriptionPlan,
} from './subscriptions';

const router = createRouter();

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
