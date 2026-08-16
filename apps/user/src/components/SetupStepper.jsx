import { Link, useLocation } from 'react-router-dom';
import { Check } from 'lucide-react';
import { SETUP_STEPS, getStepByPath } from '../lib/setupSteps';

function stepDone(stepId, progress, currentIndex, stepIndex) {
  if (stepIndex < currentIndex) return true;
  switch (stepId) {
    case 'domain':
      return progress.hasVerifiedDomain;
    case 'knowledge':
      return progress.hasKnowledge;
    case 'api-key':
      return progress.hasApiKey;
    case 'platform':
      return progress.hasPlatform;
    case 'customize':
      return progress.complete;
    default:
      return false;
  }
}

export default function SetupStepper({ progress }) {
  const { pathname } = useLocation();
  const current = getStepByPath(pathname);
  const currentIndex = SETUP_STEPS.findIndex((s) => s.id === current.id);

  return (
    <nav className="setup-stepper" aria-label="خطوات الإعداد">
      <div className="setup-stepper-track">
        {SETUP_STEPS.map((step, index) => {
          const done = stepDone(step.id, progress, currentIndex, index);
          const active = step.id === current.id;
          const reachable = index === 0 || progress.hasVerifiedDomain;

          return (
            <Link
              key={step.id}
              to={step.path}
              className={`setup-step${active ? ' is-active' : ''}${done ? ' is-done' : ''}${!reachable ? ' is-locked' : ''}`}
              aria-current={active ? 'step' : undefined}
              onClick={(e) => {
                if (!reachable) e.preventDefault();
              }}
            >
              <span className="setup-step-dot">
                {done && !active ? <Check size={12} strokeWidth={3} /> : step.shortLabel}
              </span>
              <span className="setup-step-label">{step.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
