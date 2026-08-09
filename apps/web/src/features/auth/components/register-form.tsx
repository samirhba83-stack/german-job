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
  const [invitationCode, setInvitationCode] = useState('');
  const passwordsMatch = password.length === 0 || password === confirmPassword;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!passwordsMatch) return;
    register({ email, password, invitationCode: invitationCode.trim() });
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
      <div className="space-y-1">
        <h1 className="text-heading-lg font-semibold text-primary">Create account</h1>
        {/* M31 Phase 20/21 — German Job Engine is in a Controlled Closed Beta; every account
            requires a real, admin-issued, email-bound invitation. This is not a placeholder field —
            the backend rejects registration without a valid code (docs/production-certification/
            16-closed-beta-access-model.md). */}
        <p className="text-body-sm text-secondary">
          German Job Engine is currently in a closed beta. You&apos;ll need an invitation code sent
          to your email to create an account.
        </p>
      </div>
      <Input
        label="Invitation code"
        type="text"
        autoComplete="off"
        required
        value={invitationCode}
        onChange={(event) => setInvitationCode(event.target.value)}
      />
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
