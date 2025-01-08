'use client';

import React from 'react';
import dynamic from 'next/dynamic';

const ATSOptimizer = dynamic(() => import('../components/ATSOptimizer'), {
  ssr: false
});

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50">
      <ATSOptimizer />
    </main>
  );
}