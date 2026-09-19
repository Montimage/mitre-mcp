/**
 * StatusBanner Component
 *
 * One renderer for every transient outcome in the settings dialog — the
 * connection probes and the save/apply error (F-UX-008). Feedback semantics
 * are real, not colour-only: errors announce assertively (role="alert" with
 * a warning icon), successes and notes announce politely (role="status" with
 * a check / info icon), and each type carries its own palette so the states
 * no longer differ by a single step of grey.
 */

const TYPE_STYLES = {
  success: {
    role: 'status',
    classes: 'bg-green-50 text-green-900 border-green-400',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    )
  },
  error: {
    role: 'alert',
    classes: 'bg-red-50 text-red-900 border-red-400',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    )
  },
  info: {
    role: 'status',
    classes: 'bg-gray-50 text-gray-900 border-gray-300',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    )
  }
};

export default function StatusBanner({ result }) {
  if (!result) return null;
  const { role, classes, icon } = TYPE_STYLES[result.type] || TYPE_STYLES.info;

  return (
    <div role={role} className={`mb-4 p-3 text-xs border whitespace-pre-line flex items-start gap-2 ${classes}`}>
      <svg aria-hidden="true" className="w-4 h-4 shrink-0 mt-px" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        {icon}
      </svg>
      <span>{result.message}</span>
    </div>
  );
}
