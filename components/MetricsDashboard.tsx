import React, { useState, useEffect } from 'react';
import { BarChart3 } from 'lucide-react';
import * as db from '../lib/db';
import { AppSettings } from '../types';

interface MetricsDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
}

export default function MetricsDashboard({ isOpen, onClose }: MetricsDashboardProps) {
  const [quotas, setQuotas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadQuotas = async () => {
      const allQuotas = db.getAllQuotas();
      setQuotas(allQuotas);
      setLoading(false);
    };

    if (isOpen) {
      loadQuotas();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const providers = ['google', 'openai', 'anthropic', 'groq', 'xai'];
  const quotaData = quotas.reduce((acc: Record<string, any>, q: any) => {
    acc[q.provider] = {
      used: q.used || 0,
      limit: q.limit_ || 1000,
      resetTime: q.resetTime || 0,
    };
    return acc;
  }, {});

  return (
    <div className='fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4'>
      <div className='neo-panel rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6'>
        <div className='flex items-center justify-between'>
          <h2 className='text-2xl font-bold text-white flex items-center gap-2'>
            <BarChart3 size={28} />
            API Quotas & Metrics
          </h2>
          <button
            onClick={onClose}
            className='text-slate-400 hover:text-white text-2xl'
          >
            X
          </button>
        </div>

        {loading ? (
          <p className='text-center text-slate-400'>Loading metrics...</p>
        ) : (
          <div className='space-y-4'>
            {providers.map((provider) => {
              const quota = quotaData[provider];
              const usage = quota ? (quota.used / quota.limit) * 100 : 0;
              const status = usage > 80 ? 'critical' : usage > 50 ? 'warning' : 'ok';

              return (
                <div key={provider} className='border border-slate-700/60 rounded-lg p-4 space-y-2 bg-slate-900/60'>
                  <div className='flex items-center justify-between'>
                    <h3 className='text-lg font-semibold capitalize text-slate-100'>{provider}</h3>
                    <span className={`text-sm px-3 py-1 rounded ${
                      status === 'critical' ? 'bg-red-900/40 text-red-300' :
                      status === 'warning' ? 'bg-amber-900/40 text-amber-300' :
                      'bg-emerald-900/40 text-emerald-300'
                    }`}>
                      {Math.round(usage)}%
                    </span>
                  </div>

                  <div className='w-full bg-slate-800/70 rounded-full h-3 overflow-hidden'>
                    <div
                      className={`h-full transition-all ${
                        status === 'critical' ? 'bg-red-500' :
                        status === 'warning' ? 'bg-amber-500' :
                        'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(usage, 100)}%` }}
                    />
                  </div>

                  <p className='text-sm text-slate-400'>
                    {quota ? `${quota.used} / ${quota.limit} requests used` : 'No data available'}
                  </p>

                  {quota && quota.resetTime && (
                    <p className='text-xs text-slate-500'>
                      Resets: {new Date(quota.resetTime).toLocaleString()}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <button
          onClick={onClose}
          className='w-full px-4 py-2 bg-slate-700/70 text-slate-100 rounded hover:bg-slate-600/70 transition'
        >
          Close
        </button>
      </div>
    </div>
  );
}
