<script lang="ts">
import { ref, provide, defineComponent, h, reactive, onMounted, onUnmounted, watch } from "vue";
import { AnyFn, CleanupFn, initWeb, isIframe, setDebug } from '@telegram-apps/sdk';
import { SDKContextItem, SDKProviderProps } from "./SDKProvider.types";
export default defineComponent({
  name: "SDKProvider",
  props: {
    acceptCustomStyles: {
      type: Boolean,
      default: true,
    },
    debug: {
      type: Boolean,
      default: false,
    },
  },
  setup(props: SDKProviderProps, { slots }) {
    console.log("setup sdk");
    const isMountedRef = ref(true);

    let cache = reactive(new Map<AnyFn, SDKContextItem<any>>());

    provide('SDKContext', {
      use: (factory: AnyFn, ...args: any[]) => {
        // console.log('context---',...args);

        const cached = cache.get(factory);
        if (cached) {
          return cached;
        }

        let result: any;
        let error: any;
        try {
          result = factory(...args);
        } catch (err) {
          error = err;
        }
        // console.log('context---',result , error);

        function withCacheSet(item: SDKContextItem<any>): SDKContextItem<any> {
          cache.set(factory, item);
          return item;
        }

        if (error) {
          return withCacheSet({ error });
        }

        let cleanup: CleanupFn | undefined;
        if (Array.isArray(result)) {
          cleanup = result[1];
          result = result[0];
        }

        if (!result) {
          return withCacheSet({ result, cleanup });
        }

        function finalize(v: any): SDKContextItem<any> {
          if ("on" in v) {
            const off = v.on("change", () => mutateCache());
            const cleanupOriginal = cleanup;
            cleanup = () => {
              cleanupOriginal && cleanupOriginal();
              off();
            };
          }
          return { result: v, cleanup };
        }

        // 如果结果是Promise，处理异步情况
        if (result instanceof Promise) {
          result.then(
            (value: any) => mutateCache((c) => c.set(factory, finalize(value))),
            (error: any) => mutateCache((c) => c.set(factory, { error }))
          );
          return withCacheSet({});
        }

        return withCacheSet(finalize(result));
      },
    });

    const mutateCache = (
      mutate?: (state: Map<AnyFn, SDKContextItem<any>>) => void
    ) => {
      if (isMountedRef.value) {
        mutate && mutate(cache);
        cache = new Map(cache);
      }
    };
    console.log("provide sdk");
    
    onMounted(() => {
      isMountedRef.value = true;
      setDebug(props.debug || false);
      if (isIframe()) {
        initWeb(props.acceptCustomStyles);
      }
    });

    onUnmounted(() => {
      isMountedRef.value = false;
      cache.forEach((v) => {
        "cleanup" in v && v.cleanup && v.cleanup();
      });
    });

    // responsible for debug mode.
    watch(
      () => props.debug,
      (newDebugValue) => {
        setDebug(newDebugValue || false);
      }
    );

    return () => {
      return h("div", slots.default ? (slots.default as any)() : "nothing");
    };
  },
  render() {
    return h(
      "div",
      this.$slots.default ? (this.$slots.default as any)() : "nothing"
    );
  },
});
</script>