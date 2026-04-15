import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './useAuth';
import { useStartAdaptiveAssessmentMutation, useUploadCvMutation } from './useAssessmentFlow';
import { readAssessmentFlowState, saveAssessmentFlowState } from '../utils/assessmentFlowStorage';

export const WIZARD_STEPS = {
  profileType: 1,
  cvAnalysis: 2,
  startAssessment: 3,
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

const DEFAULT_PROFILE_FORM = {
  field: '',
  subjects: '',
  skills: '',
  interests: '',
  preferredCareers: '',
  age: '',
  gender: '',
};

const ANALYSIS_MESSAGES = ['Analyzing CV', 'Extracting skills', 'Detecting field', 'Building profile'];

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

const cvDataToProfileForm = (cvData = {}) => {
  const subjects = Array.isArray(cvData.subjects) ? cvData.subjects : [];
  const skills = Array.isArray(cvData.skills)
    ? cvData.skills.map((skill) => String(skill?.name || skill).trim()).filter(Boolean)
    : [];
  const interests = Array.isArray(cvData.interests) ? cvData.interests : [];
  const preferredCareers = Array.isArray(cvData.careerSignals)
    ? cvData.careerSignals
    : Array.isArray(cvData.career_signals)
    ? cvData.career_signals
    : [];
  const sourceDomain = String(cvData.source_domain || '')
    .replace(/[-_]+/g, ' ')
    .trim();

  return payloadToProfileForm({
    field: sourceDomain || subjects[0] || '',
    subjects,
    skills,
    interests,
    preferredCareers,
  });
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

const resolveParsedProfile = (response) => {
  const parsedCandidate =
    response?.parsedProfile ||
    response?.session?.parsedProfile ||
    response?.session?.userProfile ||
    response?.userProfile ||
    response?.profile ||
    {};

  if (parsedCandidate && typeof parsedCandidate === 'object' && Object.keys(parsedCandidate).length > 0) {
    return payloadToProfileForm(parsedCandidate);
  }

  if (response?.cvData && typeof response.cvData === 'object') {
    return cvDataToProfileForm(response.cvData);
  }

  return DEFAULT_PROFILE_FORM;
};

const hasDetectedProfile = (profile = {}) => {
  const field = String(profile.field || '').trim();
  const skills = csvToList(profile.skills);
  const interests = csvToList(profile.interests);

  return Boolean(field || skills.length || interests.length);
};

export const useAssessmentWizard = () => {
  const navigate = useNavigate();
  const auth = useAuth();
  const uploadMutation = useUploadCvMutation();
  const startMutation = useStartAdaptiveAssessmentMutation();

  const localState = useMemo(() => readAssessmentFlowState(auth.userId) || {}, [auth.userId]);

  const [currentStep, setCurrentStep] = useState(WIZARD_STEPS.profileType);
  const [userRole, setUserRole] = useState(localState.userRole || '');
  const [cvFile, setCvFile] = useState(null);
  const [sessionId, setSessionId] = useState(localState.sessionId || '');
  const [parsedProfile, setParsedProfile] = useState(
    localState.userProfile ? payloadToProfileForm(localState.userProfile) : DEFAULT_PROFILE_FORM
  );

  const [stepError, setStepError] = useState('');
  const [analysisStatus, setAnalysisStatus] = useState('idle');
  const [analysisIndex, setAnalysisIndex] = useState(0);

  const isUploading = uploadMutation.isPending;
  const isStarting = startMutation.isPending;
  const isBusy = isUploading || isStarting;

  const isStep1Valid = Boolean(userRole);
  const isStep2Valid = Boolean(cvFile);
  const isStep3Valid = Boolean(sessionId) && hasDetectedProfile(parsedProfile);

  useEffect(() => {
    if (analysisStatus !== 'running') {
      return () => {};
    }

    const timer = window.setInterval(() => {
      setAnalysisIndex((current) => {
        if (current >= ANALYSIS_MESSAGES.length - 1) {
          return current;
        }
        return current + 1;
      });
    }, 720);

    return () => window.clearInterval(timer);
  }, [analysisStatus]);

  const handleStepOneNext = useCallback(() => {
    if (!isStep1Valid) {
      setStepError('Please select your profile type before continuing.');
      return false;
    }

    setStepError('');
    setCurrentStep(WIZARD_STEPS.cvAnalysis);
    return true;
  }, [isStep1Valid]);

  const handleCvAnalyze = useCallback(async () => {
    if (!isStep2Valid) {
      setStepError('Upload your CV before starting analysis.');
      return false;
    }

    setStepError('');
    setAnalysisStatus('running');
    setAnalysisIndex(0);

    try {
      const response = await uploadMutation.mutateAsync({
        file: cvFile,
        userRole,
      });

      const nextSessionId = response?.session?.sessionId || sessionId;
      const nextProfile = resolveParsedProfile(response);

      if (nextSessionId) {
        setSessionId(nextSessionId);
      }

      setParsedProfile(nextProfile);
      setAnalysisIndex(ANALYSIS_MESSAGES.length - 1);
      setAnalysisStatus('success');

      saveAssessmentFlowState(auth.userId, {
        sessionId: nextSessionId,
        stage: 'cv_upload',
        userRole,
        userProfile: profileFormToPayload(nextProfile),
        inputMode: 'cv',
      });

      window.setTimeout(() => {
        setCurrentStep(WIZARD_STEPS.startAssessment);
      }, 260);

      return true;
    } catch (error) {
      setAnalysisStatus('error');
      setStepError(error.message || 'Unable to analyze CV right now. Please try again.');
      return false;
    }
  }, [auth.userId, cvFile, isStep2Valid, sessionId, uploadMutation, userRole]);

  const handleStartAssessment = useCallback(async () => {
    if (!isStep3Valid) {
      setStepError('Profile analysis is required before starting the assessment.');
      return false;
    }

    setStepError('');
    const profilePayload = profileFormToPayload(parsedProfile);

    try {
      const response = await startMutation.mutateAsync({
        sessionId: sessionId || undefined,
        userRole,
        userProfile: profilePayload,
        skipCv: false,
      });

      const nextSessionId = response?.session?.sessionId || sessionId;
      if (!nextSessionId) {
        throw new Error('Unable to start assessment session');
      }

      setSessionId(nextSessionId);

      saveAssessmentFlowState(auth.userId, {
        sessionId: nextSessionId,
        stage: 'questionnaire',
        userRole,
        userProfile: profilePayload,
        inputMode: 'cv',
      });

      navigate(`/assessment/test?session=${nextSessionId}`);
      return true;
    } catch (error) {
      setStepError(error.message || 'Unable to start assessment. Please try again.');
      return false;
    }
  }, [auth.userId, isStep3Valid, navigate, parsedProfile, sessionId, startMutation, userRole]);

  const goToNextStep = useCallback(async () => {
    if (currentStep === WIZARD_STEPS.profileType) {
      return handleStepOneNext();
    }

    if (currentStep === WIZARD_STEPS.cvAnalysis) {
      return handleCvAnalyze();
    }

    if (currentStep === WIZARD_STEPS.startAssessment) {
      return handleStartAssessment();
    }

    return false;
  }, [currentStep, handleCvAnalyze, handleStartAssessment, handleStepOneNext]);

  const goToPreviousStep = useCallback(() => {
    if (analysisStatus === 'running' || isStarting) {
      return;
    }

    setStepError('');
    setCurrentStep((current) => Math.max(WIZARD_STEPS.profileType, current - 1));
  }, [analysisStatus, isStarting]);

  return {
    currentStep,
    userRole,
    setUserRole,
    cvFile,
    setCvFile,
    parsedProfile,
    sessionId,
    stepError,
    setStepError,
    analysisStatus,
    analysisMessages: ANALYSIS_MESSAGES,
    analysisIndex,
    isUploading,
    isStarting,
    isBusy,
    isStep1Valid,
    isStep2Valid,
    isStep3Valid,
    goToPreviousStep,
    goToNextStep,
  };
};

export default useAssessmentWizard;
