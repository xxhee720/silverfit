import { expect, it, vi } from 'vitest';
import { aiPhotoPart } from '../mobile/src/lib/ai-photo-part';
// No native runtime is needed: this path only serializes our byte-backed part.
vi.mock('../mobile/node_modules/expo/src/utils/blobUtils', () => ({
  blobToArrayBufferAsync: vi.fn(),
}));
// Exercise the installed SDK's converter, rather than a replica of its logic.
import { convertFormDataAsync } from '../mobile/node_modules/expo/src/winter/fetch/convertFormData';

it('sends JPEG bytes, filename, product and consent through Expo 58 multipart conversion', async () => {
  const bytes = new Uint8Array([255,216,0,128,255,217]);
  const part = aiPhotoPart(bytes.buffer);
  const form = { *entries() {
    yield ['photo',part]; yield ['product','ramp']; yield ['consent','true'];
  }} as unknown as FormData;
  const encoded = await convertFormDataAsync(form);
  const request = new Request('https://example.test', {method:'POST',
    headers:{'Content-Type':`multipart/form-data; boundary=${encoded.boundary}`},
    body:new Uint8Array(encoded.body).buffer});
  const parsed = await request.formData();
  const photo = parsed.get('photo') as File;
  expect(photo.name).toBe('photo.jpeg');
  expect(photo.type).toBe('image/jpeg');
  expect(new Uint8Array(await photo.arrayBuffer())).toEqual(bytes);
  expect(parsed.get('product')).toBe('ramp');
  expect(parsed.get('consent')).toBe('true');
});
