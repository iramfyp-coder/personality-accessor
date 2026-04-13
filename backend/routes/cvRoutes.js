const express = require('express');
const multer = require('multer');
const authMiddleware = require('../middleware/authMiddleware');
const { uploadCv } = require('../Controllers/assessmentFlowController');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 6 * 1024 * 1024,
  },
});

router.use(authMiddleware);
router.use((req, res, next) => {
  res.setHeader('Deprecation', 'true');
  res.setHeader('Sunset', 'Wed, 31 Dec 2026 23:59:59 GMT');
  res.setHeader('Link', '</api/assessment/cv/upload>; rel=\"successor-version\"');
  next();
});
router.post('/upload', upload.single('cv'), uploadCv);

module.exports = router;
