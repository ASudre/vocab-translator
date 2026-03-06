'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

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
          <Image 
            src="/icon.svg" 
            alt="Palabras" 
            width={96}
            height={96}
            className="mx-auto animate-pulse"
          />
        </div>
        
        <h1 className="text-3xl font-bold text-white mb-2">Palabras</h1>
        <p className="text-indigo-100 text-sm">Quien tiene palabras, tiene voz</p>
      </div>
    </div>
  );
}
