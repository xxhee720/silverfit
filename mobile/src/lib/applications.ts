import * as Crypto from "expo-crypto";
import { client } from "./client";
import type { Photo } from "../components/photo-editor";
export async function uploadPhoto(id: string, photo: Photo) {
  const path = `${id}/${Crypto.randomUUID()}.jpeg`;
  const { error } = await client.storage
    .from("application-photos")
    .upload(path, photo.bytes, { contentType: "image/jpeg", upsert: false });
  if (error) throw error;
  const { error: metadata } = await client
    .from("attachments")
    .insert({ application_id: id, path, original_name: "현장사진.jpeg" });
  if (metadata) throw metadata;
}
