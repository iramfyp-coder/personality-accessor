import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useReducedMotion } from 'framer-motion';
import {
  FiArrowLeft,
  FiAward,
  FiCpu,
  FiDownload,
  FiRefreshCw,
  FiShare2,
  FiSend,
  FiTrendingUp,
  FiUser,
} from 'react-icons/fi';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Skeleton from '../../components/ui/Skeleton';
import Loader from '../../components/ui/Loader';
import LoaderOverlay from '../../components/ui/LoaderOverlay';
import TraitRadarChart from '../../components/charts/TraitRadarChart';
import CareerAlignmentChart from '../../components/charts/CareerAlignmentChart';
import MetricBarChart from '../../components/charts/MetricBarChart';
import InsightHeatmapChart from '../../components/charts/InsightHeatmapChart';
import TraitSphere from '../../components/3d/TraitSphere';
import mapTraitsTo3DData from '../../utils/traitMapper';
import { normalizeTraits } from '../../utils/traits';
import { useAuth } from '../../hooks/useAuth';
import tokens from '../../theme/tokens';
import {
  useAssessmentFlowResultQuery,
  useCareerChatMutation,
  useWhyNotCareerMutation,
} from '../../hooks/useAssessmentFlow';
import { downloadAssessmentFlowPdf } from '../../api/assessmentFlowApi';
import { clearAssessmentFlowState, readAssessmentFlowState } from '../../utils/assessmentFlowStorage';
import { AVATAR_EVENTS, useAvatarEvents } from '../../components/avatar/AvatarEvents';

gsap.registerPlugin(ScrollTrigger);

const COGNITIVE_LABELS = {
  analytical: 'Analytical',
  creative: 'Creative',
  strategic: 'Strategic',
  systematic: 'Systematic',
  practical: 'Practical',
  abstract: 'Abstract',
};

const BEHAVIOR_LABELS = {
  leadership: 'Leadership',
  risk_tolerance: 'Risk Tolerance',
  decision_speed: 'Decision Speed',
  stress_tolerance: 'Stress Tolerance',
  team_preference: 'Team Preference',
};

const QUICK_CHAT_PROMPTS = [
  'Why is my top career a strong fit?',
  'What should I improve in 30 days?',
  'Which skill gap blocks my growth most?',
];

const toDefaultFollowUps = (topCareer = '') => [
  `What makes ${topCareer || 'my top role'} stronger than my second match?`,
  'Give me one scenario to improve leadership and decision quality.',
  'What should I practice weekly to increase confidence?',
];

const bandClass = (value = '') => {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'high') return 'high';
  if (normalized === 'medium') return 'medium';
  return 'low';
};

const AssessmentFlowResultPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const auth = useAuth();
  const prefersReducedMotion = useReducedMotion();

  const sessionId =
    searchParams.get('session') || readAssessmentFlowState(auth.userId)?.sessionId || '';

  const resultQuery = useAssessmentFlowResultQuery(sessionId, Boolean(sessionId));
  const chatMutation = useCareerChatMutation();
  const whyNotMutation = useWhyNotCareerMutation();
  const { emit } = useAvatarEvents();

  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [followUpPrompts, setFollowUpPrompts] = useState(QUICK_CHAT_PROMPTS);
  const [chatError, setChatError] = useState('');
  const [chatTyping, setChatTyping] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const [shareStatus, setShareStatus] = useState('');
  const [whyNotCareer, setWhyNotCareer] = useState('');
  const [whyNotResult, setWhyNotResult] = useState(null);
  const [whyNotError, setWhyNotError] = useState('');

  const sectionsRef = useRef([]);
  const chatFeedRef = useRef(null);
  const downloadButtonRef = useRef(null);
  const resultsLoadedRef = useRef(false);

  const result = resultQuery.data?.result || null;

  useEffect(() => {
    if (resultQuery.isPending || chatMutation.isPending) {
      emit(AVATAR_EVENTS.AI_LOADING, {
        long: true,
        targetKey: 'results-hero',
      });
    }
  }, [chatMutation.isPending, emit, resultQuery.isPending]);

  useEffect(() => {
    if (Array.isArray(resultQuery.data?.history)) {
      setChatHistory(resultQuery.data.history);
    }
  }, [resultQuery.data?.history]);

  useEffect(() => {
    resultsLoadedRef.current = false;
  }, [sessionId]);

  useEffect(() => {
    if (!chatFeedRef.current) {
      return;
    }

    chatFeedRef.current.scrollTo({
      top: chatFeedRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [chatHistory, chatTyping]);

  const traits = useMemo(() => normalizeTraits(result?.trait_scores || {}), [result?.trait_scores]);
  const threeDPayload = useMemo(() => mapTraitsTo3DData(traits), [traits]);
  const recommendations = Array.isArray(result?.career_recommendations)
    ? result.career_recommendations
    : [];
  const contrast = result?.career_contrast || {};
  const topCareer = recommendations[0] || null;
  const followUps = useMemo(
    () => (followUpPrompts.length ? followUpPrompts : toDefaultFollowUps(topCareer?.career || '')),
    [followUpPrompts, topCareer?.career]
  );

  const heatmapFacetScores = useMemo(() => {
    const direct =
      (result?.facetScores && typeof result.facetScores === 'object' && result.facetScores) ||
      (result?.facet_scores && typeof result.facet_scores === 'object' && result.facet_scores) ||
      {};

    if (Object.keys(direct).length > 0) {
      return direct;
    }

    const fromInsight = Array.isArray(result?.insightHeatmap)
      ? result.insightHeatmap
      : Array.isArray(result?.insight_heatmap)
      ? result.insight_heatmap
      : [];

    if (!fromInsight.length) {
      return {};
    }

    return fromInsight.reduce((accumulator, entry) => {
      const trait = String(entry?.trait || '').toUpperCase();
      const value = Number(entry?.value || 0);
      if (!trait) {
        return accumulator;
      }

      for (let index = 1; index <= 6; index += 1) {
        accumulator[`${trait}${index}`] = Math.max(0, Math.min(100, Math.round(value + index - 3)));
      }

      return accumulator;
    }, {});
  }, [result]);
  const hasHeatmapData = Object.keys(heatmapFacetScores).length > 0;

  useEffect(() => {
    if (!result || resultsLoadedRef.current) {
      return;
    }

    emit(AVATAR_EVENTS.RESULTS_LOADED, {
      targetKey: 'results-hero',
      message: 'Here is your personality profile. Scroll to see your roadmap.',
    });
    resultsLoadedRef.current = true;
  }, [emit, result]);

  useEffect(() => {
    if (!result || prefersReducedMotion) {
      return;
    }

    const sections = sectionsRef.current.filter(Boolean);
    const animations = [];

    sections.forEach((section) => {
      animations.push(
        gsap.fromTo(
          section,
          { autoAlpha: 0, y: 34 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.7,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: section,
              start: 'top 85%',
              toggleActions: 'play none none reverse',
            },
          }
        )
      );
    });

    const counters = Array.from(document.querySelectorAll('.phase3-count'));
    counters.forEach((element) => {
      const target = Number(element.getAttribute('data-target') || 0);
      const value = { current: 0 };
      animations.push(
        gsap.to(value, {
          current: target,
          duration: 1.2,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: element,
            start: 'top 92%',
            toggleActions: 'play none none reverse',
          },
          onUpdate: () => {
            element.textContent = `${Math.round(value.current)}%`;
          },
        })
      );
    });

    return () => {
      animations.forEach((animation) => {
        animation.scrollTrigger?.kill();
        animation.kill();
      });
    };
  }, [result, prefersReducedMotion]);

  useEffect(() => {
    if (prefersReducedMotion || !downloadButtonRef.current) {
      return () => {};
    }

    const tween = gsap.to(downloadButtonRef.current, {
      boxShadow: `${tokens.glow.cyan}, 0 12px 24px rgba(25, 151, 219, 0.3)`,
      repeat: -1,
      yoyo: true,
      duration: 1.2,
      ease: 'sine.inOut',
    });

    return () => tween.kill();
  }, [prefersReducedMotion, result?.meta?.generated_at]);

  const submitChat = async (incomingMessage) => {
    const text = String(incomingMessage ?? message ?? '').trim();

    if (!text) {
      return;
    }

    setChatError('');
    setMessage('');
    setChatTyping(true);
    emit(AVATAR_EVENTS.CHAT_MESSAGE, {
      targetKey: 'chatbot-panel',
    });

    const optimisticTimestamp = new Date().toISOString();
    setChatHistory((current) => [
      ...current,
      {
        role: 'user',
        message: text,
        createdAt: optimisticTimestamp,
      },
    ]);

    try {
      const payload = await chatMutation.mutateAsync({
        sessionId,
        message: text,
      });
      emit(AVATAR_EVENTS.CHAT_RESPONSE, {
        targetKey: 'chatbot-panel',
      });
      setChatHistory((current) => (Array.isArray(payload.history) ? payload.history : current));
      setFollowUpPrompts(
        toDefaultFollowUps(topCareer?.career || 'your best-fit role').map((item, index) =>
          index === 0 ? item : `${item} (${text.slice(0, 36)}...)`
        )
      );
    } catch (error) {
      setChatError(error.message || 'Assistant is unavailable right now.');
      setChatHistory((current) =>
        current.filter(
          (entry) => !(entry.createdAt === optimisticTimestamp && entry.role === 'user' && entry.message === text)
        )
      );
    } finally {
      setChatTyping(false);
    }
  };

  const handleBackToDashboard = () => {
    navigate('/dashboard');
  };

  const handleRetakeAssessment = () => {
    clearAssessmentFlowState(auth.userId);
    navigate('/assessment/start');
  };

  const downloadPdf = async () => {
    if (!sessionId) {
      return;
    }

    setPdfError('');

    try {
      const blob = await downloadAssessmentFlowPdf(sessionId);
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `career-intelligence-report-${sessionId}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      setPdfError(error.message || 'Unable to download PDF report right now.');
    }
  };

  const shareReport = async () => {
    setShareStatus('');
    const sharePayload = {
      title: 'AI Career Intelligence Report',
      text: `Top Career: ${topCareer?.career || 'Career fit insights available'}`,
      url: window.location.href,
    };

    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share(sharePayload);
        setShareStatus('Report share sheet opened.');
        return;
      }

      await navigator.clipboard.writeText(window.location.href);
      setShareStatus('Report link copied to clipboard.');
    } catch (error) {
      setShareStatus('Unable to share this report on this device.');
    }
  };

  const submitWhyNot = async () => {
    const career = whyNotCareer.trim();
    if (!career) {
      return;
    }

    setWhyNotError('');
    setWhyNotResult(null);

    try {
      const payload = await whyNotMutation.mutateAsync({
        sessionId,
        career,
      });
      setWhyNotResult(payload.explanation || null);
    } catch (error) {
      setWhyNotError(error.message || 'Unable to generate why-not explanation right now.');
    }
  };

  if (!sessionId) {
    return (
      <main className="app-page">
        <div className="page-shell">
          <Card title="Result not found">
            <p className="ui-message ui-message--error">No assessment session was provided.</p>
            <Button onClick={() => navigate('/assessment/start')}>Start Assessment</Button>
          </Card>
        </div>
      </main>
    );
  }

  if (resultQuery.isPending) {
    return (
      <main className="app-page">
        <LoaderOverlay visible message="Building your personality profile..." />
        <div className="page-shell">
          <Card title="Generating report">
            <Loader label="Building your personality profile..." variant="result" />
            <Skeleton height="36px" />
            <Skeleton height="280px" />
            <Skeleton height="140px" count={2} />
          </Card>
        </div>
      </main>
    );
  }

  if (resultQuery.isError || !result) {
    return (
      <main className="app-page">
        <div className="page-shell">
          <Card title="Result unavailable">
            <p className="ui-message ui-message--error">
              {resultQuery.error?.message || 'Assessment result is not ready yet.'}
            </p>
            <Button onClick={() => navigate('/assessment/start')}>Back to Start</Button>
          </Card>
        </div>
      </main>
    );
  }

  const confidenceBand = bandClass(result.confidence_band);
  const confidencePercent = Math.max(0, Math.min(100, Math.round(result.confidence_score || 0)));

  return (
    <main className="app-page phase3-result-page" data-avatar-section="results-main">
      <LoaderOverlay visible={resultQuery.isPending} message="Building your personality profile..." />
      <div className="page-shell result-shell phase3-result-shell">
        <section
          data-scroll-reveal
          className="phase3-result-hero phase3-result-section"
          ref={(node) => { sectionsRef.current[0] = node; }}
          data-avatar-section="result-hero"
          data-avatar-target="results-hero"
        >
          <div>
            <p className="page-header__eyebrow">AI Career Intelligence Report</p>
            <h1 className="page-header__title">{result.personality_type_label || result.personality_type}</h1>
            <p className="page-header__subtitle">
              {result.narrative_summary || result.behavioral_summary || 'Narrative summary unavailable.'}
            </p>
            <div className="phase3-archetype-badge">
              <FiAward />
              <span>{result.personality_type_label || result.personality_type}</span>
            </div>
          </div>
          <div className="phase3-result-hero__stats">
            <div className="phase3-result-hero__actions">
              <Button
                variant="ghost"
                onClick={handleBackToDashboard}
                data-avatar-action="back-dashboard"
                data-avatar-target="results-hero"
              >
                <FiArrowLeft /> Back to Dashboard
              </Button>
              <Button
                variant="secondary"
                onClick={handleRetakeAssessment}
                data-avatar-action="retake-assessment"
                data-avatar-target="results-hero"
                data-avatar-hint="Retake if you want to compare a new profile run."
              >
                <FiRefreshCw /> Retake Assessment
              </Button>
            </div>
            <article className="phase3-hero-stat">
              <p>Top Career Match</p>
              <strong className="phase3-count" data-target={Number(topCareer?.score || 0)}>
                0%
              </strong>
              <span>{topCareer?.career || 'Not available'}</span>
            </article>
            <article className="phase3-hero-stat">
              <p>Consistency Score</p>
              <strong className="phase3-count" data-target={Math.round(Number(result.consistency_score || 0) * 100)}>
                0%
              </strong>
              <span>Psychometric stability</span>
            </article>
            <article className="phase3-hero-stat">
              <p>Confidence</p>
              <strong className="phase3-count" data-target={confidencePercent}>
                0%
              </strong>
              <span>{String(result.confidence_band || 'low').toUpperCase()}</span>
            </article>
            <div ref={downloadButtonRef} data-avatar-target="report-download" className="phase3-download-actions">
              <Button
                variant="ghost"
                onClick={downloadPdf}
                data-avatar-action="download-report"
                data-avatar-target="report-download"
                data-avatar-hint="Download your PDF report here."
              >
                <FiDownload /> Download Report
              </Button>
              <Button
                variant="ghost"
                onClick={shareReport}
                data-avatar-action="share-report"
                data-avatar-target="report-download"
                data-avatar-hint="Share this report link."
              >
                <FiShare2 /> Share Report
              </Button>
            </div>
          </div>
        </section>

        <section
          data-scroll-reveal
          className="phase3-result-section"
          ref={(node) => { sectionsRef.current[1] = node; }}
          data-avatar-section="result-confidence"
          data-avatar-target="result-confidence-meter"
        >
          <Card title="Confidence Meter" subtitle="Top-career confidence after consistency adjustment">
            <div className="confidence-meter phase3-confidence-meter" data-avatar-target="result-confidence-meter">
              <div className="confidence-meter__track">
                <div
                  className={`confidence-meter__bar confidence-meter__bar--${confidenceBand}`}
                  style={{ width: `${confidencePercent}%` }}
                />
              </div>
              <p className="ui-message ui-message--neutral">
                Confidence Band: <strong>{String(result.confidence_band || 'low').toUpperCase()}</strong> · Gap{' '}
                <strong>{result.confidence_gap || 0}</strong>
              </p>
            </div>
          </Card>
        </section>

        <section
          data-scroll-reveal
          className="phase3-result-charts phase3-result-section"
          ref={(node) => { sectionsRef.current[2] = node; }}
          data-avatar-section="result-profile"
          data-avatar-target="result-profile-chart"
        >
          <Card title="OCEAN Radar" subtitle="Personality profile">
            <TraitRadarChart key={`radar-${result.meta?.generated_at || 'latest'}`} traits={traits} height={320} />
          </Card>

          <Card title="3D Trait Sphere" subtitle="Interactive trait field" className="result-profile-chart" >
            <TraitSphere data={threeDPayload} />
          </Card>
        </section>

        <section data-scroll-reveal className="phase3-result-charts phase3-result-section" ref={(node) => { sectionsRef.current[3] = node; }}>
          <Card title="Cognitive Chart" subtitle="Adaptive cognitive signals">
            <MetricBarChart
              key={`cognitive-${result.meta?.generated_at || 'latest'}`}
              metrics={result.cognitive_scores || {}}
              labels={COGNITIVE_LABELS}
              barColor={tokens.accent.cyan}
              height={300}
            />
          </Card>
          <Card title="Behavior Chart" subtitle="Behavioral execution signals">
            <MetricBarChart
              key={`behavior-${result.meta?.generated_at || 'latest'}`}
              metrics={result.behavior_vector || {}}
              labels={BEHAVIOR_LABELS}
              barColor={tokens.accent.amber}
              height={300}
            />
          </Card>
        </section>

        <section data-scroll-reveal className="phase3-result-section" ref={(node) => { sectionsRef.current[4] = node; }}>
          <Card title="Insight Heatmap" subtitle="Trait-intensity map for deeper interpretation">
            {hasHeatmapData ? (
              <InsightHeatmapChart facetScores={heatmapFacetScores} />
            ) : (
              <div className="skeleton-stack">
                <Skeleton height="220px" />
                <Skeleton height="20px" />
              </div>
            )}
          </Card>
        </section>

        <section
          data-scroll-reveal
          className="phase3-result-section"
          ref={(node) => { sectionsRef.current[5] = node; }}
          data-avatar-section="result-career-landscape"
        >
          <Card title="Career Match Landscape" subtitle="Overall, personality, and career fit">
            <CareerAlignmentChart recommendations={recommendations} />
          </Card>
        </section>

        <section
          data-scroll-reveal
          className="phase3-result-section"
          ref={(node) => { sectionsRef.current[6] = node; }}
          data-avatar-section="result-career-match"
          data-avatar-target="career-matches"
        >
          <Card title="Career Matches" subtitle="Why each role matched and what to build next">
            <div className="phase3-career-grid" data-avatar-target="career-matches">
              {recommendations.map((career, index) => (
                <article className="phase3-career-card" key={`${career.career}-${index}`}>
                  <header>
                    <h4>
                      #{index + 1} {career.career}
                    </h4>
                    <span className={`phase3-confidence-pill is-${bandClass(career.confidence_band)}`}>
                      {String(career.confidence_band || 'low').toUpperCase()} CONF
                    </span>
                  </header>
                  <p className="phase3-career-card__metric">
                    Match: <strong>{career.score}%</strong> · Confidence: <strong>{career.confidence || 0}%</strong>
                  </p>
                  <p>{career.why_fit || career.explanation?.summary}</p>
                  <p>
                    <strong>Why matched:</strong>{' '}
                    {(career.explanation?.top_signals || []).join(', ') || 'Balanced fit across personality and skills.'}
                  </p>
                  <p>
                    <strong>Skills needed:</strong>{' '}
                    {(career.key_skills_to_build || []).slice(0, 5).join(', ') || 'Not specified'}
                  </p>
                </article>
              ))}
            </div>
          </Card>
        </section>

        <section data-scroll-reveal className="phase3-result-section" ref={(node) => { sectionsRef.current[7] = node; }}>
          <Card title="Career Contrast Engine" subtitle="Why #1 is stronger than #2">
            {contrast?.summary ? (
              <div className="phase3-contrast">
                <p className="phase3-contrast__summary">
                  <FiTrendingUp /> {contrast.summary}
                </p>
                <ul>
                  {(contrast.reasons || []).map((reason, index) => (
                    <li key={`${reason}-${index}`}>{reason}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="empty-state">Contrast data will appear when at least two careers are ranked.</p>
            )}
          </Card>
        </section>

        <section data-scroll-reveal className="phase3-result-section" ref={(node) => { sectionsRef.current[8] = node; }}>
          <Card title="Why Not Engine" subtitle="Compare any target career against your profile">
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <input
                  type="text"
                  value={whyNotCareer}
                  onChange={(event) => setWhyNotCareer(event.target.value)}
                  className="ui-input"
                  placeholder="Example: Data Scientist"
                  style={{ flex: 1, minWidth: 0 }}
                />
                <Button onClick={submitWhyNot} loading={whyNotMutation.isPending}>
                  Why Not?
                </Button>
              </div>
              {whyNotResult ? (
                <article className="intel-notification-item">
                  <h4>
                    {whyNotResult.career} · Match {whyNotResult.score}%
                  </h4>
                  <p>{whyNotResult.explanation}</p>
                  {Array.isArray(whyNotResult.gaps) && whyNotResult.gaps.length ? (
                    <p>Primary gaps: {whyNotResult.gaps.join(', ')}</p>
                  ) : null}
                </article>
              ) : null}
              {whyNotError ? <p className="ui-message ui-message--error">{whyNotError}</p> : null}
            </div>
          </Card>
        </section>

        <section
          data-scroll-reveal
          className="phase3-result-section"
          ref={(node) => { sectionsRef.current[9] = node; }}
          data-avatar-section="result-roadmap"
          data-avatar-target="learning-roadmap"
        >
          <Card title="Learning Roadmap" subtitle="Sequenced growth path">
            <div className="intel-timeline" data-avatar-target="learning-roadmap">
              {(result.career_roadmap || []).map((step, index) => (
                <article key={`${step.stage}-${index}`} className="intel-timeline__item is-expanded">
                  <div className="intel-timeline__details" style={{ maxHeight: '100%' }}>
                    <h4>{step.stage}</h4>
                    <p>{step.summary}</p>
                  </div>
                </article>
              ))}
            </div>
          </Card>
        </section>

        <section
          data-scroll-reveal
          className="phase3-result-section"
          ref={(node) => { sectionsRef.current[10] = node; }}
          data-avatar-section="result-chat"
          data-avatar-target="chatbot-panel"
        >
          <Card title="AI Career Chatbot" subtitle="Ask follow-up questions about your profile">
            <div className="phase4-chat-shell" data-avatar-target="chatbot-panel">
              <div className="phase4-chat-suggestions">
                {followUps.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    className="phase4-chat-suggestion"
                    onClick={() => submitChat(prompt)}
                    disabled={chatMutation.isPending}
                    data-avatar-action="chat-suggestion"
                    data-avatar-target="chatbot-panel"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
              <div className="phase4-chat-feed" ref={chatFeedRef}>
                {chatHistory.length === 0 ? (
                  <p className="empty-state">Ask: “Why am I suited for this role?”</p>
                ) : (
                  chatHistory.map((entry, index) => (
                    <article
                      key={`${entry.role}-${entry.createdAt}-${index}`}
                      className={`phase4-chat-bubble ${entry.role === 'assistant' ? 'is-ai' : 'is-user'}`}
                    >
                      <header>
                        <span className="phase4-chat-avatar" aria-hidden="true">
                          {entry.role === 'assistant' ? <FiCpu /> : <FiUser />}
                        </span>
                        <h4>{entry.role === 'assistant' ? 'AI Coach' : 'You'}</h4>
                      </header>
                      <p>{entry.message}</p>
                    </article>
                  ))
                )}
                {chatTyping ? (
                  <article className="phase4-chat-bubble is-ai is-typing">
                    <header>
                      <span className="phase4-chat-avatar" aria-hidden="true">
                        <FiCpu />
                      </span>
                      <h4>AI Coach</h4>
                    </header>
                    <p className="phase4-typing-dots" aria-label="Assistant is typing">
                      <span />
                      <span />
                      <span />
                    </p>
                  </article>
                ) : null}
              </div>
              <div className="phase4-chat-input-row">
                <input
                  type="text"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  className="ui-input"
                  placeholder="Ask about fit, skills, or roadmap"
                  style={{ flex: 1, minWidth: 0 }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      submitChat();
                    }
                  }}
                />
                <Button
                  onClick={() => submitChat()}
                  loading={chatMutation.isPending}
                  data-avatar-action="chat-send"
                  data-avatar-target="chatbot-panel"
                  data-avatar-hint="Send your question and I will explain based on your profile."
                >
                  <FiSend /> Ask
                </Button>
              </div>
              {chatError ? <p className="ui-message ui-message--error">{chatError}</p> : null}
              {pdfError ? <p className="ui-message ui-message--error">{pdfError}</p> : null}
              {shareStatus ? <p className="ui-message ui-message--neutral">{shareStatus}</p> : null}
            </div>
          </Card>
        </section>
      </div>
    </main>
  );
};

export default AssessmentFlowResultPage;
