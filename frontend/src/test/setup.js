// Vitest setup — enable React's act() environment so @testing-library/react
// can wrap renders/updates in act without warnings under React 19, and unmount
// rendered trees after each test (auto-cleanup needs the globals the suite
// deliberately leaves off).
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  cleanup();
});
