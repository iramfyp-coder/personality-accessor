import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiArrowRight,
  FiCheckCircle,
  FiClock,
  FiFileText,
  FiLoader,
  FiUploadCloud,
  FiUser,
  FiUsers,
  FiBriefcase,
  FiXCircle,
} from 'react-icons/fi';
import { gsap } from 'gsap';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Skeleton from '../../components/ui/Skeleton';
import Loader from '../../components/ui/Loader';
import { useAuth } from '../../hooks/useAuth';
import {
  openAssessmentProgressStream,
  useActiveFlowSessionQuery,
  useStartAdaptiveAssessmentMutation,
  useUploadCvMutation,
} from '../../hooks/useAssessmentFlow';
import {
  readAssessmentFlowState,
  saveAssessmentFlowState,
} from '../../utils/assessmentFlowStorage';

const STATUS_LABELS = {
  cv_upload: 'CV Analyzed',
  questionnaire: 'Generating Questions...',
  behavior: 'Behavior Analysis Pending',
  result: 'Assessment Result Ready',
};

const STAGE_ORDER = ['cv_upload', 'questionnaire', 'behavior', 'result'];

const STAGE_TITLES = {
  cv_upload: 'CV Upload',
  questionnaire: 'Questionnaire',
  behavior: 'Behavior Analysis',
  result: 'Result',
};

const ROLE_OPTIONS = [
  {
    value: 'student',
    label: 'Student',
    description: 'Still studying and exploring first-career paths.',
    icon: FiUser,
  },
  {
    value: 'graduate',
    label: 'Graduate',
    description: 'Recently completed studies and moving into industry.',
    icon: FiUsers,
  },
  {
    value: 'professional',
    label: 'Professional',
    description: 'Already working and optimizing next career steps.',
    icon: FiBriefcase,
  },
];

const DEFAULT_PROFILE = {
  field: '',
  subjects: '',
  marks: '',
  interests: '',
  skills: '',
  preferredCareers: '',
  age: '',
  gender: '',
};

const formatBytes = (bytes = 0) => {
  const value = Number(bytes || 0);

  if (!Number.isFinite(value) || value <= 0) {
    return '0 KB';
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
};

const formatEventTime = (dateLike) => {
  if (!dateLike) {
    return '';
  }

  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(dateLike));
};

const csvToList = (value = '') =>
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const marksToList = (value = '') =>
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((entry) => {
      const [subjectRaw, scoreRaw] = entry.split(':');
      const subject = String(subjectRaw || '').trim();
      const score = Number(scoreRaw);

      if (!subject) {
        return null;
      }

      return {
        subject,
        score: Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : 0,
      };
    })
    .filter(Boolean);

const toProfilePayload = (profile = {}) => {
  const field = String(profile.field || '').trim();
  const subjects = csvToList(profile.subjects);

  if (field && !subjects.includes(field)) {
    subjects.unshift(field);
  }

  const ageNumber = Number(profile.age);

  return {
    subjects,
    marks: marksToList(profile.marks),
    interests: csvToList(profile.interests),
    skills: csvToList(profile.skills),
    preferredCareers: csvToList(profile.preferredCareers),
    age: Number.isFinite(ageNumber) ? ageNumber : null,
    gender: String(profile.gender || '').trim().toLowerCase(),
  };
};

const profileToFormState = (profile = {}) => ({
  field: Array.isArray(profile.subjects) ? profile.subjects[0] || '' : '',
  subjects: Array.isArray(profile.subjects) ? profile.subjects.join(', ') : '',
  marks: Array.isArray(profile.marks)
    ? profile.marks
        .map((mark) => `${mark.subject}:${mark.score}`)
        .join(', ')
    : '',
  interests: Array.isArray(profile.interests) ? profile.interests.join(', ') : '',
  skills: Array.isArray(profile.skills) ? profile.skills.join(', ') : '',
  preferredCareers: Array.isArray(profile.preferredCareers)
    ? profile.preferredCareers.join(', ')
    : '',
  age: profile.age ? String(profile.age) : '',
  gender: profile.gender || '',
});

