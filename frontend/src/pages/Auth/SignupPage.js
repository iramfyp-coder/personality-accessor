import React, { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useMutation } from '@tanstack/react-query';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import ScaleIn from '../../components/motion/ScaleIn';
import { googleLogin as googleLoginApi, signup as signupApi } from '../../api/authApi';
import { GOOGLE_CLIENT_ID } from '../../config/env';
import { decodeJwtPayload } from '../../utils/jwt';
import { useAuth } from '../../hooks/useAuth';

const SignupPage = () => {
  const navigate = useNavigate();
  const auth = useAuth();

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    terms: false,
  });
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const signupMutation = useMutation({
    mutationFn: signupApi,
    onSuccess: () => {
      setSuccessMessage('Account created. Sign in to start your first assessment.');
      setTimeout(() => navigate('/login'), 500);
    },
  });

  const googleMutation = useMutation({
    mutationFn: googleLoginApi,
    onSuccess: (payload, credential) => {
      const decoded = decodeJwtPayload(credential);
      auth.login({
        ...payload,
        name: decoded?.name,
        email: decoded?.email,
      });
      navigate('/dashboard');
    },
  });

  const errorMessage = useMemo(
    () => formError || signupMutation.error?.message || googleMutation.error?.message || '',
    [formError, signupMutation.error?.message, googleMutation.error?.message]
  );

  if (auth.isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleChange = (event) => {
    setFormError('');
    setSuccessMessage('');

    const { name, value, checked, type } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setFormError('');
    setSuccessMessage('');

    if (!form.name || !form.email || !form.password) {
      setFormError('Complete all required fields.');
      return;
    }

    if (form.password.length < 6) {
      setFormError('Password must be at least 6 characters.');
      return;
    }

    if (!form.terms) {
      setFormError('Accept terms and conditions to continue.');
      return;
    }

    signupMutation.mutate({
      name: form.name,
      email: form.email,
      password: form.password,
    });
  };

  const handleGoogleSuccess = (credentialResponse) => {
    if (!credentialResponse?.credential) {
      setFormError('Google sign-up failed. Please retry.');
      return;
    }

    googleMutation.mutate(credentialResponse.credential);
  };

  return (
    <main className="auth-page">
      <div className="auth-page__content">
        <ScaleIn as="section" className="hero-panel" from={0.97}>
          <p className="hero-panel__eyebrow">Personality Assessor</p>
          <h1 className="hero-panel__title">Build your profile and unlock personalized insights</h1>
          <p className="hero-panel__subtitle">
            Create your account to track assessments over time and prepare for advanced analytics.
          </p>
        </ScaleIn>

        <Card className="auth-card" title="Create Account" subtitle="Get started in under a minute">
          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            <label className="auth-form__field">
              <span>Full Name</span>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Alex Johnson"
                autoComplete="name"
                required
              />
            </label>

            <label className="auth-form__field">
              <span>Email</span>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </label>

            <label className="auth-form__field">
              <span>Password</span>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="Minimum 6 characters"
                autoComplete="new-password"
                required
              />
            </label>

            <label className="auth-form__check">
              <input
                type="checkbox"
                name="terms"
                checked={form.terms}
                onChange={handleChange}
              />
              <span>I agree to the terms and conditions</span>
            </label>

            {errorMessage && <p className="ui-message ui-message--error">{errorMessage}</p>}
            {successMessage && <p className="ui-message ui-message--success">{successMessage}</p>}

            <Button type="submit" loading={signupMutation.isPending || googleMutation.isPending} block>
              Create Account
            </Button>
          </form>

          {GOOGLE_CLIENT_ID && (
            <div className="auth-google">
              <p className="auth-google__divider">or continue with</p>
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setFormError('Google sign-up failed. Please retry.')}
                theme="outline"
                size="large"
                shape="pill"
                text="continue_with"
              />
            </div>
          )}

          <p className="auth-footer-text">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </Card>
      </div>
    </main>
  );
};

export default SignupPage;
