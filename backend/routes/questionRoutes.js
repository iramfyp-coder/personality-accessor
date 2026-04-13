const express = require('express');
const Question = require('../models/Question');
const { sendSuccess } = require('../utils/response');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const questions = await Question.find().sort({ _id: 1 });

    return sendSuccess(res, {
      data: { questions },
      message: 'Questions fetched successfully',
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
