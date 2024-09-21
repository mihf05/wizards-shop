import { Router } from "express";
import bodyParser from "body-parser";
import customRoutes from "./store/custom/route";

export default (container) => {
  const router = Router();

  // Add body-parser middleware
  router.use(bodyParser.json());
  router.use(bodyParser.urlencoded({ extended: true }));

  // Register custom routes
  router.use("/", customRoutes);

  // Log all incoming requests
  router.use((req, res, next) => {
    console.log(`Incoming request: ${req.method} ${req.path}`);
    next();
  });

  // Error handling middleware
  router.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  });

  return router;
};
