import { createRepository, type Repository } from '@/src/data/repository';

// Single shared Repository instance for the UI layer. The data phase owns the
// implementations; we just hold one initialized instance app-wide.
let instance: Repository | null = null;
let initPromise: Promise<void> | null = null;

/** Get the shared repository, lazily creating it on first use. */
export function getRepo(): Repository {
  if (!instance) {
    instance = createRepository();
  }
  return instance;
}

/** Ensure the repository is initialized exactly once. */
export async function ensureRepo(): Promise<Repository> {
  const repo = getRepo();
  if (!initPromise) {
    initPromise = repo.init();
  }
  await initPromise;
  return repo;
}
