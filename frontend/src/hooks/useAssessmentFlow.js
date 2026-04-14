import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  askWhyNotCareer,
  askCareerChat,
  getActiveFlowSession,
  getAdaptiveQuestion,
  getPreviousAdaptiveQuestion,
  getAssessmentFlowResult,
  getFlowSession,
  startAdaptiveAssessment,
  streamAssessmentProgress,
  submitAdaptiveAnswer,
  uploadCv,
} from '../api/assessmentFlowApi';

export const assessmentFlowKeys = {
  all: ['assessment-flow'],
  active: ['assessment-flow', 'active'],
  session: (sessionId) => ['assessment-flow', 'session', sessionId],
  question: (sessionId) => ['assessment-flow', 'question', sessionId],
  result: (sessionId) => ['assessment-flow', 'result', sessionId],
};

export const useActiveFlowSessionQuery = (enabled = true) =>
  useQuery({
    queryKey: assessmentFlowKeys.active,
    queryFn: getActiveFlowSession,
    enabled,
    staleTime: 10000,
  });

export const useFlowSessionQuery = (sessionId, enabled = true) =>
  useQuery({
    queryKey: assessmentFlowKeys.session(sessionId),
    queryFn: () => getFlowSession(sessionId),
    enabled: Boolean(sessionId) && enabled,
    staleTime: 8000,
  });

export const useAdaptiveQuestionQuery = (sessionId, enabled = true) =>
  useQuery({
    queryKey: assessmentFlowKeys.question(sessionId),
    queryFn: () => getAdaptiveQuestion(sessionId),
    enabled: Boolean(sessionId) && enabled,
    staleTime: 4000,
  });

export const useAssessmentFlowResultQuery = (sessionId, enabled = true) =>
  useQuery({
    queryKey: assessmentFlowKeys.result(sessionId),
    queryFn: () => getAssessmentFlowResult(sessionId),
    enabled: Boolean(sessionId) && enabled,
    staleTime: 20000,
  });

export const useUploadCvMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: uploadCv,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: assessmentFlowKeys.active });
    },
  });
};

export const useStartAdaptiveAssessmentMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: startAdaptiveAssessment,
    onSuccess: (data) => {
      if (data?.session?.sessionId) {
        queryClient.invalidateQueries({
          queryKey: assessmentFlowKeys.session(data.session.sessionId),
        });
      }

      queryClient.invalidateQueries({ queryKey: assessmentFlowKeys.active });
    },
  });
};

export const useSubmitAdaptiveAnswerMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: submitAdaptiveAnswer,
    onSuccess: (data, variables) => {
      const sessionId = variables?.sessionId;

      if (!sessionId) {
        return;
      }

      if (data?.question || data?.session) {
        queryClient.setQueryData(assessmentFlowKeys.question(sessionId), data);
      } else {
        queryClient.invalidateQueries({
          queryKey: assessmentFlowKeys.question(sessionId),
        });
      }

      if (data?.session) {
        queryClient.setQueryData(assessmentFlowKeys.session(sessionId), data);
      } else {
        queryClient.invalidateQueries({
          queryKey: assessmentFlowKeys.session(sessionId),
        });
      }

      queryClient.invalidateQueries({
        queryKey: assessmentFlowKeys.result(sessionId),
      });
      queryClient.invalidateQueries({ queryKey: assessmentFlowKeys.active });
    },
  });
};

export const usePreviousAdaptiveQuestionMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: getPreviousAdaptiveQuestion,
    onSuccess: (data, sessionId) => {
      if (!sessionId) {
        return;
      }

      queryClient.setQueryData(assessmentFlowKeys.question(sessionId), data);
      if (data?.session) {
        queryClient.setQueryData(assessmentFlowKeys.session(sessionId), data);
      } else {
        queryClient.invalidateQueries({
          queryKey: assessmentFlowKeys.session(sessionId),
        });
      }
      queryClient.invalidateQueries({ queryKey: assessmentFlowKeys.active });
    },
  });
};

export const useCareerChatMutation = () =>
  useMutation({
    mutationFn: askCareerChat,
  });

export const useWhyNotCareerMutation = () =>
  useMutation({
    mutationFn: askWhyNotCareer,
  });

export const openAssessmentProgressStream = async ({
  sessionId,
  onEvent,
  signal,
  lastEventId,
}) =>
  streamAssessmentProgress({
    sessionId,
    onEvent,
    signal,
    lastEventId,
  });
