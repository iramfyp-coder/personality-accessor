import client from './client';

const unwrap = (response) => response?.data?.data || {};

export const getTraitTrends = async (userId) => {
  const response = await client.get(`/assessment/analytics/trends/${userId}`);
  return unwrap(response).trends || [];
};

export const compareAssessments = async ({ assessmentAId, assessmentBId }) => {
  const response = await client.get('/assessment/analytics/compare', {
    params: {
      a: assessmentAId,
      b: assessmentBId,
    },
  });

  return unwrap(response);
};
