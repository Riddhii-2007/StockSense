import { useState } from 'react';
import { Sparkles, Mic, Zap } from 'lucide-react';
import { api } from '../../services/api';
import TransactionPreview from './TransactionPreview';

const CommandBar = ({ onRefresh }) => {
  const [command, setCommand] = useState('Move 30 Steel Rods from Main Store to Production Rack');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [simulationState, setSimulationState] = useState(null);

  const handleAnalyze = async () => {
    if (!command.trim()) return;
    setIsAnalyzing(true);
    setSimulationState(null);
    try {
      const result = await api.analyzeCommand(command);
      setSimulationState(result);
    } catch (err) {
      console.error(err);
      setSimulationState({
        isValid: false,
        reason: err.message
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleConfirm = async () => {
    if (!simulationState || !simulationState.isValid || !simulationState.normalizedPayload) return;
    
    setIsCommitting(true);
    try {
      await api.executeTransfer(simulationState.normalizedPayload);
      setSimulationState(null);
      setCommand('');
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error(err);
      alert('Failed to commit transaction: ' + err.message);
    } finally {
      setIsCommitting(false);
    }
  };

  const handleCancel = () => {
    setSimulationState(null);
  };

  const handleModify = () => {
    setSimulationState(null);
  };

  const applySuggestion = (text) => {
    setCommand(text);
    setSimulationState(null);
  };

  return (
    <div className="flex flex-col space-y-4">
      {/* Master Card */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">What happened in the warehouse?</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Describe an inventory action in plain language. StockSense will validate and preview the impact before anything is committed.
            </p>
          </div>
        </div>

        {/* Input Terminal */}
        <div className={`relative flex flex-col md:flex-row items-stretch md:items-center gap-2 bg-slate-50 border rounded-xl p-2 transition-all duration-300 ${
          isAnalyzing ? 'border-indigo-400 ring-4 ring-indigo-50 shadow-md shadow-indigo-100' : 'border-slate-200 focus-within:ring-4 focus-within:ring-slate-100 focus-within:border-slate-300'
        }`}>
          <div className="flex items-center flex-1 px-3 py-1 gap-3">
            <div className="relative flex items-center justify-center w-6 h-6">
              <Sparkles className={`w-5 h-5 text-indigo-500 absolute transition-all duration-500 ${isAnalyzing ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}`} />
              <div className={`w-4 h-4 rounded-full border-2 border-indigo-200 border-t-indigo-600 absolute transition-all duration-500 ${isAnalyzing ? 'animate-spin opacity-100 scale-100' : 'opacity-0 scale-0'}`}></div>
            </div>
            <input 
              type="text" 
              className="w-full bg-transparent text-slate-900 placeholder:text-slate-400 focus:outline-none font-medium text-base transition-colors"
              placeholder="e.g. Move 30 Steel Rods from Main Store to Production Rack..."
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
              disabled={isAnalyzing}
            />
          </div>
          <div className="flex items-center justify-between md:justify-end gap-2 px-1">
            <button className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition-colors">
              <Mic className="w-4 h-4" />
              <span className="text-xs font-semibold">Voice</span>
            </button>
            <button 
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              className={`flex items-center justify-center gap-2 px-5 py-2 rounded-lg font-semibold text-sm shadow-sm transition-all duration-300 ${
                isAnalyzing ? 'bg-indigo-50 text-indigo-700 cursor-not-allowed' : 'bg-slate-900 text-white hover:bg-slate-800 active:scale-95'
              }`}
            >
              {isAnalyzing ? (
                <span>Validating...</span>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  <span>Analyze</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Suggestions */}
        <div className="flex items-center gap-2 pt-2 text-sm flex-wrap">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-2">Suggestions:</span>
          <button 
            onClick={() => applySuggestion('Move 30 Steel Rods from Main Store to Production Rack')}
            className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
          >
            Move stock
          </button>
          <button 
            onClick={() => applySuggestion('Receive 120 Copper Wire into Main Store')}
            className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
          >
            Receive inventory
          </button>
          <button 
            onClick={() => applySuggestion('Deliver 40 Packaging Frames to Customer')}
            className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
          >
            Deliver goods
          </button>
          <button 
            onClick={() => applySuggestion('Adjust Steel Bolts in Production Rack by -3')}
            className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
          >
            Adjust stock
          </button>
          
          <button 
            onClick={() => applySuggestion('Move 150 Steel Rods from Main Store to Production Rack')}
            className="px-3 py-1 rounded-full bg-red-50 text-red-700 text-xs font-semibold hover:bg-red-100 transition-colors ml-auto border border-red-100"
          >
            ⚠ Blocked Demo
          </button>
        </div>
      </div>

      <TransactionPreview 
        simulationState={simulationState} 
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        onModify={handleModify}
        isCommitting={isCommitting}
      />
    </div>
  );
};

export default CommandBar;
