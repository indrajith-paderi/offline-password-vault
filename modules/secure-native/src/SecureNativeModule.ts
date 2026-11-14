import { requireNativeModule } from 'expo-modules-core';
import type { SecureNativeModule } from './SecureNative.types';

export default requireNativeModule<SecureNativeModule>('SecureNative');
