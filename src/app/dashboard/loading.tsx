"use client";

import { useEffect, useState } from 'react';
import DashboardLoadingOverlay from '@/components/dashboard/DashboardLoadingOverlay';

export default function DashboardLoading() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShow(true), 500);
    return () => clearTimeout(t);
  }, []);

  if (!show) return null;
  return <DashboardLoadingOverlay />;
}
