
import { type LaunchParams, retrieveLaunchParams } from '@telegram-apps/sdk';
import { ref } from 'vue'

/**
 * @returns Launch parameters.
 */
export function useLaunchParams(ssr: true): LaunchParams | undefined;

/**
 * @returns Launch parameters.
 */
export function useLaunchParams(ssr?: false): LaunchParams;

export function useLaunchParams(ssr?: boolean): LaunchParams | undefined {
    const lp = ref<LaunchParams | undefined>(undefined);
    if (ssr) {
        lp.value = retrieveLaunchParams();
        console.log('---launchParams', lp);
    }

    return lp.value;
}
