'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '../hooks/use-auth';

export function LoginForm() {
  const { login, isLoggingIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    login({ email, password });
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
      <h1 className="text-heading-lg font-semibold text-primary">Log in</h1>
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
        autoComplete="current-password"
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      <Button type="submit" loading={isLoggingIn} className="w-full">
        Log in
      </Button>
      <p className="text-body-sm text-secondary">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="font-semibold text-accent hover:underline">
          Register
        </Link>
      </p>
    </form>
  );
}
