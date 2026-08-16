import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowLeft, Check } from 'lucide-react';
import { getNextStep, getPrevStep, SETUP_STEPS } from '../lib/setupSteps';

export default function SetupStepNav({
  stepId,
  progress,
  onContinue,
  continueLabel = 'التالي',
  continueDisabled = false,
  showSkip = false,
  skipTo,
  skipLabel = 'تخطي',
}) {
  const prev = getPrevStep(stepId);
  const next = getNextStep(stepId);

  return (
    <div className="setup-step-nav">
      <div className="setup-step-nav-start">
        {prev ? (
          <Link to={prev.path} className="btn btn-secondary">
            <ArrowRight size={14} /> {prev.label}
          </Link>
        ) : (
          <span />
        )}
      </div>
      <div className="setup-step-nav-end">
        {showSkip && skipTo && (
          <Link to={skipTo} className="btn btn-ghost">
            {skipLabel}
          </Link>
        )}
        {onContinue ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={onContinue}
            disabled={continueDisabled}
          >
            {continueLabel} <ArrowLeft size={14} />
          </button>
        ) : next ? (
          <Link
            to={next.path}
            className="btn btn-primary"
            onClick={(e) => {
              if (continueDisabled) e.preventDefault();
            }}
            aria-disabled={continueDisabled}
            style={continueDisabled ? { opacity: 0.5, pointerEvents: 'none' } : undefined}
          >
            {continueLabel} <ArrowLeft size={14} />
          </Link>
        ) : (
          <Link to="/overview" className="btn btn-primary">
            <Check size={14} /> إنهاء الإعداد
          </Link>
        )}
      </div>
    </div>
  );
}

export function SetupStepHeader({ step, progress }) {
  return (
    <div className="setup-step-header">
      <div>
        <div className="setup-step-kicker">الخطوة {step.shortLabel} من {SETUP_STEPS.length}</div>
        <h2>{step.label}</h2>
        <p>{step.description}</p>
      </div>
      {progress.complete && (
        <span className="badge badge-green">
          <Check size={11} /> الإعداد مكتمل
        </span>
      )}
    </div>
  );
}
