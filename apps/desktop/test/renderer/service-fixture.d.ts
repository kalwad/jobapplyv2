/** Synthetic diagnostics controls exposed only by the dedicated test bundle. */
export interface ServiceFixtureControls {
  reads(): number;
  cancels(): number;
  resolve(index: number): void;
}

declare global {
  interface Window {
    __serviceFixture: ServiceFixtureControls;
  }
}
