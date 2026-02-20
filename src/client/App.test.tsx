import { render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import App from './App';
import React from 'react';

// Mock fetch
global.fetch = vi.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve({ status: 'ok' }),
  })
) as unknown as typeof fetch;

test('renders Gemini Web UI title', async () => {
  render(<App />);
  const linkElement = screen.getByText(/Gemini Web UI/i);
  expect(linkElement).toBeInTheDocument();
});
