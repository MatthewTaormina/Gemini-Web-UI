import { render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import App from './App.js';
import React from 'react';

// Mock fetch
global.fetch = vi.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve({ status: 'ok' }),
  })
) as unknown as typeof fetch;

test('renders Login heading', async () => {
  render(<App />);
  const headingElement = screen.getByRole('heading', { name: /Login/i });
  expect(headingElement).toBeInTheDocument();
});
