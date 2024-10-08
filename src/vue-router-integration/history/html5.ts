import {
  RouterHistory,
  NavigationCallback,
  NavigationType,
  NavigationDirection,
  HistoryState,
  ValueContainer,
  normalizeBase,
  HistoryLocation,
} from "./common";
import {
  computeScrollPosition,
  _ScrollPositionNormalized,
} from "../scrollBehavior";
import { warn } from "../warning";
import { stripBase } from "../location";
import { assign } from "../utils";

import {
  type BrowserNavigator,
  type BrowserNavigatorHistoryItem,
  getHash,
  urlToPath,
  createSafeURL,
} from "@telegram-apps/sdk";

type PopStateListener = (this: Window, ev: PopStateEvent) => any;

let createBaseLocation = () => location.protocol + "//" + location.host;

interface StateEntry extends HistoryState {
  back: HistoryLocation | null;
  current: HistoryLocation;
  forward: HistoryLocation | null;
  position: number;
  replaced: boolean;
  scroll: _ScrollPositionNormalized | null | false;
}

/**
 * Creates a normalized history location from a window.location object
 * @param base - The base path
 * @param location - The window.location object
 */
function createCurrentLocation<State>(
  base: string,
  location: BrowserNavigator<State>
): HistoryLocation {
  const { pathname, search, hash } = location;
  // allows hash bases like #, /#, #/, #!, #!/, /#!/, or even /folder#end
  const hashPos = base.indexOf("#");
  if (hashPos > -1) {
    let slicePos = hash.includes(base.slice(hashPos))
      ? base.slice(hashPos).length
      : 1;
    let pathFromHash = hash.slice(slicePos);
    // prepend the starting slash to hash so the url starts with /#
    if (pathFromHash[0] !== "/") pathFromHash = "/" + pathFromHash;
    return stripBase(pathFromHash, "");
  }
  const path = stripBase(pathname, base);

  // console.log("path", path, location, hashPos);

  return path + search + hash;
}

function useHistoryListeners<State>(
  navigator: BrowserNavigator<State>,
  base: string,
  historyState: ValueContainer<StateEntry>,
  currentLocation: ValueContainer<HistoryLocation>,
  replace: RouterHistory["replace"]
) {
  let listeners: NavigationCallback[] = [];
  let teardowns: Array<() => void> = [];
  // TODO: should it be a stack? a Dict. Check if the popstate listener
  // can trigger twice
  let pauseState: HistoryLocation | null = null;

  const popStateHandler = (
    state: {
      navigator: BrowserNavigator<State>;
      delta: number;
      from: BrowserNavigatorHistoryItem<State>;
      to: BrowserNavigatorHistoryItem<State>;
    } | null
  ) => {
    const to = createCurrentLocation(base, navigator);
    const from: HistoryLocation = currentLocation?.value;
    const fromState: StateEntry = historyState?.value;
    let delta = 0;

    // console.log(
    //   "fromState?.back || fromState?.forward",
    //   fromState?.back,
    //   fromState?.forward,
    //   !!(fromState?.back || fromState?.forward),
    //   to
    // );

    if (state && (fromState?.back || fromState?.forward)) {
      // console.log("fromState?.back || fromState?.forward");

      currentLocation.value = to;
      // historyState.value = fromState;

      // ignore the popstate and reset the pauseState
      if (pauseState && pauseState === from) {
        pauseState = null;
        return;
      }
      delta = fromState ? state.delta - fromState.position : 0;
    } else {
      if (to !== from) replace(to);
    }

    // Here we could also revert the navigation by calling history.go(-delta)
    // this listener will have to be adapted to not trigger again and to wait for the url
    // to be updated before triggering the listeners. Some kind of validation function would also
    // need to be passed to the listeners so the navigation can be accepted
    // call all listeners
    listeners.forEach((listener) => {
      listener(currentLocation.value, from, {
        delta,
        type: NavigationType.pop,
        direction: delta
          ? delta > 0
            ? NavigationDirection.forward
            : NavigationDirection.back
          : NavigationDirection.unknown,
      });
    });
  };

  function pauseListeners() {
    pauseState = currentLocation.value;
  }

  function listen(callback: NavigationCallback) {
    // set up the listener and prepare teardown callbacks
    listeners.push(callback);

    const teardown = () => {
      const index = listeners.indexOf(callback);
      if (index > -1) listeners.splice(index, 1);
    };

    teardowns.push(teardown);
    return teardown;
  }

  function beforeUnloadListener() {
    const { history } = window;
    navigator.detach();
    listeners = [];
    // if (!navigator.state) return;
    history?.replaceState(
      assign({}, navigator.state, { scroll: computeScrollPosition() }),
      ""
    );
  }

  function destroy() {
    for (const teardown of teardowns) teardown();
    teardowns = [];
    navigator.detach();
    navigator.off("change", popStateHandler);
    // window.removeEventListener("popstate", popStateHandler);
    window.removeEventListener("beforeunload", beforeUnloadListener);
  }

  navigator.on("change", popStateHandler);

  // // set up the listeners and prepare teardown callbacks
  // window.addEventListener("popstate", popStateHandler);

  // // TODO: could we use 'pagehide' or 'visibilitychange' instead?
  // // https://developer.chrome.com/blog/page-lifecycle-api/
  // window.addEventListener("beforeunload", beforeUnloadListener, {
  //   passive: true,
  // });

  return {
    pauseListeners,
    listen,
    destroy,
  };
}

/**
 * Creates a state object
 */
