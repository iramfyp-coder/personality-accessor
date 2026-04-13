const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { generateAssessmentAiReport } = require('../Controllers/aiController');

const router = express.Router();

router.use(authMiddleware);
router.use((req, res, next) => {
  res.setHeader('Deprecation', 'true');
  res.setHeader('Sunset', 'Wed, 31 Dec 2026 23:59:59 GMT');
  res.setHeader('Link', '</api/assessment/report>; rel=\"successor-version\"');
  next();
});

router.post('/report/:assessmentId', generateAssessmentAiReport);

module.exports = router;
