import { ComponentInternalInstance, PropType, defineComponent, h, onMounted, ref } from 'vue';
import { HookRaw, HookResult } from './createHooks';

export interface HOC<H extends HookRaw<any> | HookResult<any>> {
  <PropKey extends string, SSR extends boolean, Props>(
    propKey: PropKey,
    ssr: SSR,
    Component: any
  ): any;
}


export type HOCs<HRaw extends HookRaw<any>, HResult extends HookResult<any>> = [
  HOC<HRaw>,
  HOC<HResult>
];

interface Props {
  [key: string]: PropType<any>;
}

function createHOC<Hook extends HookRaw<any> | HookResult<any>>(hook: Hook) {

  let scR = ref()
  return function HOC(propKey: string, ssr: boolean, SubComp: any) {
    return defineComponent({
      props: SubComp.props as Props,
      setup(props, ctx) {
        onMounted(() => {
          scR.value!.fn()
        })

        let b = ref('strb')
        const opProps = () => {
          const t: Record<string, any> = Object.entries(SubComp.props).reduce((r, [k]) => {
            r[k] = props[k];
            return r;
          }, {} as Record<string, any>);
          t[propKey] = hook(ssr as any)
          return t
        }
        return {
          k: 'v',
          a: 'b',
          b,
          opProps,
        }
      },
      // h写法
      render(self: ComponentInternalInstance) {
        return h('div', [
          'render',
          this.b,
          h(SubComp,
            {
              ...this.opProps(),
              ref: scR
            },
            this.opSlot(this)
          ),
        ])
      },
    })
  }
  // return function HOC(propKey: string, ssr: any, Component: any) {
  //   return (props: any) => {
  //     console.log('-----props', props);
  //     return defineComponent({
  //       name: 'component',
  //       props: {
  //         ...props,
  //         [propKey]: hook(ssr)
  //       },
  //       setup() {
  //         return () => h(Component, {
  //           ...props,
  //           [propKey]: hook(ssr)
  //       })
  //       },
  //       render() {
  //         return () => h(Component, {
  //           ...props,
  //           [propKey]: hook(ssr)
  //       })
  //       }
  //     })
  //   }
  // }
}

export function createHOCs<HRaw extends HookRaw<any>, HResult extends HookResult<any>>(
  useRaw: HRaw,
  useResult: HResult,
): HOCs<HRaw, HResult> {
  return [createHOC(useRaw), createHOC(useResult)]
}
