import PageShell from '../components/layout/PageShell';

const PlaceholderPage = ({ title, subtitle }) => {
  return (
    <PageShell title={title} subtitle={subtitle}>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">{title} under construction</h2>
        <p className="text-slate-500 text-center max-w-md">
          This module is part of the established frontend architecture. The backend integration and business logic will be implemented in a future phase.
        </p>
      </div>
    </PageShell>
  );
};

export default PlaceholderPage;
