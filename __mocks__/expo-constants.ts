type ExpoConfig = { version?: string; extra?: Record<string, unknown> };

const Constants: { expoConfig: ExpoConfig | null } = { expoConfig: { version: '1.0.0', extra: {} } };

export const constantsControl = {
  reset() {
    Constants.expoConfig = { version: '1.0.0', extra: {} };
  },
  setExtra(extra: Record<string, unknown>) {
    Constants.expoConfig = { ...Constants.expoConfig, extra };
  },
};

export default Constants;
