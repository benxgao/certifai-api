import { Router as createRouter } from 'express';
// import fetch from 'node-fetch';
import logger from '../../services/firebase/logger';
import { getSecret } from '../../services/gcp/secret-manager';
import prismaInstance from '../../services/prisma';

const router = createRouter();

router.get('/', async (req, res) => {
  const testSecret = await getSecret('TEST');

  // const response = await fetch('https://httpbin.org/ip');
  // const data = await response.json();

  // logger.info(`Healthcheck: HTTPBIN
  //   | status: ${response.status}
  //   | data: ${JSON.stringify(data)}`);

  const newProduct = await prismaInstance.product.create({
    data: {
      name: `Test Product - ${Date.now()}`,
      description: 'Test Product Description',
      price: 10.99,
    },
  });

  const products = await prismaInstance.product.findMany();

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
