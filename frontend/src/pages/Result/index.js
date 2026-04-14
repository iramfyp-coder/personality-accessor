import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Skeleton from '../../components/ui/Skeleton';
import FadeIn from '../../components/motion/FadeIn';
import TraitRadarChart from '../../components/charts/TraitRadarChart';
import TraitBarChart from '../../components/charts/TraitBarChart';
import TraitDeltaChart from '../../components/charts/TraitDeltaChart';
import TraitSphere from '../../components/3d/TraitSphere';
import {
  useAssessmentComparisonQuery,
  useAssessmentHistoryQuery,
  useAssessmentReportQuery,
  useGenerateAiReportMutation,
} from '../../hooks/useAssessment';
import { useAuth } from '../../hooks/useAuth';
import mapTraitsTo3DData from '../../utils/traitMapper';
import { getPersonalityProfile } from '../../utils/personalityProfiles';
import { getDominantTrait, normalizeTraits } from '../../utils/traits';

const formatDate = (value) => {
  if (!value) {
    return 'Not available';
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date(value));
};

const isLowPowerDevice = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  const reducedMotion =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const lowMemory =
    typeof navigator !== 'undefined' &&
    typeof navigator.deviceMemory === 'number' &&
    navigator.deviceMemory <= 2;

  const lowThreads =
    typeof navigator !== 'undefined' &&
    typeof navigator.hardwareConcurrency === 'number' &&
    navigator.hardwareConcurrency <= 2;

  const mobileViewport = typeof window.innerWidth === 'number' && window.innerWidth <= 820;

  const saveData =
    typeof navigator !== 'undefined' &&
    navigator.connection &&
    navigator.connection.saveData === true;

  return reducedMotion || lowMemory || lowThreads || mobileViewport || saveData;
};

const toCareerList = (items) => (Array.isArray(items) ? items : []);

const ResultPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { assessmentId } = useParams();

  const auth = useAuth();
  const reportQuery = useAssessmentReportQuery(assessmentId, Boolean(assessmentId));
  const historyQuery = useAssessmentHistoryQuery(auth.userId, Boolean(auth.userId));
  const aiReportMutation = useGenerateAiReportMutation();

  const [showComparison, setShowComparison] = useState(false);
  const [selectedCompareAssessmentId, setSelectedCompareAssessmentId] = useState('');
  const [aiReportResponse, setAiReportResponse] = useState(null);
  const [aiStatusMessage, setAiStatusMessage] = useState('');

  const routeResult = location.state?.result || null;
  const requestedCompareAssessmentId = String(location.state?.compareWith || '');
  const shouldOpenComparisonFromRoute = Boolean(location.state?.openComparison);
  const report = reportQuery.data || routeResult;
  const traits = normalizeTraits(report?.traits || {});
  const dominantTrait = report?.dominantTrait || getDominantTrait(traits);
  const profile = getPersonalityProfile(dominantTrait);

  const historyAssessments = useMemo(
    () => historyQuery.data || [],
    [historyQuery.data]
  );

  const comparisonCandidates = useMemo(
    () =>
      historyAssessments.filter(
        (assessment) => assessment.assessmentId !== String(assessmentId)
      ),
    [assessmentId, historyAssessments]
  );

  useEffect(() => {
    if (!comparisonCandidates.length) {
      setSelectedCompareAssessmentId('');
      return;
    }

    const hasRequestedCandidate = comparisonCandidates.some(
      (assessment) => assessment.assessmentId === requestedCompareAssessmentId
    );

    setSelectedCompareAssessmentId((current) => {
      if (current && comparisonCandidates.some((assessment) => assessment.assessmentId === current)) {
        return current;
      }

      if (hasRequestedCandidate) {
        return requestedCompareAssessmentId;
      }

      return comparisonCandidates[0].assessmentId;
    });
  }, [comparisonCandidates, requestedCompareAssessmentId]);

  useEffect(() => {
    if (!shouldOpenComparisonFromRoute || !requestedCompareAssessmentId) {
      return;
    }

    const canOpenRequestedComparison = comparisonCandidates.some(
      (assessment) => assessment.assessmentId === requestedCompareAssessmentId
    );

    if (canOpenRequestedComparison) {
      setShowComparison(true);
    }
  }, [
    comparisonCandidates,
    requestedCompareAssessmentId,
    shouldOpenComparisonFromRoute,
  ]);

  useEffect(() => {
    setAiReportResponse(null);
    setAiStatusMessage('');
  }, [assessmentId]);

  const comparisonQuery = useAssessmentComparisonQuery(
    selectedCompareAssessmentId,
    assessmentId,
    showComparison && Boolean(selectedCompareAssessmentId)
  );

  const previousTraits = useMemo(() => {
    if (comparisonQuery.data?.assessmentA?.traits) {
      return comparisonQuery.data.assessmentA.traits;
    }

    const currentIndex = historyAssessments.findIndex(
      (item) => item.assessmentId === assessmentId
    );

    if (currentIndex >= 0 && historyAssessments[currentIndex + 1]) {
      return historyAssessments[currentIndex + 1].traits;
    }

    if (currentIndex < 0 && historyAssessments.length > 1) {
      return historyAssessments[1].traits;
    }

    return null;
  }, [assessmentId, comparisonQuery.data, historyAssessments]);

  const threeDPayload = useMemo(() => mapTraitsTo3DData(traits), [traits]);
  const canRender3D = useMemo(() => !isLowPowerDevice(), []);

  const aiReport = aiReportResponse?.aiReport || report?.aiReport || null;
  const aiReportMeta = aiReportResponse?.aiReportMeta || report?.aiReportMeta || null;
  const insightEngine = aiReportResponse?.insightEngine || report?.insightEngine || null;
  const careerEngine = toCareerList(aiReportResponse?.careerEngine || report?.careerEngine);

  const handleGenerateAiReport = async (forceRefresh = false) => {
    if (!assessmentId) {
      return;
    }

    setAiStatusMessage('');

    try {
      const payload = await aiReportMutation.mutateAsync({
        assessmentId,
        forceRefresh,
      });

      setAiReportResponse(payload);
      setAiStatusMessage(
        payload.cached
          ? 'Loaded cached AI report (no extra token cost).'
          : 'Generated a new AI report successfully.'
      );
    } catch (error) {
      setAiStatusMessage('');
    }
  };

  if (reportQuery.isPending && !routeResult) {
    return (
      <main className="app-page">
        <div className="page-shell">
          <Card title="Loading report" subtitle="Preparing trait analysis">
            <Skeleton width="35%" />
            <Skeleton height="320px" />
            <Skeleton height="100px" count={2} />
          </Card>
        </div>
      </main>
    );
  }

  if (!report || reportQuery.isError) {
    return (
      <main className="app-page">
        <div className="page-shell">
          <Card title="Report unavailable">
            <p className="ui-message ui-message--error">
              {reportQuery.error?.message || 'Unable to fetch this report.'}
            </p>
            <Button onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="app-page">
      <div className="page-shell result-shell">
        <header className="page-header">
          <FadeIn>
            <div>
              <p className="page-header__eyebrow">Assessment Report</p>
              <h1 className="page-header__title">{profile.name} Profile</h1>
              <p className="page-header__subtitle">Generated on {formatDate(report.createdAt)}</p>
            </div>
          </FadeIn>
          <FadeIn delay={0.06}>
            <div className="page-header__actions">
              <Link className="history-item__link" to="/dashboard">
                Back to Dashboard
              </Link>
              <Button variant="ghost" onClick={() => navigate('/assessment/start')}>
                Retake Assessment
              </Button>
            </div>
          </FadeIn>
        </header>

        <section className="result-sections">
          <Card title="Summary" subtitle="Dominant trait highlight">
            <div className="dominant-trait">
              <span className="dominant-trait__badge">{dominantTrait}</span>
              <div>
                <h3>{profile.traitName}</h3>
                <p>{profile.summary}</p>
              </div>
            </div>
          </Card>

          <Card title="Traits Breakdown" subtitle="OCEAN distribution and comparison">
            <div className="result-charts">
              <TraitRadarChart traits={traits} />
              <TraitBarChart
                traits={traits}
                comparisonTraits={previousTraits}
                currentLabel="Current"
                previousLabel="Compared"
              />
            </div>
          </Card>

          <Card title="Assessment Comparison" subtitle="Compare against a previous report">
            {comparisonCandidates.length === 0 ? (
              <p className="empty-state">No previous assessments available for comparison yet.</p>
            ) : (
              <>
                <div className="comparison-controls">
                  <Button
                    variant="secondary"
                    onClick={() => setShowComparison((prev) => !prev)}
                  >
                    {showComparison ? 'Hide Comparison' : 'Compare with Previous Assessment'}
                  </Button>

                  {showComparison && (
                    <label className="comparison-select-wrap">
                      <span>Select assessment</span>
                      <select
                        value={selectedCompareAssessmentId}
                        onChange={(event) =>
                          setSelectedCompareAssessmentId(event.target.value)
                        }
                      >
                        {comparisonCandidates.map((candidate) => (
                          <option
                            key={candidate.assessmentId}
                            value={candidate.assessmentId}
                          >
                            {formatDate(candidate.createdAt)} ({candidate.dominantTrait})
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>

                {showComparison && comparisonQuery.isPending && <Skeleton height="280px" />}
                {showComparison && comparisonQuery.isError && (
                  <p className="ui-message ui-message--error">
                    {comparisonQuery.error.message}
                  </p>
                )}
                {showComparison && comparisonQuery.data?.comparison && (
                  <TraitDeltaChart comparison={comparisonQuery.data.comparison} />
                )}
              </>
            )}
          </Card>

          <Card
            title="AI Intelligence Report"
            subtitle="Deep personality analysis with hybrid intelligence"
            action={
              <div className="ai-report-actions">
                <Button
                  variant={aiReport ? 'ghost' : 'primary'}
                  onClick={() => handleGenerateAiReport(Boolean(aiReport))}
                  loading={aiReportMutation.isPending}
                >
                  {aiReport ? 'Regenerate AI Report' : 'Generate AI Report'}
                </Button>
              </div>
            }
          >
            {aiStatusMessage && <p className="ui-message ui-message--success">{aiStatusMessage}</p>}

            {aiReportMeta?.generatedAt && (
              <p className="ui-message ui-message--neutral">
                Cached report generated on {formatDate(aiReportMeta.generatedAt)}
              </p>
            )}

            {!aiReport && !aiReportMutation.isPending && !aiReportMutation.isError && (
              <p className="empty-state">
                Generate your AI report to unlock personality summary, work style,
                communication style, growth plan, and career recommendations.
              </p>
            )}

            {aiReportMutation.isPending && (
              <div className="skeleton-stack">
                <Skeleton width="45%" height="1.2rem" />
                <Skeleton count={4} height="0.9rem" />
                <Skeleton height="120px" />
                <Skeleton height="120px" />
              </div>
            )}

            {aiReportMutation.isError && (
              <div className="ai-report-error">
                <p className="ui-message ui-message--error">
                  {aiReportMutation.error?.message ||
                    'AI report generation failed. Please retry.'}
                </p>
                <Button
                  variant="secondary"
                  onClick={() => handleGenerateAiReport(Boolean(aiReport))}
                >
                  Retry
                </Button>
              </div>
            )}

            {aiReport && (
              <div className="ai-report-grid">
                <article className="ai-report-block">
                  <h4>Personality Summary</h4>
                  <p>{aiReport.summary}</p>
                </article>

                <article className="ai-report-block">
                  <h4>Strengths</h4>
                  <ul className="recommendation-list">
                    {(aiReport.strengths || []).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>

                <article className="ai-report-block">
                  <h4>Weaknesses</h4>
                  <ul className="recommendation-list">
                    {(aiReport.weaknesses || []).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>

                <article className="ai-report-block">
                  <h4>Work Style</h4>
                  <p>{aiReport.workStyle}</p>
                </article>

                <article className="ai-report-block">
                  <h4>Communication Style</h4>
                  <p>{aiReport.communicationStyle}</p>
                </article>

                <article className="ai-report-block">
                  <h4>Growth Plan</h4>
                  <ul className="recommendation-list">
                    {(aiReport.growthSuggestions || []).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>

                <article className="ai-report-block ai-report-block--full">
                  <h4>Career Suggestions</h4>
                  <div className="career-grid">
                    {toCareerList(aiReport.careerRecommendations).map((item) => (
                      <div className="career-card" key={`${item.career}-${item.reason}`}>
                        <h5>{item.career}</h5>
                        <p>{item.reason}</p>
                        {Array.isArray(item.skillsNeeded) && item.skillsNeeded.length > 0 && (
                          <p className="career-card__skills">
                            Skills: {item.skillsNeeded.join(', ')}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </article>

                {insightEngine && (
                  <article className="ai-report-block ai-report-block--full">
                    <h4>Insight Engine (Non-AI)</h4>
                    <p>{insightEngine.dominantTraitExplanation}</p>
                    <div className="hybrid-grid">
                      <div>
                        <h5>Risk Signals</h5>
                        <ul className="recommendation-list">
                          {(insightEngine.riskSignals || []).map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h5>Behavioral Patterns</h5>
                        <ul className="recommendation-list">
                          {(insightEngine.behavioralPatterns || []).map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </article>
                )}

                {careerEngine.length > 0 && (
                  <article className="ai-report-block ai-report-block--full">
                    <h4>Career Engine Baseline</h4>
                    <div className="career-grid">
                      {careerEngine.map((item) => (
                        <div className="career-card" key={`${item.career}-${item.signal || 'base'}`}>
                          <h5>{item.career}</h5>
                          {item.signal && <p className="career-card__signal">Signal: {item.signal}</p>}
                          <p>{item.reason}</p>
                        </div>
                      ))}
                    </div>
                  </article>
                )}
              </div>
            )}
          </Card>

          <Card
            title="Personality Visualization (3D)"
            subtitle="Interactive OCEAN trait graph with orbit and zoom"
          >
            {canRender3D ? (
              <TraitSphere data={threeDPayload} />
            ) : (
              <>
                <p className="empty-state">
                  3D visualization is disabled on this device to preserve performance.
                </p>
                <pre className="payload-preview">{JSON.stringify(threeDPayload, null, 2)}</pre>
              </>
            )}
          </Card>

          <Card title="Recommendations" subtitle="Static guidance for now">
            <ul className="recommendation-list">
              {profile.recommendations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Card>
        </section>
      </div>
    </main>
  );
};

export default ResultPage;
