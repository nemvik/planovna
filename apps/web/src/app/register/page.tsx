'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { createTrpcClient } from '../../lib/trpc/client';
import { HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY } from '../home-workspace';

type SubmitState = 'idle' | 'submitting';

const isValidEmail = (value: string) => /\S+@\S+\.\S+/.test(value);

export default function RegisterPage() {
  const router = useRouter();
  const [sessionReady, setSessionReady] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const token = window.localStorage.getItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY);

    if (typeof token === 'string' && token.length > 0) {
      router.replace('/');
      return;
    }

    setSessionReady(true);
  }, [router]);

  const validationMessage = useMemo(() => {
    if (!email.trim()) {
      return 'Email is required.';
    }

    if (!isValidEmail(email.trim())) {
      return 'Enter a valid email address.';
    }

    if (!password) {
      return 'Password is required.';
    }

    if (!companyName.trim()) {
      return 'Company / workspace name is required.';
    }

    return '';
  }, [companyName, email, password]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');

    if (validationMessage) {
      setErrorMessage(validationMessage);
      return;
    }

    setSubmitState('submitting');

    try {
      const client = createTrpcClient();
      const result = await client.auth.register.mutate({
        email: email.trim(),
        password,
        companyName: companyName.trim(),
      });

      window.localStorage.setItem(HOMEPAGE_ACCESS_TOKEN_STORAGE_KEY, result.accessToken);
      router.push('/');
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'data' in error &&
        typeof error.data === 'object' &&
        error.data !== null &&
        'code' in error.data
      ) {
        const code = error.data.code;

        if (code === 'CONFLICT') {
          setErrorMessage('This email is already registered. Please log in instead.');
        } else if (code === 'TOO_MANY_REQUESTS') {
          setErrorMessage('Too many registration attempts. Please try again later.');
        } else {
          setErrorMessage('Could not create your account. Please try again.');
        }
      } else {
        setErrorMessage('Could not create your account. Please try again.');
      }
    } finally {
      setSubmitState('idle');
    }
  };

  if (!sessionReady) {
    return <main className="mx-auto min-h-screen max-w-3xl p-6 text-slate-600">Loading…</main>;
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl p-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-wide text-sky-700">Planovna</p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-950">Create your account</h1>
        <p className="mt-4 max-w-2xl text-sm text-slate-600">
          Create an Owner account and Planovna will create your workspace automatically.
        </p>

        <form className="mt-6 space-y-4" noValidate onSubmit={onSubmit}>
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            Email
            <input
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-slate-700">
            Password
            <input
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <span className="text-xs text-slate-500">Minimum password according to the current sign-up contract.</span>
          </label>

          <label className="flex flex-col gap-1 text-sm text-slate-700">
            Company / workspace name
            <input
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
            />
          </label>

          {errorMessage ? <p className="text-sm text-rose-700">{errorMessage}</p> : null}

          <div className="flex flex-wrap items-center gap-3">
            <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white" type="submit">
              {submitState === 'submitting' ? 'Creating account…' : 'Create account'}
            </button>
            <Link className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900" href="/board">
              Log in
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}
