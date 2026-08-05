'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '../hooks/use-auth';

export function RegisterForm() {
  const { register, isRegistering } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const passwordsMatch = password.length === 0 || password === confirmPassword;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!passwordsMatch) return;
    register({ email, password });
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
      <h1 className="text-heading-lg font-semibold text-primary">Create account</h1>
      <Input
        label="Email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <Input
        label="Password"
        type="password"
        autoComplete="new-password"
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      <Input
        label="Confirm password"
        type="password"
        autoComplete="new-password"
        required
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.target.value)}
        error={!passwordsMatch ? 'Passwords do not match.' : undefined}
      />
      <Button type="submit" loading={isRegistering} className="w-full">
        Create account
      </Button>
      <p className="text-body-sm text-secondary">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-accent hover:underline">
          Log in
        </Link>
      </p>
    </form>
  );
}
