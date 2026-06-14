import { Router } from 'express';
import { StatisticsController } from '../controllers/StatisticsController';

const router = Router();

router.get('/', StatisticsController.getStatistics);

export default router;
