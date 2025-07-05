import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../src/ui/App';

describe('App', () => {
  it('renders main title and process info', () => {
    render(<App />);
    expect(screen.getByText('Yui Protocol')).toBeInTheDocument();
    expect(screen.getByText('Multi-AI Collaborative Reasoning through Structured Dialogue')).toBeInTheDocument();
    expect(screen.getByText('5-Stage Dialectic Process')).toBeInTheDocument();
  });
}); 