/// <reference types="vite/client" />

/**
 * Augment the global NodeJS namespace to include API_KEY in process.env.
 * This avoids the 'Cannot redeclare block-scoped variable' error by extending 
 * existing types instead of creating a new variable.
 */
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      readonly API_KEY: string;
      readonly [key: string]: string | undefined;
    }
  }
}

// Ensure the file is treated as a module to allow global augmentation.
export {};
