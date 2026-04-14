const express = require('express');
const multer = require('multer');
const authMiddleware = require('../middleware/authMiddleware');
const {
  uploadCv,
  startAdaptiveAssessment,
  getCurrentQuestion,
  getPreviousQuestion,
  answerAdaptiveQuestion,
  getAssessmentResult,
  downloadAssessmentResultPdf,
  getActiveFlowSession,
  getFlowSessionById,
  streamAssessmentProgress,
  careerChat,
  explainWhyNotCareerForSession,
} = require('../Controllers/assessmentFlowController');
const {
  startAssessmentSession,
  getActiveAssessmentSession,
  syncAssessmentSession,
  saveAssessment,
  getAssessmentsByUser,
  getAssessmentReport,
  getDashboardSnapshot,
} = require('../Controllers/assessmentController');
const { generateAssessmentAiReport } = require('../Controllers/aiController');
const {
  getAnalyticsTrends,
  getAssessmentComparison,
} = require('../Controllers/analyticsController');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 6 * 1024 * 1024,
  },
});

router.use(authMiddleware);

router.post('/cv/upload', upload.single('cv'), uploadCv);
router.post('/legacy/session/start', startAssessmentSession);
router.get('/legacy/session/:userId', getActiveAssessmentSession);
router.patch('/legacy/session/:sessionId', syncAssessmentSession);
router.post('/legacy/save', saveAssessment);

router.get('/history/:userId', getAssessmentsByUser);
router.get('/report/:assessmentId', getAssessmentReport);
router.post('/report/:assessmentId/ai', generateAssessmentAiReport);
router.get('/dashboard/:userId', getDashboardSnapshot);
router.get('/analytics/trends/:userId', getAnalyticsTrends);
router.get('/analytics/compare', getAssessmentComparison);

router.get('/session/active', getActiveFlowSession);
router.get('/:id/events', streamAssessmentProgress);
router.get('/:id', getFlowSessionById);
router.post('/start', startAdaptiveAssessment);
router.get('/:id/question', getCurrentQuestion);
router.post('/:id/question/previous', getPreviousQuestion);
router.post('/:id/answer', answerAdaptiveQuestion);
router.get('/:id/result', getAssessmentResult);
router.get('/:id/result/pdf', downloadAssessmentResultPdf);
router.post('/:id/chat', careerChat);
router.post('/:id/why-not', explainWhyNotCareerForSession);

module.exports = router;
