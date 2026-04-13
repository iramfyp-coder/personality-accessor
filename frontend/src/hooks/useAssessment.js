import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getActiveSession,
  getAssessmentReport,
  getAssessmentsByUser,
  generateAiReport,
  getQuestions,
  saveAssessment,
  startSession,
  syncSessionProgress,
} from '../api/assessmentApi';
import { compareAssessments, getTraitTrends } from '../api/analyticsApi';

export const assessmentQueryKeys = {
  all: ['assessments'],
  questions: ['assessments', 'questions'],
  history: (userId) => ['assessments', 'history', userId],
  report: (assessmentId) => ['assessments', 'report', assessmentId],
  aiReport: (assessmentId) => ['ai', 'report', assessmentId],
  activeSession: (userId) => ['assessments', 'active-session', userId],
  traitTrends: (userId) => ['analytics', 'trait-trends', userId],
  comparison: (assessmentAId, assessmentBId) => [
    'analytics',
    'comparison',
    assessmentAId,
    assessmentBId,
  ],
};

export const toAnswerPayload = (answers = {}) =>
  Object.entries(answers).map(([questionId, value]) => ({
    questionId,
    value,
  }));

export const toAnswerMap = (answers = []) =>
  (Array.isArray(answers) ? answers : []).reduce((accumulator, answer) => {
    if (!answer?.questionId) {
      return accumulator;
    }

    accumulator[String(answer.questionId)] = Number(answer.value);
    return accumulator;
  }, {});

export const useQuestionsQuery = () =>
  useQuery({
    queryKey: assessmentQueryKeys.questions,
    queryFn: getQuestions,
    staleTime: 5 * 60 * 1000,
  });

export const useStartSessionMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: startSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: assessmentQueryKeys.all });
    },
  });
};

export const useSyncSessionMutation = () =>
  useMutation({
    mutationFn: syncSessionProgress,
  });

export const useSaveAssessmentMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: saveAssessment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: assessmentQueryKeys.all });
    },
  });
};

export const useAssessmentHistoryQuery = (userId, enabled = true) =>
  useQuery({
    queryKey: assessmentQueryKeys.history(userId),
    queryFn: () => getAssessmentsByUser(userId),
    enabled: Boolean(userId) && enabled,
  });

export const useAssessmentReportQuery = (assessmentId, enabled = true) =>
  useQuery({
    queryKey: assessmentQueryKeys.report(assessmentId),
    queryFn: () => getAssessmentReport(assessmentId),
    enabled: Boolean(assessmentId) && enabled,
  });

export const useGenerateAiReportMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: generateAiReport,
    onSuccess: (data, variables) => {
      if (!variables?.assessmentId) {
        return;
      }

      queryClient.setQueryData(
        assessmentQueryKeys.report(variables.assessmentId),
        (current) => {
          if (!current || typeof current !== 'object') {
            return current;
          }

          return {
            ...current,
            aiReport: data.aiReport || current.aiReport || null,
            aiReportMeta: data.aiReportMeta || current.aiReportMeta || null,
            insightEngine: data.insightEngine || current.insightEngine || null,
            careerEngine: data.careerEngine || current.careerEngine || [],
          };
        }
      );

      queryClient.invalidateQueries({
        queryKey: assessmentQueryKeys.report(variables.assessmentId),
      });
      queryClient.invalidateQueries({ queryKey: assessmentQueryKeys.all });
    },
  });
};

export const useActiveSessionQuery = (userId, enabled = true) =>
  useQuery({
    queryKey: assessmentQueryKeys.activeSession(userId),
    queryFn: () => getActiveSession(userId),
    enabled: Boolean(userId) && enabled,
    staleTime: 15000,
  });

export const useTraitTrendsQuery = (userId, enabled = true) =>
  useQuery({
    queryKey: assessmentQueryKeys.traitTrends(userId),
    queryFn: () => getTraitTrends(userId),
    enabled: Boolean(userId) && enabled,
  });

export const useAssessmentComparisonQuery = (
  assessmentAId,
  assessmentBId,
  enabled = true
) =>
  useQuery({
    queryKey: assessmentQueryKeys.comparison(assessmentAId, assessmentBId),
    queryFn: () => compareAssessments({ assessmentAId, assessmentBId }),
    enabled: Boolean(assessmentAId) && Boolean(assessmentBId) && enabled,
  });
