import React from 'react';
import { GoogleLogin } from '@react-oauth/google';

const GoogleLoginButton = ({ onCredential, onError }) => {
  const handleSuccess = (credentialResponse) => {
    const idToken = credentialResponse?.credential;

    if (!idToken) {
      onError?.('Google sign-in failed. No ID token returned.');
      return;
    }

    onCredential?.(idToken);
  };

  return (
    <GoogleLogin
      onSuccess={handleSuccess}
      onError={() => onError?.('Google popup closed before sign-in completed.')}
      theme="outline"
      size="large"
      shape="pill"
      text="continue_with"
    />
  );
};

export default GoogleLoginButton;
