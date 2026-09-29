import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export type SmsRow = {
  /** The provider's `_id`, stable for the life of the message. */
  id: string;
  address: string;
  body: string;
  /** Epoch millis, as reported by the SMS provider. */
  date: number;
};

export interface Spec extends TurboModule {
  /** Synchronous so the first render can branch without a flash of empty state. */
  hasReadPermission(): boolean;

  /**
   * Reads the SMS inbox.
   *
   * `senderFragments` is an allow-list of uppercase sender-id fragments
   * ("HDFCBK", "ICICIB", ...). Filtering happens natively, so messages from
   * anyone who is not a registered bank never cross the bridge and never enter
   * the JS heap. This is a deliberate privacy boundary, not an optimisation.
   */
  query(sinceEpochMs: number, limit: number, senderFragments: string[]): Promise<SmsRow[]>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('NativeSmsReader');
