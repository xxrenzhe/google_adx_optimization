// 全局类型定义，用于处理复杂类型场景

declare module './types' {
  // 扩展Error类型
  interface ErrorWithCode extends Error {
    code?: string;
    stack?: string;
  }

  // 扩展unknown类型的安全访问
  interface SafeUnknown {
    [key: string]: any;
  }

  // 类型守卫
  function isErrorWithCode(error: unknown): error is ErrorWithCode;
  function isSafeUnknown(obj: unknown): obj is SafeUnknown;
}

// 全局类型实现
declare global {
  function isErrorWithCode(error: unknown): error is ErrorWithCode;
  function isSafeUnknown(obj: unknown): obj is SafeUnknown;
}

// 实现
globalThis.isErrorWithCode = (error: unknown): error is ErrorWithCode => {
  return error instanceof Error;
};

globalThis.isSafeUnknown = (obj: unknown): obj is SafeUnknown => {
  return typeof obj === 'object' && obj !== null;
};

export {};