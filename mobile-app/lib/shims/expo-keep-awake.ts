export const ExpoKeepAwakeTag = "ExpoKeepAwakeDefaultTag";

export function useKeepAwake(): void {}

export async function isAvailableAsync(): Promise<boolean> {
  return false;
}

export async function activateKeepAwake(): Promise<void> {}

export async function activateKeepAwakeAsync(): Promise<void> {}

export async function deactivateKeepAwake(): Promise<void> {}

export function addListener() {
  return { remove() {} };
}
