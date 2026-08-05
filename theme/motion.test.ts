import { withAppSpring } from './motion';

describe('motion animation wrappers', () => {
  it('compiles withAppSpring as a worklet so animation callbacks can call it on the UI runtime', () => {
    expect(
      (withAppSpring as typeof withAppSpring & { __workletHash?: number }).__workletHash,
    ).toEqual(expect.any(Number));
  });
});
