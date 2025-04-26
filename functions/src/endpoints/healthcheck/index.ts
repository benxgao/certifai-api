import { Router as createRouter } from 'express';

import logger from '../../services/firebase/logger';
import { getSecret } from '../../services/gcp/secret-manager';
import prisma from '../../services/prisma';

const router = createRouter();

router.get('/', async (req, res) => {
  const testSecret = await getSecret('TEST');

  const newProduct = await prisma.product.create({
    data: {
      name: `Test Product - ${Date.now()}`,
      description: 'Test Product Description',
      price: 10.99,
    },
  });

  const products = await prisma.product.findMany();

  logger.info(`Healthcheck: PRISMA
    | newProduct: ${JSON.stringify(newProduct)}
    | products: ${JSON.stringify(products)}`);

  logger.info(`Healthcheck endpoint hit
    | secret_manager: ${JSON.stringify(testSecret)}
    | env_file: ${process.env.TEST_ENV}
    | env: ${process.env.GCP_PROJECT_NUMBER}`);

  res.send('Hello World!');
});

export default router;
