/** Deletes the cached copies of pages kept for offline use (e.g. on sign out). */
export async function clearOfflineCache(): Promise<void> {
  if (typeof caches === 'undefined') return;
  const keys = await caches.keys();
  await Promise.all(keys.filter((k) => k.startsWith('pages-')).map((k) => caches.delete(k)));
}
