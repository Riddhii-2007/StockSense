import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Lock, Mail, ArrowRight, Loader2, Sparkles } from 'lucide-react';

const DEMO_USERS = [
  { email: 'admin@stocksense.com', password: 'admin123', role: 'ADMIN', name: 'Aarav Shah' },
  { email: 'manager@stocksense.com', password: 'manager123', role: 'MANAGER', name: 'Meera Iyer' },
  { email: 'staff@stocksense.com', password: 'staff123', role: 'STAFF', name: 'Rohan Das' },
];

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const navigate = useNavigate();

  // If already logged in (has token), go to dashboard
  useEffect(() => {
    if (localStorage.getItem('token')) {
      navigate('/dashboard');
    }
  }, [navigate]);

  const handleLogin = async (e, credentials = null) => {
    if (e) e.preventDefault();
    
    setIsLoading(true);
    setError(null);
    
    const loginEmail = credentials ? credentials.email : email;
    const loginPassword = credentials ? credentials.password : password;

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Login failed');
      }

      // Store auth info
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      // Redirect to dashboard
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = (user) => {
    setEmail(user.email);
    setPassword(user.password);
    handleLogin(null, user);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 selection:bg-indigo-500/30">
      
      {/* Background decorations */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -right-1/4 w-[1000px] h-[1000px] rounded-full bg-indigo-50/50 blur-3xl opacity-50"></div>
        <div className="absolute -bottom-1/2 -left-1/4 w-[800px] h-[800px] rounded-full bg-blue-50/50 blur-3xl opacity-50"></div>
      </div>

      <div className="w-full max-w-5xl flex flex-col md:flex-row bg-white rounded-3xl shadow-xl overflow-hidden z-10 border border-slate-100/50 animate-in fade-in zoom-in-95 duration-700 ease-out">
        
        {/* Left Side - Branding */}
        <div className="w-full md:w-5/12 bg-indigo-600 p-12 text-white flex flex-col justify-between relative overflow-hidden hidden md:flex">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-indigo-900 opacity-90 z-0"></div>
          
          {/* Abstract pattern */}
          <svg className="absolute top-0 right-0 text-white/5 transform translate-x-1/3 -translate-y-1/3 w-[500px] h-[500px]" fill="currentColor" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="40" />
            <circle cx="50" cy="50" r="30" fill="transparent" stroke="currentColor" strokeWidth="2" />
            <path d="M10 50 L90 50 M50 10 L50 90" stroke="currentColor" strokeWidth="2" />
          </svg>

          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-16">
              <div className="bg-white/10 p-2.5 rounded-xl backdrop-blur-md border border-white/20 shadow-lg">
                <Package className="w-8 h-8 text-white" />
              </div>
              <span className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-indigo-200">StockSense</span>
            </div>
            
            <div className="space-y-6">
              <h1 className="text-4xl font-bold leading-tight">
                Intelligent<br/>inventory<br/>management.
              </h1>
              <p className="text-indigo-200 text-lg max-w-sm font-medium">
                Manage stock, automate transfers, and gain realtime insights.
              </p>
            </div>
          </div>
          
          <div className="relative z-10">
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="w-8 h-8 rounded-full bg-white/20 border-2 border-indigo-600 backdrop-blur-sm"></div>
                ))}
              </div>
              <span className="text-sm font-medium text-indigo-200">Trusted by modern warehouses</span>
            </div>
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="w-full md:w-7/12 p-8 md:p-16 flex flex-col justify-center bg-white relative">
          
          <div className="md:hidden flex items-center gap-3 mb-8">
            <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600">
              <Package className="w-6 h-6" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">StockSense</span>
          </div>

          <div className="max-w-md w-full mx-auto">
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Welcome back</h2>
            <p className="text-slate-500 mt-2 font-medium">Sign in to your account to continue</p>
            
            {error && (
              <div className="mt-6 p-4 rounded-xl bg-red-50 text-red-600 text-sm font-semibold border border-red-100 flex items-center animate-in slide-in-from-top-2">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="mt-8 space-y-5">
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-slate-700">Email Address</label>
                <div className="relative">
                  <Mail className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium placeholder:text-slate-400"
                    placeholder="name@company.com"
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-bold text-slate-700">Password</label>
                  <a href="#" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">Forgot password?</a>
                </div>
                <div className="relative">
                  <Lock className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium placeholder:text-slate-400"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 mt-4 bg-slate-900 text-white rounded-xl font-bold shadow-lg shadow-slate-900/20 hover:bg-slate-800 hover:shadow-slate-900/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2 group disabled:opacity-70 disabled:pointer-events-none"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-10 pt-8 border-t border-slate-100">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <p className="text-sm font-bold text-slate-900">Demo Access</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {DEMO_USERS.map(user => (
                  <button
                    key={user.email}
                    onClick={() => handleDemoLogin(user)}
                    disabled={isLoading}
                    className="flex flex-col items-start p-3 rounded-xl border border-slate-200 bg-white hover:border-indigo-600 hover:shadow-md hover:shadow-indigo-600/5 transition-all group disabled:opacity-50 text-left"
                  >
                    <span className="text-xs font-bold text-indigo-600 group-hover:text-indigo-700">{user.role}</span>
                    <span className="text-sm font-semibold text-slate-900 mt-1 truncate w-full">{user.name}</span>
                    <span className="text-[10px] text-slate-500 truncate w-full mt-0.5">{user.email}</span>
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
