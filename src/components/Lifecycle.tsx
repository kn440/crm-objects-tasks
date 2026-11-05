import { STATUS_HEX, type TaskStatus } from '../domain/transitions';

const STEPS: { key: TaskStatus; label: string }[] = [
  { key: 'new', label: 'Новая' },
  { key: 'in_progress', label: 'В работе' },
  { key: 'review', label: 'На проверке' },
  { key: 'accepted', label: 'Принята' },
];

/** Где задача на пути «Новая → В работе → На проверке → Принята» */
export function Lifecycle({ status }: { status: TaskStatus }) {
  // «На доработке» — это возврат на этап «В работе»
  const position = status === 'rework' ? 1 : STEPS.findIndex((s) => s.key === status);
  const muted = status === 'cancelled';

  return (
    <div>
      <div className="lifecycle" data-muted={muted} aria-label="Этапы задачи">
        {STEPS.map((step, i) => {
          const state = muted ? 'todo' : i < position ? 'done' : i === position ? 'current' : 'todo';
          const isRework = status === 'rework' && i === position;
          const color = isRework ? STATUS_HEX.rework : STATUS_HEX[step.key];
          return (
            <div
              key={step.key}
              className="lifecycle-step"
              data-state={state}
              style={{ ['--step-color' as string]: color }}
              aria-current={state === 'current' ? 'step' : undefined}
            >
              <div className="lifecycle-bar" />
              <span className="lifecycle-label">{isRework ? 'На доработке' : step.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
