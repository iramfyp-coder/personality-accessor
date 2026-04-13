import React, { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useMutation } from '@tanstack/react-query';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import ScaleIn from '../../components/motion/ScaleIn';
import { login as loginApi, googleLogin as googleLoginApi } from '../../api/authApi';
import { GOOGLE_CLIENT_ID } from '../../config/env';
import { decodeJwtPayload } from '../../utils/jwt';
import { useAuth } from '../../hooks/useAuth';

const LoginPage = () => {
  const navigate = useNavigate();
  const auth = useAuth();

  const [form, setForm] = useState({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');

  const loginMutation = useMutation({
    mutationFn: loginApi,
    onSuccess: (payload) => {
      auth.login({
        ...payload,
        email: form.email,
      });
      navigate('/dashboard');
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
    () => formError || loginMutation.error?.message || googleMutation.error?.message || '',
    [formError, loginMutation.error?.message, googleMutation.error?.message]
  );

  if (auth.isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleChange = (event) => {
    setFormError('');
    const { name, value } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setFormError('');

    if (!form.email || !form.password) {
      setFormError('Enter both email and password.');
      return;
    }

    loginMutation.mutate({
      email: form.email,
      password: form.password,
    });
  };

  const handleGoogleSuccess = (credentialResponse) => {
    if (!credentialResponse?.credential) {
      setFormError('Google sign-in failed. Please retry.');
      return;
    }

    googleMutation.mutate(credentialResponse.credential);
  };

  return (
    <main className="auth-page">
      <div className="auth-page__content">
        <ScaleIn as="section" className="hero-panel" from={0.97}>
          <p className="hero-panel__eyebrow">Personality Assessor</p>
          <h1 className="hero-panel__title">Sign in to continue your growth journey</h1>
          <p className="hero-panel__subtitle">
            Access your assessment history, compare trait trends, and resume unfinished sessions.
          </p>
        </ScaleIn>

        <Card className="auth-card" title="Welcome Back" subtitle="Use your account credentials">
          <form onSubmit={handleSubmit} className="auth-form" noValidate>
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
              <div className="auth-form__password-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="auth-form__password-toggle"
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </label>

            {errorMessage && <p className="ui-message ui-message--error">{errorMessage}</p>}

            <Button type="submit" loading={loginMutation.isPending || googleMutation.isPending} block>
              Sign In
            </Button>
          </form>

          {GOOGLE_CLIENT_ID && (
            <div className="auth-google">
              <p className="auth-google__divider">or continue with</p>
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setFormError('Google sign-in failed. Please retry.')}
                theme="outline"
                size="large"
                shape="pill"
                text="continue_with"
              />
            </div>
          )}

          <p className="auth-footer-text">
            New here? <Link to="/signup">Create an account</Link>
          </p>
        </Card>
      </div>
    </main>
  );
};

export default LoginPage;
