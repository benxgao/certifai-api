import { Router as createRouter } from 'express';
// import thinWebhook from './thinWebhook';
import { verifyFirebaseToken } from '../../middlewares/authCheck';
import { createCheckoutSession } from './createCheckout';
import { createPortalSession } from './createPortal';
import { stripeSnapshotWebhook } from './snapshotWebhook';

const router = createRouter();

router.post(
  '/create-checkout-session',
  verifyFirebaseToken,
  createCheckoutSession,
);

router.post('/create-portal-session', verifyFirebaseToken, createPortalSession);

router.use('/webhook-snapshot', stripeSnapshotWebhook);

// router.use('/webhook-thin', thinWebhook);

export default router;
