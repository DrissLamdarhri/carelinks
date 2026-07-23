import { useState } from "react";
import { PsychologistPlansManager } from "../src/app/components/PsychologistPlansManager";

/**
 * Test component to verify PsychologistPlansManager works
 * Run: pnpm dev, then navigate to /test-plans
 */
export function TestPlansManager() {
  const [isLoaded, setIsLoaded] = useState(true);

  if (!isLoaded) {
    return (
      <div className="p-8">
        <p>Component failed to load</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-gray-900">
          Test: Psychologist Plans Manager
        </h1>

        {/* Component test */}
        <div className="bg-white rounded-xl shadow-lg">
          <PsychologistPlansManager />
        </div>

        {/* Info box */}
        <div className="mt-8 bg-blue-50 p-4 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-900">
            <strong>Note:</strong> This is a test page. In production, this component 
            is accessible from the Admin Panel under "Plans d'appointment" tab.
          </p>
        </div>
      </div>
    </div>
  );
}
