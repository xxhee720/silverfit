// Expo 58 fetch accepts a binary FormData part exposing bytes(). It rejects
// React Native's legacy { uri, name, type } file descriptor before networking.
export function aiPhotoPart(data: ArrayBuffer) {
  return {
    name: "photo.jpeg",
    type: "image/jpeg",
    bytes: async () => new Uint8Array(data),
  };
}
