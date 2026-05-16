'use client';

import { useRef, useState } from 'react';
import styles from './index.module.css';

export default function LoginPage() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const password = inputRef.current?.value ?? '';
    setError('');
    setLoading(true);

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    setLoading(false);

    if (res.ok) {
      window.location.href = '/';
    } else {
      setError('Wrong password.');
      inputRef.current?.select();
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>Podhomme</h1>
        <form onSubmit={handleSubmit} className={styles.form}>
          <input
            ref={inputRef}
            type="password"
            placeholder="Password"
            className={styles.input}
            autoFocus
            autoComplete="current-password"
          />
          {error && <p className={styles.error}>{error}</p>}
          <button type="submit" className={styles.btn} disabled={loading}>
            {loading ? 'Checking…' : 'Enter'}
          </button>
        </form>
      </div>
    </div>
  );
}
