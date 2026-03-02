'use client';

import { useEffect, useState } from 'react';

export function Loading() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-indigo-600 to-purple-700">
      <div className="text-center">
        <div className="mb-8 relative">
          <svg
            className="w-24 h-24 mx-auto"
            viewBox="0 0 100 100"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="bookGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style={{ stopColor: '#ffffff', stopOpacity: 0.9 }} />
                <stop offset="100%" style={{ stopColor: '#e0e7ff', stopOpacity: 0.9 }} />
              </linearGradient>
            </defs>
            
            <circle cx="50" cy="50" r="48" fill="rgba(255,255,255,0.1)"/>
            
            <path
              d="M 25 35 Q 25 32 28 32 L 47 32 Q 50 32 50 35 L 50 68 Q 50 70 47 70 L 28 70 Q 25 70 25 68 Z"
              fill="url(#bookGrad)"
              className="animate-pulse"
            />
            <path
              d="M 75 35 Q 75 32 72 32 L 53 32 Q 50 32 50 35 L 50 68 Q 50 70 53 70 L 72 70 Q 75 70 75 68 Z"
              fill="url(#bookGrad)"
              className="animate-pulse"
            />
            
            <rect x="49" y="32" width="2" height="38" fill="#E0E7FF"/>
            
            <line x1="30" y1="40" x2="45" y2="40" stroke="#4F46E5" strokeWidth="1.5" strokeLinecap="round" className="animate-pulse"/>
            <line x1="30" y1="46" x2="45" y2="46" stroke="#4F46E5" strokeWidth="1.5" strokeLinecap="round" className="animate-pulse" style={{ animationDelay: '0.1s' }}/>
            <line x1="30" y1="52" x2="42" y2="52" stroke="#4F46E5" strokeWidth="1.5" strokeLinecap="round" className="animate-pulse" style={{ animationDelay: '0.2s' }}/>
            
            <line x1="55" y1="40" x2="70" y2="40" stroke="#7C3AED" strokeWidth="1.5" strokeLinecap="round" className="animate-pulse"/>
            <line x1="55" y1="46" x2="70" y2="46" stroke="#7C3AED" strokeWidth="1.5" strokeLinecap="round" className="animate-pulse" style={{ animationDelay: '0.1s' }}/>
            <line x1="55" y1="52" x2="68" y2="52" stroke="#7C3AED" strokeWidth="1.5" strokeLinecap="round" className="animate-pulse" style={{ animationDelay: '0.2s' }}/>
            
            <line x1="30" y1="58" x2="45" y2="58" stroke="#4F46E5" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" className="animate-pulse" style={{ animationDelay: '0.3s' }}/>
            <line x1="55" y1="58" x2="70" y2="58" stroke="#7C3AED" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" className="animate-pulse" style={{ animationDelay: '0.3s' }}/>
            <line x1="30" y1="64" x2="42" y2="64" stroke="#4F46E5" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" className="animate-pulse" style={{ animationDelay: '0.4s' }}/>
            <line x1="55" y1="64" x2="67" y2="64" stroke="#7C3AED" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" className="animate-pulse" style={{ animationDelay: '0.4s' }}/>
          </svg>
          
          <div className="mt-4 flex justify-center space-x-1">
            <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
            <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
        </div>
        
        <h1 className="text-3xl font-bold text-white mb-2">Vocab Translator</h1>
        <p className="text-indigo-100 text-sm">Loading your vocabulary...</p>
      </div>
    </div>
  );
}
