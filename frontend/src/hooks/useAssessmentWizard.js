import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './useAuth';
import {
  useStartAdaptiveAssessmentMutation,
  useUploadCvMutation,
} from './useAssessmentFlow';
import {
  readAssessmentFlowState,
  saveAssessmentFlowState,
} from '../utils/assessmentFlowStorage';

export const WIZARD_STEPS = {
  role: 1,
  profileInput: 2,
  confirm: 3,
  generate: 4,
};

export const ROLE_OPTIONS = [
  {
    value: 'student',
    label: 'Student',
    description: 'Still studying and exploring first-career paths.',
  },
  {
    value: 'graduate',
    label: 'Graduate',
    description: 'Recently completed studies and moving into industry.',
  },
  {
    value: 'professional',
    label: 'Professional',
    description: 'Already working and optimizing next career steps.',
  },
];

export const DEFAULT_PROFILE_FORM = {
  field: '',
  subjects: '',
  skills: '',
  interests: '',
  preferredCareers: '',
  age: '',
  gender: '',
};

const GENERATION_MESSAGES = [
  'Analyzing CV',
  'Understanding personality',
  'Building questions',
  'Preparing assessment',
];

const csvToList = (value = '') =>
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const payloadToProfileForm = (profile = {}) => {
  const subjects = Array.isArray(profile.subjects) ? profile.subjects : [];
  const fieldFromPayload = String(profile.field || '').trim();

  return {
    field: fieldFromPayload || subjects[0] || '',
    subjects: subjects.join(', '),
    skills: Array.isArray(profile.skills) ? profile.skills.join(', ') : '',
    interests: Array.isArray(profile.interests) ? profile.interests.join(', ') : '',
    preferredCareers: Array.isArray(profile.preferredCareers)
      ? profile.preferredCareers.join(', ')
      : '',
    age:
      Number.isFinite(Number(profile.age)) && Number(profile.age) > 0
        ? String(profile.age)
        : '',
    gender: String(profile.gender || '').trim(),
  };
};

const profileFormToPayload = (profile = {}) => {
  const field = String(profile.field || '').trim();
  const subjects = csvToList(profile.subjects);

  if (field && !subjects.includes(field)) {
    subjects.unshift(field);
  }

  const ageNumber = Number(profile.age);

  return {
    subjects,
    interests: csvToList(profile.interests),
    skills: csvToList(profile.skills),
    preferredCareers: csvToList(profile.preferredCareers),
    age: Number.isFinite(ageNumber) && ageNumber > 0 ? ageNumber : null,
    gender: String(profile.gender || '').trim().toLowerCase(),
  };
};

const hasProfileData = (profile = {}) => {
  const payload = profileFormToPayload(profile);

  return Boolean(
    payload.subjects.length ||
      payload.skills.length ||
      payload.interests.length ||
      payload.preferredCareers.length ||
      payload.age ||
      payload.gender
  );
};

const resolveParsedProfile = (response, fallbackPayload) => {
  const parsedCandidate =
    response?.parsedProfile ||
    response?.session?.parsedProfile ||
    response?.session?.userProfile ||
    response?.userProfile ||
    response?.profile ||
    fallbackPayload;

  if (!parsedCandidate || typeof parsedCandidate !== 'object') {
    return payloadToProfileForm(fallbackPayload);
  }

  return payloadToProfileForm(parsedCandidate);
};

