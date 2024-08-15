import {inject } from 'vue';
import { SDKContextType } from './SDKProvider.types';


export function useSDK() {
  const sdkContext = inject('SDKContext') as SDKContextType | null ;

  if (!sdkContext) {
    throw new Error('useSDK was used outside the SDKProvider.');
  }

  return sdkContext;
}
