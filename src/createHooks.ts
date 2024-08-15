import { type CleanupFn, isSSR, type AnyFn, If } from '@telegram-apps/sdk';

import { useSDK } from './SDKProvider/SDKContext.js';
import type { SDKContextItem } from './SDKProvider/SDKProvider.types.js';
import { ref, watch } from 'vue';;

type ExtractResult<T> = T extends [result: infer R, cleanup: CleanupFn]
    ? ExtractResult<R>
    : T extends PromiseLike<any>
    ? Awaited<T> | undefined
    : T;

type HookFnResult<Fn extends AnyFn> = ExtractResult<ReturnType<Fn>>;

interface CompleteHook<Result> extends Hook<Result, true>, Hook<Result, false> {
}

export type Hook<Result, SSR extends boolean> = If<
    SSR,
    (ssr: true) => Result | undefined,
    (ssr?: false) => Result
>;

export interface HookRaw<Factory extends AnyFn>
    extends CompleteHook<SDKContextItem<HookFnResult<Factory>>> {
}

export interface HookResult<Factory extends AnyFn> extends CompleteHook<HookFnResult<Factory>> {
}

export type Hooks<Factory extends AnyFn> = [
    useRaw: HookRaw<Factory>,
    useResult: HookResult<Factory>,
];

/**
 * @returns Hooks, simplifying work process with the SDK components.
 */
export function createHooks<Factory extends AnyFn>(factory: Factory): Hooks<Factory> {
    function useRaw(ssr?: false): SDKContextItem<HookFnResult<Factory>>;
    function useRaw(ssr: true): SDKContextItem<HookFnResult<Factory>> | undefined;
    function useRaw(ssr?: boolean): SDKContextItem<HookFnResult<Factory>> | undefined {
        console.log(factory);
        const sdk = useSDK();
        console.log(sdk);
        const result = ref<SDKContextItem<HookFnResult<Factory>> | undefined>(undefined)

        const setResult = () => {
            console.log('watch');
            if (ssr && isSSR()) {
                throw new Error('Using hooks on the server side, you must explicitly specify ssr = true option');
            }
            result.value = ssr ? undefined : sdk.use(factory);
            // console.log('re', result.value);
        }

        // Each time sdk context changes, we are updating the local value.
        watch(() => sdk, () => {
            setResult();
        })

        setResult();
        return result.value as SDKContextItem<HookFnResult<Factory>> | undefined;
    }

    function useResult(ssr?: false): HookFnResult<Factory>;
    function useResult(ssr: true): HookFnResult<Factory> | undefined;
    function useResult(ssr?: boolean): HookFnResult<Factory> | undefined {
        const raw = useRaw(ssr as any);
        if (!raw) {
            return;
        }
        if ('error' in raw) {
            throw raw.error;
        }
        return raw.result;
    }

    return [useRaw, useResult];
}