export const useAssessmentWizard = () => {
  const navigate = useNavigate();
  const auth = useAuth();
  const uploadMutation = useUploadCvMutation();
  const startMutation = useStartAdaptiveAssessmentMutation();

  const localState = useMemo(() => readAssessmentFlowState(auth.userId) || {}, [auth.userId]);

  const [currentStep, setCurrentStep] = useState(WIZARD_STEPS.role);
  const [userRole, setUserRole] = useState(localState.userRole || '');
  const [cvFile, setCvFile] = useState(null);
  const [inputMode, setInputMode] = useState(localState.inputMode || 'cv');
  const [sessionId, setSessionId] = useState(localState.sessionId || '');

  const [manualProfile, setManualProfile] = useState(
    localState.userProfile
      ? payloadToProfileForm(localState.userProfile)
      : DEFAULT_PROFILE_FORM
  );
  const [parsedProfile, setParsedProfile] = useState(
    localState.userProfile
      ? payloadToProfileForm(localState.userProfile)
      : DEFAULT_PROFILE_FORM
  );

  const [stepError, setStepError] = useState('');
  const [generationStatus, setGenerationStatus] = useState('idle');
  const [generationError, setGenerationError] = useState('');
  const [generationIndex, setGenerationIndex] = useState(0);
  const [generationStartedAt, setGenerationStartedAt] = useState(0);

  const isUploading = uploadMutation.isPending;
  const isStarting = startMutation.isPending;
  const isBusy = isUploading || isStarting;

  const isStep1Valid = Boolean(userRole);
  const isStep2Valid =
    inputMode === 'cv' ? Boolean(cvFile) : hasProfileData(manualProfile);
  const isStep3Valid = hasProfileData(parsedProfile);

  const generationMessages = GENERATION_MESSAGES;

  useEffect(() => {
    if (generationStatus !== 'running') {
      return () => {};
    }

    const timer = window.setInterval(() => {
      setGenerationIndex((current) => {
        if (current >= generationMessages.length - 1) {
          return current;
        }
        return current + 1;
      });
    }, 640);

    return () => window.clearInterval(timer);
  }, [generationMessages.length, generationStatus]);

  useEffect(() => {
    if (generationStatus !== 'success' || !sessionId) {
      return () => {};
    }

    const elapsed = Date.now() - generationStartedAt;
    const waitFor = Math.max(0, 2400 - elapsed);

    const timer = window.setTimeout(() => {
      navigate(`/assessment/test?session=${sessionId}`);
    }, waitFor);

    return () => window.clearTimeout(timer);
  }, [generationStartedAt, generationStatus, navigate, sessionId]);

  const updateManualProfile = useCallback((key, value) => {
    setManualProfile((current) => ({
      ...current,
      [key]: value,
    }));
  }, []);

  const updateParsedProfile = useCallback((key, value) => {
    setParsedProfile((current) => ({
      ...current,
      [key]: value,
    }));
  }, []);

  const goToPreviousStep = useCallback(() => {
    if (currentStep === WIZARD_STEPS.generate && generationStatus === 'running') {
      return;
    }

    setStepError('');
    setGenerationError('');
    setCurrentStep((current) => Math.max(WIZARD_STEPS.role, current - 1));
  }, [currentStep, generationStatus]);

  const handleStepOneNext = useCallback(() => {
    if (!isStep1Valid) {
      setStepError('Please select your role before continuing.');
      return false;
    }

    setStepError('');
    setCurrentStep(WIZARD_STEPS.profileInput);
    return true;
  }, [isStep1Valid]);

  const handleStepTwoNext = useCallback(async () => {
    if (!isStep2Valid) {
      setStepError('Provide a CV file or complete manual profile fields to continue.');
      return false;
    }

    setStepError('');

    if (inputMode === 'manual') {
      setParsedProfile({ ...manualProfile });

      saveAssessmentFlowState(auth.userId, {
        sessionId,
        stage: 'cv_upload',
        userRole,
        userProfile: profileFormToPayload(manualProfile),
        inputMode: 'manual',
      });

      setCurrentStep(WIZARD_STEPS.confirm);
      return true;
    }

    try {
      const manualPayload = profileFormToPayload(manualProfile);
      const response = await uploadMutation.mutateAsync({
        file: cvFile,
        userRole,
        userProfile: manualPayload,
      });

      const nextSessionId = response?.session?.sessionId || sessionId;
      const nextProfile = resolveParsedProfile(response, manualPayload);

      if (nextSessionId) {
        setSessionId(nextSessionId);
      }

      setParsedProfile(nextProfile);

      saveAssessmentFlowState(auth.userId, {
        sessionId: nextSessionId,
        stage: 'cv_upload',
        userRole,
        userProfile: profileFormToPayload(nextProfile),
        inputMode: 'cv',
      });

      setCurrentStep(WIZARD_STEPS.confirm);
      return true;
    } catch (error) {
      setStepError(error.message || 'Unable to parse CV right now. Please try again.');
      return false;
    }
  }, [
    auth.userId,
    cvFile,
    inputMode,
    isStep2Valid,
    manualProfile,
    sessionId,
    uploadMutation,
    userRole,
  ]);

  const handleStepThreeNext = useCallback(async () => {
    if (!isStep3Valid) {
      setStepError('Profile data is required before generating assessment questions.');
      return false;
    }

    setStepError('');
    setGenerationError('');
    setGenerationStatus('running');
    setGenerationIndex(0);
    setGenerationStartedAt(Date.now());
    setCurrentStep(WIZARD_STEPS.generate);

    const profilePayload = profileFormToPayload(parsedProfile);

    try {
      const response = await startMutation.mutateAsync({
        sessionId: sessionId || undefined,
        userRole,
        userProfile: profilePayload,
        skipCv: inputMode === 'manual',
      });

      const nextSessionId = response?.session?.sessionId || sessionId;

      if (nextSessionId) {
        setSessionId(nextSessionId);
      }

      saveAssessmentFlowState(auth.userId, {
        sessionId: nextSessionId,
        stage: 'questionnaire',
        userRole,
        userProfile: profilePayload,
        inputMode,
      });

      setGenerationIndex(generationMessages.length - 1);
      setGenerationStatus('success');
      return true;
    } catch (error) {
      setGenerationStatus('error');
      setGenerationError(
        error.message || 'Question generation failed. Please return to confirmation and try again.'
      );
      return false;
    }
  }, [
    auth.userId,
    generationMessages.length,
    inputMode,
    isStep3Valid,
    parsedProfile,
    sessionId,
    startMutation,
    userRole,
  ]);

  const retryGeneration = useCallback(() => {
    setGenerationError('');
    setGenerationStatus('idle');
    setCurrentStep(WIZARD_STEPS.confirm);
  }, []);

  const goToNextStep = useCallback(async () => {
    if (currentStep === WIZARD_STEPS.role) {
      return handleStepOneNext();
    }

    if (currentStep === WIZARD_STEPS.profileInput) {
      return handleStepTwoNext();
    }

    if (currentStep === WIZARD_STEPS.confirm) {
      return handleStepThreeNext();
    }

    return false;
  }, [
    currentStep,
    handleStepOneNext,
    handleStepThreeNext,
    handleStepTwoNext,
  ]);

  return {
    currentStep,
    setCurrentStep,
    userRole,
    setUserRole,
    cvFile,
    setCvFile,
    inputMode,
    setInputMode,
    manualProfile,
    updateManualProfile,
    parsedProfile,
    updateParsedProfile,
    sessionId,
    stepError,
    setStepError,
    generationStatus,
    generationError,
    generationMessages,
    generationIndex,
    isUploading,
    isStarting,
    isBusy,
    isStep1Valid,
    isStep2Valid,
    isStep3Valid,
    goToPreviousStep,
    goToNextStep,
    retryGeneration,
  };
};

export default useAssessmentWizard;
