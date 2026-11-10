import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
// Chunk tokens: SecureStore platforms can reject values larger than 2KB.
const options = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};
const pointer = (key: string) => `${key}.pointer`;
async function generation(key: string) {
  const raw = await SecureStore.getItemAsync(pointer(key), options);
  if (!raw) return null;
  const value = JSON.parse(raw) as { id: string; count: number };
  if (
    !/^[a-f0-9-]{36}$/.test(value.id) ||
    !Number.isInteger(value.count) ||
    value.count < 1 ||
    value.count > 128
  )
    throw Error("저장된 세션을 확인해 주세요.");
  return value;
}
async function clear(key: string, value: { id: string; count: number } | null) {
  if (value)
    for (let i = 0; i < value.count; i++)
      await SecureStore.deleteItemAsync(`${key}.${value.id}.${i}`, options);
}
export const secureStorage = {
  async getItem(key: string) {
    const value = await generation(key);
    if (!value) return null;
    const parts = await Promise.all(
      Array.from({ length: value.count }, (_, i) =>
        SecureStore.getItemAsync(`${key}.${value.id}.${i}`, options),
      ),
    );
    return parts.some((p) => p === null) ? null : parts.join("");
  },
  async setItem(key: string, content: string) {
    const previous = await generation(key),
      id = Crypto.randomUUID(),
      count = Math.max(1, Math.ceil(content.length / 500));
    if (count > 128) throw Error("세션이 너무 큽니다.");
    for (let i = 0; i < count; i++)
      await SecureStore.setItemAsync(
        `${key}.${id}.${i}`,
        content.slice(i * 500, (i + 1) * 500),
        options,
      );
    await SecureStore.setItemAsync(
      pointer(key),
      JSON.stringify({ id, count }),
      options,
    );
    await clear(key, previous);
  },
  async removeItem(key: string) {
    const value = await generation(key);
    await SecureStore.deleteItemAsync(pointer(key), options);
    await clear(key, value);
  },
};
