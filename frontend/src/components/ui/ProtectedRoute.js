import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import Skeleton from './Skeleton';

const ProtectedRoute = ({ children }) => {
  const auth = useAuth();
  const location = useLocation();

  if (auth.isProfileLoading) {
    return (
      <main className="app-page">
        <div className="page-shell">
          <Skeleton height="220px" />
        </div>
      </main>
    );
  }

  if (!auth.isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
};

export default ProtectedRoute;
