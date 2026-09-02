'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await fetch('/api/auth/session');
        if (response.ok) {
          // User is logged in, go to dashboard
          router.replace('/dashboard');
        } else {
          // Not logged in, go to login
          router.replace('/login');
        }
      } catch (error) {
        console.error('Session check error:', error);
        router.replace('/login');
      }
    };

    checkSession();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
        <p className="text-ink-soft">로딩 중...</p>
      </div>
    </div>
  );
}

/* OLD CODE - MVP Version
'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';

interface BlogResult {
  content: string;
  imageKeywords: string[];
}

function OldHome() {
  const [topic, setTopic] = useState('');
  const [keywords, setKeywords] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<BlogResult | null>(null);
  const [showKeywords, setShowKeywords] = useState(false);

*/
