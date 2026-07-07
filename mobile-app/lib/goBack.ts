// Robust back navigation: return to the actual previous screen when there is
// history; otherwise land on a sensible fallback instead of jumping to home or
// getting stuck. Fixes "back sends me to the wrong place" across the app.

type RouterLike = {
  canGoBack: () => boolean;
  back: () => void;
  replace: (href: never) => void;
};

export function safeBack(router: RouterLike, fallback = "/") {
  try {
    if (router.canGoBack()) {
      router.back();
      return;
    }
  } catch {
    /* fall through to fallback */
  }
  router.replace(fallback as never);
}
