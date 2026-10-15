export class RequestBodyTooLargeError extends Error {
  constructor() {
    super("Request body is too large");
  }
}

export async function readLimitedText(request: Request, maxBytes: number): Promise<string> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let result = "";
  let bytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        throw new RequestBodyTooLargeError();
      }
      result += decoder.decode(value, { stream: true });
    }
    return result + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

export async function readLimitedJson<T>(request: Request, maxBytes: number): Promise<T> {
  return JSON.parse(await readLimitedText(request, maxBytes)) as T;
}