function buildState<State>(
  back: HistoryLocation | null,
  current: HistoryLocation,
  forward: HistoryLocation | null,
  replaced: boolean = false,
  computeScroll: boolean = false,
  navigator: BrowserNavigator<State>
): StateEntry {
  return {
    back,
    current,
    forward,
    replaced,
    position: navigator.history.length,
    scroll: computeScroll ? computeScrollPosition() : null,
  };
}

function useHistoryStateNavigation<State>(
  navigator: BrowserNavigator<State>,
  base: string
) {
  // const { history, location } = window;

  // private variables
  const currentLocation: ValueContainer<HistoryLocation> = {
    value: createCurrentLocation(base, navigator),
  };
  const historyState: ValueContainer<StateEntry> = {
    value: navigator?.state as StateEntry,
  };
  // build current history entry as this is a fresh navigation
  if (!historyState.value && !!navigator?.history) {
    changeLocation(
      currentLocation.value,
      {
        back: null,
        current: currentLocation.value,
        forward: null,
        // the length is off by one, we need to decrease it
        position:
          navigator?.history?.length - (navigator?.history?.length > 0 ? 1 : 0),
        replaced: true,
        // don't add a scroll as the user may have an anchor, and we want
        // scrollBehavior to be triggered without a saved position
        scroll: null,
      },
      true
    );
  }

  function changeLocation(
    to: HistoryLocation,
    state: StateEntry,
    replace: boolean
  ): void {
    /**
     * if a base tag is provided, and we are on a normal domain, we have to
     * respect the provided `base` attribute because pushState() will use it and
     * potentially erase anything before the `#` like at
     * https://github.com/vuejs/router/issues/685 where a base of
     * `/folder/#` but a base of `/` would erase the `/folder/` section. If
     * there is no host, the `<base>` tag makes no sense and if there isn't a
     * base tag we can just use everything after the `#`.
     */

    const hashIndex = base.indexOf("#");
    // console.log("hashIndex11", hashIndex, createBaseLocation(), base, to);

    const url =
      hashIndex > -1
        ? (location.host && document.querySelector("base")
            ? base
            : base.slice(hashIndex)) + to
        : createBaseLocation() + base + to;

    // console.log("hashIndex11", url, createBaseLocation(), base, to);

    navigator[replace ? "replace" : "push"](url, state as State);
    historyState.value = state;
    // try {
    //   // BROWSER QUIRK
    //   // NOTE: Safari throws a SecurityError when calling this function 100 times in 30 seconds
    //   history[replace ? "replaceState" : "pushState"](state, "", url);
    //   historyState.value = state;
    // } catch (err) {
    //   if (__DEV__) {
    //     warn("Error with push/replace State", err);
    //   } else {
    //     console.error(err);
    //   }
    //   // Force the navigation, this also resets the call count
    //   navigator[replace ? "replace" : "push"](url, state as State);
    // }
  }

  function replace(to: HistoryLocation, data?: HistoryState) {
    const state: StateEntry = assign(
      {},
      navigator.state,
      buildState(
        historyState.value.back,
        // keep back and forward entries but override current position
        to,
        historyState.value.forward,
        true,
        undefined,
        navigator
      ),
      data,
      { position: historyState.value.position }
    );

    changeLocation(to, state, true);
    currentLocation.value = to;
  }

  function push(to: HistoryLocation, data?: HistoryState) {
    // Add to current entry the information of where we are going
    // as well as saving the current position
    if (!navigator) return;
    const currentState = assign(
      {},
      // use current history state to gracefully handle a wrong call to
      // history.replaceState
      // https://github.com/vuejs/router/issues/366
      historyState.value,
      navigator.state as Partial<StateEntry> | null,
      {
        forward: to,
        scroll: computeScrollPosition(),
      }
    );

    if (__DEV__ && !history?.state) {
      warn(
        `history.state seems to have been manually replaced without preserving the necessary values. Make sure to preserve existing history state if you are manually calling history.replaceState:\n\n` +
          `history.replaceState(history.state, '', url)\n\n` +
          `You can find more information at https://router.vuejs.org/guide/migration/#Usage-of-history-state`
      );
    }

    changeLocation(currentState.current, currentState, true);

    const state: StateEntry = assign(
      {},
      buildState(
        currentLocation.value,
        to,
        null,
        undefined,
        undefined,
        navigator
      ),
      { position: currentState.position + 1 },
      data
    );

    changeLocation(to, state, false);
    currentLocation.value = to;
  }

  return {
    location: currentLocation,
    state: historyState,

    push,
    replace,
  };
}

/**
 * Creates an HTML5 history. Most common history for single page applications.
 *
 * @param base -
 */
export function createWebHistory<State>(
  navigator: BrowserNavigator<State>,
  base?: string
): RouterHistory {
  base = normalizeBase(base);

  const historyNavigation = useHistoryStateNavigation(navigator, base);
  const historyListeners = useHistoryListeners(
    navigator,
    base,
    historyNavigation.state,
    historyNavigation.location,
    historyNavigation.replace
  );
  function go(delta: number, triggerListeners = true) {
    if (!triggerListeners) historyListeners.pauseListeners();
    navigator.go(delta);
  }

  const routerHistory: RouterHistory = assign(
    {
      // it's overridden right after
      location: "",
      base,
      go,
      // createHref: createHref.bind(null, base),
      createHref: (to) => navigator.renderPath(urlToPath(to)),
      encodeLocation: (to) =>
        createSafeURL(navigator.renderPath(urlToPath(to))),
    },

    historyNavigation,
    historyListeners
  );

  Object.defineProperty(routerHistory, "location", {
    enumerable: true,
    get: () => historyNavigation.location.value,
  });

  Object.defineProperty(routerHistory, "state", {
    enumerable: true,
    get: () => historyNavigation.state.value,
  });

  return routerHistory;
}
