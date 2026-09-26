import Sidebar from './Sidebar';
import TopHeader from './TopHeader';

const PageShell = ({ title, subtitle, children }) => {
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased selection:bg-indigo-100 selection:text-indigo-900">
      <Sidebar />
      <div className="pl-64 flex flex-col min-h-screen">
        <TopHeader title={title} subtitle={subtitle} />
        <main className="flex-1 relative pt-16 w-full p-8 animate-fade-in">
          <div className="flex flex-col w-full max-w-[1600px] mx-auto space-y-8 pb-12">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default PageShell;
