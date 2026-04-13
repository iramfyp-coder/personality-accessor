import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useReducedMotion } from 'framer-motion';
import { FiAward, FiCpu, FiDownload, FiSend, FiTrendingUp, FiUser } from 'react-icons/fi';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Skeleton from '../../components/ui/Skeleton';
import Loader from '../../components/ui/Loader';
import TraitRadarChart from '../../components/charts/TraitRadarChart';
import CareerAlignmentChart from '../../components/charts/CareerAlignmentChart';
import MetricBarChart from '../../components/charts/MetricBarChart';
import TraitSphere from '../../components/3d/TraitSphere';
import mapTraitsTo3DData from '../../utils/traitMapper';
import { normalizeTraits } from '../../utils/traits';
import { useAuth } from '../../hooks/useAuth';
import {
  useAssessmentFlowResultQuery,
  useCareerChatMutation,
  useWhyNotCareerMutation,
} from '../../hooks/useAssessmentFlow';
import { downloadAssessmentFlowPdf } from '../../api/assessmentFlowApi';
import { readAssessmentFlowState } from '../../utils/assessmentFlowStorage';

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

  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [chatError, setChatError] = useState('');
  const [chatTyping, setChatTyping] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const [whyNotCareer, setWhyNotCareer] = useState('');
  const [whyNotResult, setWhyNotResult] = useState(null);
  const [whyNotError, setWhyNotError] = useState('');

  const sectionsRef = useRef([]);
  const chatFeedRef = useRef(null);

  const result = resultQuery.data?.result || null;

  useEffect(() => {
    if (Array.isArray(resultQuery.data?.history)) {
      setChatHistory(resultQuery.data.history);
    }
  }, [resultQuery.data?.history]);

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

  const submitChat = async (incomingMessage) => {
    const text = String(incomingMessage ?? message ?? '').trim();

    if (!text) {
      return;
    }

    setChatError('');
    setMessage('');
    setChatTyping(true);

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
      setChatHistory((current) => (Array.isArray(payload.history) ? payload.history : current));
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
        <div className="page-shell">
          <Card title="Generating report">
            <Loader label="AI is generating your result intelligence..." variant="result" />
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
  const topCareer = recommendations[0] || null;

  return (
    <main className="app-page phase3-result-page">
      <div className="page-shell result-shell phase3-result-shell">
        <section data-scroll-reveal className="phase3-result-hero phase3-result-section" ref={(node) => { sectionsRef.current[0] = node; }}>
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
            <Button variant="ghost" onClick={downloadPdf}>
              <FiDownload /> Download PDF
            </Button>
          </div>
        </section>

        <section data-scroll-reveal className="phase3-result-section" ref={(node) => { sectionsRef.current[1] = node; }}>
          <Card title="Confidence Meter" subtitle="Top-career confidence after consistency adjustment">
            <div className="confidence-meter phase3-confidence-meter">
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

        <section data-scroll-reveal className="phase3-result-charts phase3-result-section" ref={(node) => { sectionsRef.current[2] = node; }}>
          <Card title="OCEAN Radar" subtitle="Personality profile">
            <TraitRadarChart key={`radar-${result.meta?.generated_at || 'latest'}`} traits={traits} height={320} />
          </Card>

          <Card title="3D Trait Sphere" subtitle="Interactive trait field">
            <TraitSphere data={threeDPayload} />
          </Card>
        </section>

        <section data-scroll-reveal className="phase3-result-charts phase3-result-section" ref={(node) => { sectionsRef.current[3] = node; }}>
          <Card title="Cognitive Chart" subtitle="Adaptive cognitive signals">
            <MetricBarChart
              key={`cognitive-${result.meta?.generated_at || 'latest'}`}
              metrics={result.cognitive_scores || {}}
              labels={COGNITIVE_LABELS}
              barColor="#2dd4bf"
              height={300}
            />
          </Card>
          <Card title="Behavior Chart" subtitle="Behavioral execution signals">
            <MetricBarChart
              key={`behavior-${result.meta?.generated_at || 'latest'}`}
              metrics={result.behavior_vector || {}}
              labels={BEHAVIOR_LABELS}
              barColor="#f59e0b"
              height={300}
            />
          </Card>
        </section>

        <section data-scroll-reveal className="phase3-result-section" ref={(node) => { sectionsRef.current[4] = node; }}>
          <Card title="Career Match Landscape" subtitle="Overall, personality, and career fit">
            <CareerAlignmentChart recommendations={recommendations} />
          </Card>
        </section>

        <section data-scroll-reveal className="phase3-result-section" ref={(node) => { sectionsRef.current[5] = node; }}>
          <Card title="Career Matches" subtitle="Why each role matched and what to build next">
            <div className="phase3-career-grid">
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

        <section data-scroll-reveal className="phase3-result-section" ref={(node) => { sectionsRef.current[6] = node; }}>
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

        <section data-scroll-reveal className="phase3-result-section" ref={(node) => { sectionsRef.current[7] = node; }}>
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

        <section data-scroll-reveal className="phase3-result-section" ref={(node) => { sectionsRef.current[8] = node; }}>
          <Card title="Learning Roadmap" subtitle="Sequenced growth path">
            <div className="intel-timeline">
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

        <section data-scroll-reveal className="phase3-result-section" ref={(node) => { sectionsRef.current[9] = node; }}>
          <Card title="AI Career Chatbot" subtitle="Ask follow-up questions about your profile">
            <div className="phase4-chat-shell">
              <div className="phase4-chat-suggestions">
                {QUICK_CHAT_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    className="phase4-chat-suggestion"
                    onClick={() => submitChat(prompt)}
                    disabled={chatMutation.isPending}
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
                <Button onClick={() => submitChat()} loading={chatMutation.isPending}>
                  <FiSend /> Ask
                </Button>
              </div>
              {chatError ? <p className="ui-message ui-message--error">{chatError}</p> : null}
              {pdfError ? <p className="ui-message ui-message--error">{pdfError}</p> : null}
            </div>
          </Card>
        </section>
      </div>
    </main>
  );
};

export default AssessmentFlowResultPage;
