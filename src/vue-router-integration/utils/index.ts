import type {
  RouteParamsGeneric,
  RouteComponent,
  RouteParamsRawGeneric,
  RouteParamValueRaw,
} from "vue-router";

export * from "./env";

export function isESModule(obj: any): obj is { default: RouteComponent } {
  return obj.__esModule || obj[Symbol.toStringTag] === "Module";
}

export const assign = Object.assign;

export function applyToParams(
  fn: (v: string | number | null | undefined) => string,
  params: RouteParamsRawGeneric | undefined
): RouteParamsGeneric {
  const newParams: RouteParamsGeneric = {};

  for (const key in params) {
    const value = params[key];
    newParams[key] = isArray(value)
      ? value.map(fn)
      : fn(value as Exclude<RouteParamValueRaw, any[]>);
  }

  return newParams;
}

export const noop = () => {};

/**
 * Typesafe alternative to Array.isArray
 * https://github.com/microsoft/TypeScript/pull/48228
 */
export const isArray: (arg: ArrayLike<any> | any) => arg is ReadonlyArray<any> =
  Array.isArray;