const StartAssessmentFlowPage = () => {
  const navigate = useNavigate();
  const auth = useAuth();

  const activeSessionQuery = useActiveFlowSessionQuery(Boolean(auth.isAuthenticated));
  const uploadMutation = useUploadCvMutation();
  const startMutation = useStartAdaptiveAssessmentMutation();

  const localState = useMemo(() => readAssessmentFlowState(auth.userId) || {}, [auth.userId]);

  const [selectedFile, setSelectedFile] = useState(null);
  const [sessionId, setSessionId] = useState(localState.sessionId || '');
  const [statusMessage, setStatusMessage] = useState('Tell us about yourself to start your personalized assessment.');
  const [progressEvents, setProgressEvents] = useState([]);
  const [userRole, setUserRole] = useState(localState.userRole || '');
  const [inputMode, setInputMode] = useState(localState.inputMode || 'cv');
  const [manualProfile, setManualProfile] = useState(
    localState.userProfile ? profileToFormState(localState.userProfile) : DEFAULT_PROFILE
  );

  const lastEventIdRef = useRef('');
  const fileInputRef = useRef(null);
  const roleCardRefs = useRef([]);

  const currentStage = activeSessionQuery.data?.session?.stage || '';
  const smartIntro = activeSessionQuery.data?.session?.smartIntro || null;
  const stageIndex = Math.max(STAGE_ORDER.indexOf(currentStage || 'cv_upload'), 0);
  const hasSelectedFile = Boolean(selectedFile);
  const activeSessionId = activeSessionQuery.data?.session?.sessionId || sessionId;
  const isUploading = uploadMutation.isPending;
  const isGenerating = startMutation.isPending;
  const isBusy = isUploading || isGenerating;

  const canResume = useMemo(
    () => currentStage === 'questionnaire' || currentStage === 'behavior' || currentStage === 'result',
    [currentStage]
  );

  const onboardingStep = useMemo(() => {
    if (canResume) {
      return inputMode === 'manual' ? 'manual' : 'cv';
    }

    if (!userRole) {
      return 'role';
    }

    if (inputMode === 'manual') {
      return 'manual';
    }

    return 'cv';
  }, [canResume, inputMode, userRole]);

  useEffect(() => {
    const currentSession = activeSessionQuery.data?.session;
    if (!currentSession?.sessionId) {
      return;
    }

    setSessionId(currentSession.sessionId);

    if (currentSession.userRole) {
      setUserRole(currentSession.userRole);
    }

    if (currentSession.userProfile && typeof currentSession.userProfile === 'object') {
      setManualProfile(profileToFormState(currentSession.userProfile));
    }

    saveAssessmentFlowState(auth.userId, {
      sessionId: currentSession.sessionId,
      stage: currentSession.stage,
      userRole: currentSession.userRole || userRole,
      userProfile: currentSession.userProfile || localState.userProfile,
      inputMode,
    });

    const status = STATUS_LABELS[currentSession.stage] || 'Assessment in progress';
    setStatusMessage(`Detected resumable session. ${status}`);
  }, [activeSessionQuery.data, auth.userId, inputMode, localState.userProfile, userRole]);

  useEffect(() => {
    if (onboardingStep !== 'role') {
      return;
    }

    const cards = roleCardRefs.current.filter(Boolean);
    if (!cards.length) {
      return;
    }

    const timeline = gsap.timeline();
    timeline.fromTo(
      cards,
      { autoAlpha: 0, y: 22, scale: 0.96 },
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.44, stagger: 0.08, ease: 'power3.out' }
    );

    return () => timeline.kill();
  }, [onboardingStep]);

  useEffect(() => {
    if (!sessionId) {
      return () => {};
    }

    const controller = new AbortController();

    openAssessmentProgressStream({
      sessionId,
      lastEventId: lastEventIdRef.current,
      signal: controller.signal,
      onEvent: ({ event, payload, eventId }) => {
        if (eventId) {
          lastEventIdRef.current = eventId;
        } else if (payload?.eventId) {
          lastEventIdRef.current = payload.eventId;
        }

        if (event === 'progress' && payload?.message) {
          setStatusMessage(payload.message);
          setProgressEvents((current) => [payload, ...current].slice(0, 8));
        }
      },
    }).catch(() => {});

    return () => {
      controller.abort();
    };
  }, [sessionId]);

  const handleFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    setSelectedFile(file);
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSelectRole = (role) => {
    setUserRole(role);
    setInputMode('cv');
    setStatusMessage('Role selected. Upload your CV or continue with manual profile input.');
    saveAssessmentFlowState(auth.userId, {
      sessionId,
      stage: 'cv_upload',
      userRole: role,
      inputMode: 'cv',
    });
  };

  const handleSkipCv = () => {
    setInputMode('manual');
    setStatusMessage('Manual profile mode enabled. Fill in your details to continue.');
    saveAssessmentFlowState(auth.userId, {
      sessionId,
      stage: 'cv_upload',
      userRole,
      inputMode: 'manual',
      userProfile: toProfilePayload(manualProfile),
    });
  };

  const handleBackToCv = () => {
    setInputMode('cv');
    setStatusMessage('CV mode restored. Upload your CV to continue.');
    saveAssessmentFlowState(auth.userId, {
      sessionId,
      stage: 'cv_upload',
      userRole,
      inputMode: 'cv',
    });
  };

  const handleManualChange = (key, value) => {
    setManualProfile((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleUploadCv = async () => {
    if (!selectedFile) {
      setStatusMessage('Please select a PDF or DOCX file first.');
      return;
    }

    try {
      setStatusMessage('Uploading and analyzing CV...');
      const payload = await uploadMutation.mutateAsync({
        file: selectedFile,
        userRole,
        userProfile: toProfilePayload(manualProfile),
      });
      const nextSessionId = payload?.session?.sessionId || '';

      if (nextSessionId) {
        setSessionId(nextSessionId);
        clearSelectedFile();

        saveAssessmentFlowState(auth.userId, {
          sessionId: nextSessionId,
          stage: 'cv_upload',
          userRole,
          userProfile: toProfilePayload(manualProfile),
          inputMode,
        });
      }

      setStatusMessage('CV analyzed. You can now generate adaptive questions.');
    } catch (error) {
      setStatusMessage(error.message || 'CV upload failed. Please try again.');
    }
  };

  const handleGenerateQuestions = async () => {
    if (!sessionId) {
      setStatusMessage('Upload CV first or switch to manual input mode.');
      return;
    }

    try {
      setStatusMessage('Generating adaptive interview questions...');
      const payload = await startMutation.mutateAsync({
        sessionId,
        userRole,
        userProfile: toProfilePayload(manualProfile),
      });
      const nextSessionId = payload?.session?.sessionId || sessionId;

      saveAssessmentFlowState(auth.userId, {
        sessionId: nextSessionId,
        stage: 'questionnaire',
        userRole,
        userProfile: toProfilePayload(manualProfile),
        inputMode,
      });

      navigate(`/assessment/test?session=${nextSessionId}`);
    } catch (error) {
      setStatusMessage(error.message || 'Unable to generate questions right now.');
    }
  };

  const handleStartManualAssessment = async () => {
    const profilePayload = toProfilePayload(manualProfile);
    const hasData =
      profilePayload.subjects.length > 0 ||
      profilePayload.skills.length > 0 ||
      profilePayload.interests.length > 0 ||
      profilePayload.preferredCareers.length > 0;

    if (!hasData) {
      setStatusMessage('Please add at least subjects, skills, interests, or preferred careers.');
      return;
    }

    try {
      setStatusMessage('Building assessment from manual profile...');
      const payload = await startMutation.mutateAsync({
        sessionId: sessionId || undefined,
        userRole,
        userProfile: profilePayload,
        skipCv: true,
      });

      const nextSessionId = payload?.session?.sessionId || sessionId;

      if (nextSessionId) {
        setSessionId(nextSessionId);
      }

      saveAssessmentFlowState(auth.userId, {
        sessionId: nextSessionId,
        stage: 'questionnaire',
        userRole,
        userProfile: profilePayload,
        inputMode: 'manual',
      });

      navigate(`/assessment/test?session=${nextSessionId}`);
    } catch (error) {
      setStatusMessage(error.message || 'Unable to start manual profile assessment right now.');
    }
  };

  const handleResume = () => {
    if (!sessionId) {
      return;
    }

    if (currentStage === 'result') {
      navigate(`/assessment/result?session=${sessionId}`);
      return;
    }

    if (currentStage === 'behavior') {
      navigate(`/assessment/behavior?session=${sessionId}`);
      return;
    }

    navigate(`/assessment/test?session=${sessionId}`);
  };

  if (activeSessionQuery.isPending && !sessionId) {
    return (
      <main className="app-page">
        <div className="page-shell">
          <Card title="Preparing assessment start">
            <Loader label="Loading your profile context..." variant="ai" />
            <Skeleton height="36px" />
            <Skeleton height="80px" />
            <Skeleton height="42px" />
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="app-page phase4-start-page">
      <div className="page-shell">
        <Card
          title="Start AI Career Assessment"
          subtitle="Role selection, CV intelligence, and adaptive flow setup"
          className="assessment-start-card"
        >
          <div className="assessment-flow-grid assessment-flow-grid--enhanced">
            <section className="assessment-start-panel phase4-start-panel" data-scroll-reveal>
              <div className="assessment-start-panel__status">
                <p className="assessment-start-panel__eyebrow">Live Status</p>
                <p className="ui-message ui-message--neutral">{statusMessage}</p>
                {smartIntro?.greeting ? (
                  <div className="assessment-smart-intro">
                    <p className="assessment-smart-intro__title">Smart Intro</p>
                    <p>{smartIntro.greeting}</p>
                    {smartIntro.focus ? <p>{smartIntro.focus}</p> : null}
                  </div>
                ) : null}
              </div>

              <div className="assessment-stage-track" aria-label="Assessment stages">
                {STAGE_ORDER.map((stageKey, index) => {
                  const isCompleted = index < stageIndex;
                  const isActive = index === stageIndex;

                  return (
                    <div
                      key={stageKey}
                      className={`assessment-stage-chip ${
                        isCompleted ? 'is-completed' : isActive ? 'is-active' : ''
                      }`}
                    >
                      <span className="assessment-stage-chip__icon" aria-hidden="true">
                        {isCompleted ? <FiCheckCircle /> : <FiClock />}
                      </span>
                      <span className="assessment-stage-chip__label">{STAGE_TITLES[stageKey]}</span>
                    </div>
                  );
                })}
              </div>

              {onboardingStep === 'role' ? (
                <div className="phase4-role-step">
                  <h3>Tell us about yourself</h3>
                  <p>Select your current profile so we can tune the assessment style.</p>
                  <div className="phase4-role-grid">
                    {ROLE_OPTIONS.map((role, index) => {
                      const RoleIcon = role.icon;
                      const isSelected = userRole === role.value;

                      return (
                        <button
                          key={role.value}
                          type="button"
                          ref={(node) => {
                            roleCardRefs.current[index] = node;
                          }}
                          className={`phase4-role-card ${isSelected ? 'is-selected' : ''}`}
                          onClick={() => handleSelectRole(role.value)}
                        >
                          <span className="phase4-role-card__icon" aria-hidden="true">
                            <RoleIcon />
                          </span>
                          <strong>{role.label}</strong>
                          <span>{role.description}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {onboardingStep === 'cv' ? (
                <>
                  <div className="assessment-upload-wrap">
                    <label htmlFor="cv-upload" className={`assessment-upload-zone ${hasSelectedFile ? 'has-file' : ''}`}>
                      <span className="assessment-upload-zone__icon" aria-hidden="true">
                        <FiUploadCloud />
                      </span>
                      <span className="assessment-upload-zone__title">
                        {hasSelectedFile ? 'CV Selected' : 'Upload Your CV'}
                      </span>
                      <span className="assessment-upload-zone__subtitle">
                        {hasSelectedFile
                          ? `${selectedFile.name} • ${formatBytes(selectedFile.size)}`
                          : 'Drag and drop or click to browse (PDF, DOCX, TXT)'}
                      </span>
                    </label>
                    <input
                      ref={fileInputRef}
                      id="cv-upload"
                      type="file"
                      className="assessment-upload-input"
                      accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                      onChange={handleFileChange}
                    />

                    {hasSelectedFile && (
                      <div className="assessment-upload-file-pill">
                        <FiFileText aria-hidden="true" />
                        <div>
                          <strong>{selectedFile.name}</strong>
                          <small>{formatBytes(selectedFile.size)}</small>
                        </div>
                        <button
                          type="button"
                          className="assessment-upload-file-pill__clear"
                          onClick={clearSelectedFile}
                          aria-label="Remove selected file"
                        >
                          <FiXCircle />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="assessment-start-actions">
                    <Button
                      onClick={handleUploadCv}
                      loading={isUploading}
                      disabled={!hasSelectedFile || isBusy}
                      className="assessment-start-actions__button"
                    >
                      {isUploading ? (
                        <>
                          <FiLoader /> Analyzing CV...
                        </>
                      ) : (
                        <>
                          <FiUploadCloud /> Analyze CV
                        </>
                      )}
                    </Button>

                    <Button
                      variant="secondary"
                      onClick={handleGenerateQuestions}
                      disabled={!activeSessionId || isBusy}
                      loading={isGenerating}
                      className="assessment-start-actions__button"
                    >
                      {isGenerating ? (
                        <>
                          <FiLoader /> Building Questions...
                        </>
                      ) : (
                        <>
                          Generate Questions <FiArrowRight />
                        </>
                      )}
                    </Button>

                    <Button
                      variant="ghost"
                      onClick={handleSkipCv}
                      disabled={isBusy}
                      className="assessment-start-actions__button"
                    >
                      Skip CV (Manual Input)
                    </Button>

                    {canResume && (
                      <Button
                        variant="ghost"
                        onClick={handleResume}
                        disabled={isBusy}
                        className="assessment-start-actions__button"
                      >
                        Resume Session
                      </Button>
                    )}
                  </div>
                </>
              ) : null}

              {onboardingStep === 'manual' ? (
                <div className="phase4-manual-form-wrap">
                  <h3>Manual Profile Input</h3>
                  <p>Fill this only if you skip CV upload.</p>
                  <div className="phase4-manual-grid">
                    <label>
                      <span>Field</span>
                      <input
                        className="ui-input"
                        value={manualProfile.field}
                        onChange={(event) => handleManualChange('field', event.target.value)}
                        placeholder="Computer Science"
                      />
                    </label>
                    <label>
                      <span>Subjects</span>
                      <input
                        className="ui-input"
                        value={manualProfile.subjects}
                        onChange={(event) => handleManualChange('subjects', event.target.value)}
                        placeholder="Math, Physics, Programming"
                      />
                    </label>
                    <label>
                      <span>Marks (subject:score)</span>
                      <input
                        className="ui-input"
                        value={manualProfile.marks}
                        onChange={(event) => handleManualChange('marks', event.target.value)}
                        placeholder="Math:90, Physics:85"
                      />
                    </label>
                    <label>
                      <span>Interests</span>
                      <input
                        className="ui-input"
                        value={manualProfile.interests}
                        onChange={(event) => handleManualChange('interests', event.target.value)}
                        placeholder="AI, Product, Analytics"
                      />
                    </label>
                    <label>
                      <span>Skills</span>
                      <input
                        className="ui-input"
                        value={manualProfile.skills}
                        onChange={(event) => handleManualChange('skills', event.target.value)}
                        placeholder="React, Python, SQL"
                      />
                    </label>
                    <label>
                      <span>Preferred Careers</span>
                      <input
                        className="ui-input"
                        value={manualProfile.preferredCareers}
                        onChange={(event) => handleManualChange('preferredCareers', event.target.value)}
                        placeholder="Software Engineer, Product Analyst"
                      />
                    </label>
                    <label>
                      <span>Age</span>
                      <input
                        className="ui-input"
                        type="number"
                        min="10"
                        max="90"
                        value={manualProfile.age}
                        onChange={(event) => handleManualChange('age', event.target.value)}
                        placeholder="22"
                      />
                    </label>
                    <label>
                      <span>Gender</span>
                      <input
                        className="ui-input"
                        value={manualProfile.gender}
                        onChange={(event) => handleManualChange('gender', event.target.value)}
                        placeholder="female / male / non-binary"
                      />
                    </label>
                  </div>
                  <div className="assessment-start-actions">
                    <Button
                      onClick={handleStartManualAssessment}
                      loading={isGenerating}
                      disabled={isBusy}
                      className="assessment-start-actions__button"
                    >
                      Start Assessment <FiArrowRight />
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={handleBackToCv}
                      disabled={isBusy}
                      className="assessment-start-actions__button"
                    >
                      Back to CV Upload
                    </Button>
                  </div>
                </div>
              ) : null}
            </section>

            <aside className="assessment-progress-panel" data-scroll-reveal>
              <div className="assessment-progress-panel__head">
                <h4>Real-Time Progress</h4>
                <p>Latest event stream for this session</p>
              </div>

              {progressEvents.length === 0 ? (
                <p className="empty-state">
                  Progress updates will appear here after CV analysis or manual profile start.
                </p>
              ) : (
                <div className="assessment-progress-feed">
                  {progressEvents.map((event, index) => (
                    <article key={`${event.createdAt}-${index}`} className="assessment-progress-item">
                      <div className="assessment-progress-item__head">
                        <strong>{event.message}</strong>
                        <span>{formatEventTime(event.createdAt)}</span>
                      </div>
                      <p>
                        Stage: <strong>{event.stage}</strong> | Status: <strong>{event.status}</strong>
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </aside>
          </div>
        </Card>
      </div>
    </main>
  );
};

export default StartAssessmentFlowPage;
