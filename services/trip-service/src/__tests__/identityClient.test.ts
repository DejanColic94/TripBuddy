import { getUserNames } from "../clients/identityClient";

describe("getUserNames", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it("returns an empty map when the identity request times out", async () => {
    jest.useFakeTimers();
    let requestSignal: AbortSignal | undefined;

    jest.spyOn(global, "fetch").mockImplementation((_input, init) => {
      requestSignal = init?.signal ?? undefined;

      return new Promise((_resolve, reject) => {
        requestSignal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
    });

    const resultPromise = getUserNames([1], "Bearer token");
    await jest.advanceTimersByTimeAsync(3000);

    await expect(resultPromise).resolves.toEqual(new Map());
    expect(requestSignal?.aborted).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });

  it("clears the timeout after a successful request", async () => {
    jest.useFakeTimers();
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => [{ id: 1, name: "Ana Traveler" }],
    } as Response);

    await expect(getUserNames([1], "Bearer token")).resolves.toEqual(
      new Map([[1, "Ana Traveler"]])
    );
    expect(jest.getTimerCount()).toBe(0);
  });
});
