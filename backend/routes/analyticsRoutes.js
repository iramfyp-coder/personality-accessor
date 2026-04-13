const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const {
  getAnalyticsTrends,
  getAssessmentComparison,
} = require('../Controllers/analyticsController');

const router = express.Router();

router.use(authMiddleware);
router.use((req, res, next) => {
  res.setHeader('Deprecation', 'true');
  res.setHeader('Sunset', 'Wed, 31 Dec 2026 23:59:59 GMT');
  res.setHeader('Link', '</api/assessment/analytics>; rel=\"successor-version\"');
  next();
});

router.get('/trends/:userId', getAnalyticsTrends);
router.get('/compare', getAssessmentComparison);

module.exports = router;
