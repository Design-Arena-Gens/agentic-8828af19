'use client';

import { useState } from 'react';
import { AVAILABLE_MODELS } from '@/lib/models';
import { AIModel, ModelResponse, CrossEvaluation } from '@/lib/types';

export default function Home() {
  const [selectedModels, setSelectedModels] = useState<AIModel[]>([]);
  const [promptText, setPromptText] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState('');
  const [responses, setResponses] = useState<ModelResponse[]>([]);
  const [crossEvaluations, setCrossEvaluations] = useState<CrossEvaluation[]>([]);
  const [topThree, setTopThree] = useState<ModelResponse[]>([]);
  const [geminiRanking, setGeminiRanking] = useState<any>(null);
  const [userChoice, setUserChoice] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);

  const toggleModel = (model: AIModel) => {
    if (selectedModels.find(m => m.id === model.id)) {
      setSelectedModels(selectedModels.filter(m => m.id !== model.id));
    } else {
      if (selectedModels.length < 5) {
        setSelectedModels([...selectedModels, model]);
      }
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImages(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const runTest = async () => {
    if (selectedModels.length < 4 || !promptText.trim()) {
      alert('Please select 4-5 models and enter a prompt');
      return;
    }

    setIsProcessing(true);
    setShowResults(false);
    setResponses([]);
    setCrossEvaluations([]);
    setTopThree([]);
    setGeminiRanking(null);
    setUserChoice(null);

    try {
      // Step 1: Generate responses from all selected models
      setCurrentStep('Generating responses from all models...');
      const modelResponses: ModelResponse[] = [];

      for (const model of selectedModels) {
        setCurrentStep(`Generating response from ${model.name}...`);
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            modelId: model.id,
            provider: model.provider,
            prompt: promptText,
            images: images.length > 0 ? images : undefined,
          }),
        });

        const data = await res.json();
        modelResponses.push({
          modelId: model.id,
          modelName: model.name,
          response: data.response,
          timestamp: Date.now(),
        });
      }

      setResponses(modelResponses);

      // Step 2: Cross-evaluate all responses
      setCurrentStep('Cross-evaluating all responses...');
      const evaluations: CrossEvaluation[] = [];

      for (const evaluator of selectedModels) {
        for (const responseToEval of modelResponses) {
          if (evaluator.id === responseToEval.modelId) continue;

          setCurrentStep(`${evaluator.name} evaluating ${responseToEval.modelName}...`);

          const res = await fetch('/api/evaluate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              evaluatorProvider: evaluator.provider,
              evaluatorModelId: evaluator.id,
              originalPrompt: promptText,
              responseToEvaluate: responseToEval.response,
              responseModelName: responseToEval.modelName,
            }),
          });

          const data = await res.json();
          evaluations.push({
            evaluatorModelId: evaluator.id,
            evaluatedModelId: responseToEval.modelId,
            score: data.score,
            reasoning: data.reasoning,
          });
        }
      }

      setCrossEvaluations(evaluations);

      // Step 3: Calculate average scores and get top 3
      setCurrentStep('Calculating top 3 responses...');
      const avgScores = modelResponses.map(resp => {
        const scores = evaluations
          .filter(e => e.evaluatedModelId === resp.modelId)
          .map(e => e.score);
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        return { ...resp, avgScore: avg };
      });

      const top3 = avgScores.sort((a, b) => b.avgScore - a.avgScore).slice(0, 3);
      setTopThree(top3);

      // Step 4: Get Gemini final ranking
      setCurrentStep('Getting Gemini 1.5 Pro final ranking...');
      const rankRes = await fetch('/api/final-rank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalPrompt: promptText,
          topThreeResponses: top3,
        }),
      });

      const ranking = await rankRes.json();
      setGeminiRanking(ranking);

      setCurrentStep('Complete!');
      setShowResults(true);
    } catch (error) {
      console.error('Test error:', error);
      alert('An error occurred during testing');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUserChoice = (modelId: string) => {
    setUserChoice(modelId);
  };

  const getAlignment = () => {
    if (!userChoice || !geminiRanking) return null;

    const matches = userChoice === geminiRanking.first;
    let position = 0;

    if (userChoice === geminiRanking.first) position = 1;
    else if (userChoice === geminiRanking.second) position = 2;
    else if (userChoice === geminiRanking.third) position = 3;

    return { matches, position };
  };

  const alignment = getAlignment();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-5xl font-bold mb-3 text-center bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
          AI Model Ranking Platform
        </h1>
        <p className="text-center text-gray-300 mb-8">Test, Compare & Rank Multimodal AI Models</p>

        {/* Model Selection */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-6 mb-6 border border-purple-500/20">
          <h2 className="text-2xl font-semibold mb-4">
            Select Models ({selectedModels.length}/5)
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {AVAILABLE_MODELS.map(model => (
              <button
                key={model.id}
                onClick={() => toggleModel(model)}
                disabled={!selectedModels.find(m => m.id === model.id) && selectedModels.length >= 5}
                className={`p-4 rounded-lg border-2 transition-all ${
                  selectedModels.find(m => m.id === model.id)
                    ? 'border-purple-500 bg-purple-500/20'
                    : 'border-slate-600 bg-slate-700/30 hover:border-purple-400'
                } ${
                  !selectedModels.find(m => m.id === model.id) && selectedModels.length >= 5
                    ? 'opacity-50 cursor-not-allowed'
                    : 'cursor-pointer'
                }`}
              >
                <div className="font-semibold text-sm">{model.name}</div>
                <div className="text-xs text-gray-400 mt-1">{model.provider}</div>
                {model.supportsVision && (
                  <div className="text-xs text-green-400 mt-1">📷 Vision</div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Prompt Input */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-6 mb-6 border border-purple-500/20">
          <h2 className="text-2xl font-semibold mb-4">Enter Prompt</h2>
          <textarea
            value={promptText}
            onChange={e => setPromptText(e.target.value)}
            placeholder="Enter your prompt here..."
            className="w-full h-32 bg-slate-700/50 border border-slate-600 rounded-lg p-4 text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
          />

          <div className="mt-4">
            <label className="block text-sm font-medium mb-2">Upload Images (Optional)</label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageUpload}
              className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-500 file:text-white hover:file:bg-purple-600 cursor-pointer"
            />
            {images.length > 0 && (
              <div className="flex flex-wrap gap-3 mt-4">
                {images.map((img, idx) => (
                  <div key={idx} className="relative">
                    <img src={img} alt={`Upload ${idx}`} className="w-24 h-24 object-cover rounded-lg" />
                    <button
                      onClick={() => removeImage(idx)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={runTest}
            disabled={isProcessing || selectedModels.length < 4 || !promptText.trim()}
            className="mt-6 w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white font-semibold py-3 px-6 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isProcessing ? currentStep : 'Run Test'}
          </button>
        </div>

        {/* Results */}
        {showResults && responses.length > 0 && (
          <>
            {/* All Responses */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-6 mb-6 border border-purple-500/20">
              <h2 className="text-2xl font-semibold mb-4">All Model Responses</h2>
              <div className="space-y-4">
                {responses.map((resp, idx) => {
                  const avgScore = crossEvaluations
                    .filter(e => e.evaluatedModelId === resp.modelId)
                    .reduce((sum, e) => sum + e.score, 0) /
                    crossEvaluations.filter(e => e.evaluatedModelId === resp.modelId).length;

                  return (
                    <div key={idx} className="bg-slate-700/30 rounded-lg p-4 border border-slate-600">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="text-lg font-semibold text-purple-300">{resp.modelName}</h3>
                        <span className="text-sm bg-purple-500/20 px-3 py-1 rounded-full">
                          Avg Score: {avgScore.toFixed(1)}/10
                        </span>
                      </div>
                      <p className="text-gray-300 text-sm whitespace-pre-wrap">{resp.response}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top 3 & Gemini Ranking */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-6 mb-6 border border-purple-500/20">
              <h2 className="text-2xl font-semibold mb-4">Top 3 Responses & Gemini 1.5 Pro Ranking</h2>

              {geminiRanking && (
                <div className="mb-6 bg-gradient-to-r from-blue-900/30 to-purple-900/30 rounded-lg p-4 border border-blue-500/30">
                  <h3 className="text-lg font-semibold mb-2 text-blue-300">Gemini 1.5 Pro Final Ranking:</h3>
                  <div className="space-y-1 mb-3">
                    <div className="text-yellow-300">🥇 1st: {responses.find(r => r.modelId === geminiRanking.first)?.modelName}</div>
                    <div className="text-gray-300">🥈 2nd: {responses.find(r => r.modelId === geminiRanking.second)?.modelName}</div>
                    <div className="text-orange-300">🥉 3rd: {responses.find(r => r.modelId === geminiRanking.third)?.modelName}</div>
                  </div>
                  <details className="text-sm text-gray-400">
                    <summary className="cursor-pointer hover:text-gray-300">View reasoning</summary>
                    <p className="mt-2 whitespace-pre-wrap">{geminiRanking.reasoning}</p>
                  </details>
                </div>
              )}

              <div className="space-y-4">
                {topThree.map((resp, idx) => (
                  <div
                    key={idx}
                    className={`bg-slate-700/30 rounded-lg p-4 border-2 ${
                      userChoice === resp.modelId ? 'border-green-500' : 'border-slate-600'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-lg font-semibold text-purple-300">
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'} {resp.modelName}
                      </h3>
                      <button
                        onClick={() => handleUserChoice(resp.modelId)}
                        className={`px-4 py-1 rounded-lg text-sm font-medium transition-all ${
                          userChoice === resp.modelId
                            ? 'bg-green-500 text-white'
                            : 'bg-slate-600 hover:bg-slate-500'
                        }`}
                      >
                        {userChoice === resp.modelId ? 'Selected ✓' : 'Select as Best'}
                      </button>
                    </div>
                    <p className="text-gray-300 text-sm whitespace-pre-wrap">{resp.response}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Alignment Analysis */}
            {alignment && (
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-6 border border-purple-500/20">
                <h2 className="text-2xl font-semibold mb-4">Alignment Analysis</h2>
                <div className={`p-6 rounded-lg ${alignment.matches ? 'bg-green-900/30 border border-green-500/50' : 'bg-orange-900/30 border border-orange-500/50'}`}>
                  <div className="text-lg mb-2">
                    {alignment.matches ? (
                      <span className="text-green-300">✓ Perfect Match!</span>
                    ) : (
                      <span className="text-orange-300">⚠ Different Choice</span>
                    )}
                  </div>
                  <p className="text-gray-300">
                    Your choice: <span className="font-semibold text-purple-300">{responses.find(r => r.modelId === userChoice)?.modelName}</span>
                  </p>
                  <p className="text-gray-300">
                    Gemini's 1st place: <span className="font-semibold text-blue-300">{responses.find(r => r.modelId === geminiRanking.first)?.modelName}</span>
                  </p>
                  {!alignment.matches && alignment.position > 0 && (
                    <p className="text-gray-400 mt-2 text-sm">
                      Your choice was ranked {alignment.position === 2 ? '2nd' : '3rd'} by Gemini
                    </p>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
