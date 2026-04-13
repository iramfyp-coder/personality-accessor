const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const {
  startAssessmentSession,
  getActiveAssessmentSession,
  syncAssessmentSession,
  saveAssessment,
  getAssessmentsByUser,
  getAssessmentReport,
} = require('../Controllers/assessmentController');

const router = express.Router();

router.use(authMiddleware);
router.use((req, res, next) => {
  res.setHeader('Deprecation', 'true');
  res.setHeader('Sunset', 'Wed, 31 Dec 2026 23:59:59 GMT');
  res.setHeader('Link', '</api/assessment>; rel=\"successor-version\"');
  next();
});

router.post('/session/start', startAssessmentSession);
router.get('/session/:userId', getActiveAssessmentSession);
router.patch('/session/:sessionId', syncAssessmentSession);
router.post('/save', saveAssessment);
router.get('/report/:assessmentId', getAssessmentReport);
router.get('/:userId', getAssessmentsByUser);

module.exports = router;
