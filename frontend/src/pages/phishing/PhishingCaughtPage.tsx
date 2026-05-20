import { useSearchParams } from 'react-router-dom';

const RED_FLAGS = [
  'Urgency or threats ("Act immediately", "Your account will be closed")',
  'Sender email domain doesn\'t match the real company',
  'Generic greetings ("Dear Employee") instead of your name',
  'Requests for credentials, passwords, or sensitive data',
  'Unexpected links — hover before clicking to see the real URL',
  'Poor grammar or unusual formatting',
  'Requests to bypass normal approval processes',
];

export function PhishingCaughtPage() {
  const [params] = useSearchParams();
  const name = params.get('name');
  const isFirstClick = params.get('clicked') === '1';

  return (
    <div className="min-h-screen bg-amber-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full space-y-6">

        <div className={`rounded-xl shadow-lg p-6 border-2 ${isFirstClick ? 'border-red-400 bg-white' : 'border-amber-400 bg-white'}`}>
          <div className="flex items-start gap-4">
            <div className={`text-4xl flex-shrink-0`}>{isFirstClick ? '🪤' : '⚠️'}</div>
            <div>
              <h1 className={`text-2xl font-bold ${isFirstClick ? 'text-red-700' : 'text-amber-700'}`}>
                {isFirstClick
                  ? `${name ? `${name}, you` : 'You'} clicked a simulated phishing link!`
                  : 'This was a simulated phishing link'}
              </h1>
              <p className="mt-2 text-slate-700">
                {isFirstClick
                  ? 'This was a security awareness training exercise. No harm was done — but in a real attack, clicking this link could have compromised your credentials or infected your device.'
                  : 'It looks like you already know this link was simulated. Good instincts! This page contains important security reminders.'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">How to spot phishing emails</h2>
          <ul className="space-y-3">
            {RED_FLAGS.map((flag, idx) => (
              <li key={idx} className="flex items-start gap-3">
                <span className="text-red-500 font-bold mt-0.5 flex-shrink-0">✗</span>
                <span className="text-slate-700 text-sm">{flag}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white rounded-xl shadow p-6 space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">What to do when you receive a suspicious email</h2>
          <ol className="space-y-2 text-sm text-slate-700 list-decimal list-inside">
            <li>Do not click any links or download attachments.</li>
            <li>Do not reply to the sender or provide any information.</li>
            <li>Report it to your IT security team immediately.</li>
            <li>Delete the email from your inbox.</li>
            <li>If you did click a link, report it right away — speed matters.</li>
          </ol>
        </div>

        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-6 text-center">
          <p className="text-sm text-indigo-800 font-medium">
            Your organization runs regular security awareness training to keep you protected. Check your training platform for quizzes on phishing and cybersecurity.
          </p>
          <a
            href="/employee/assignments"
            className="mt-3 inline-block px-5 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
          >
            Go to my training assignments
          </a>
        </div>

      </div>
    </div>
  );
}
