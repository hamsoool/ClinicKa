import { Link, useLocation } from 'react-router';

export default function CheckEmailPage() {
  const params = new URLSearchParams(useLocation().search);
  const email = params.get('email');

  return (
    <div className="min-h-screen bg-[#17810f] px-4 py-8 sm:px-6 md:py-12">
      <div className="mx-auto max-w-xl border border-[#3f8f3b] bg-[#78bd6f] p-6 shadow-xl sm:p-8">
        <h1 className="text-2xl font-bold text-[#102410]">Check your email</h1>
        <p className="mt-3 text-sm text-[#1f3b1b]">
          We sent a verification link{email ? ` to ${email}` : ''}. Open it to activate your account.
        </p>
        <p className="mt-2 text-sm text-[#1f3b1b]">
          After verification, you will be sent to sign in and can use your account right away.
        </p>
        <div className="mt-6">
          <Link
            to="/?mode=signin"
            className="inline-flex h-10 items-center rounded-sm bg-[#3bf839] px-4 font-semibold text-[#173312] transition hover:bg-[#35e134]"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
