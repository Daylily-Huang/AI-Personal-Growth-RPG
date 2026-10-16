import { IMAGE_DIMENSION, IMAGE_LIMIT, RASTER_LIMIT, TEXT_LIMIT, isImagePath, supportedPath, type OCRResult, type Source } from "./schema";
import type { FileEntry } from "./files";

export type PreparedImage = { originalSha256: string; rasterSha256: string; base64: string; preview: string; width: number; height: number };
export type ImageText = Omit<PreparedImage, "base64"> & OCRResult;
export async function digestBytes(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, "0")).join("");
}
export function imageDimensions(bytes: ArrayBuffer): { width: number; height: number } {
  const data = new DataView(bytes), raw = new Uint8Array(bytes), ascii = (at: number, length: number) => String.fromCharCode(...raw.subarray(at, at + length));
  let width = 0, height = 0;
  if (raw.length >= 33 && ascii(1, 3) === "PNG" && data.getUint32(8) === 13 && ascii(12, 4) === "IHDR") { width = data.getUint32(16); height = data.getUint32(20); }
  else if (raw.length >= 26 && ascii(0, 2) === "BM") {
    const dib = data.getUint32(14, true);
    if (dib === 12) { width = data.getUint16(18, true); height = data.getUint16(20, true); }
    else if (dib >= 40 && raw.length >= 54) { width = data.getInt32(18, true); height = Math.abs(data.getInt32(22, true)); }
  } else if (raw.length >= 30 && ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") {
    const chunk = ascii(12, 4);
    if (chunk === "VP8X") { if (raw[20] & 2) throw Error("动态图片暂不支持，请截取静态画面后重试"); width = 1 + raw[24] + (raw[25] << 8) + (raw[26] << 16); height = 1 + raw[27] + (raw[28] << 8) + (raw[29] << 16); }
    else if (chunk === "VP8 " && ascii(23, 3) === "\x9d\x01\x2a") { width = data.getUint16(26, true) & 0x3fff; height = data.getUint16(28, true) & 0x3fff; }
    else if (chunk === "VP8L" && raw[20] === 0x2f) { const bits = data.getUint32(21, true); width = (bits & 0x3fff) + 1; height = ((bits >>> 14) & 0x3fff) + 1; }
  } else if (raw.length >= 4 && raw[0] === 255 && raw[1] === 216) {
    let at = 2;
    while (at + 4 <= raw.length) {
      if (raw[at++] !== 255) break; while (at < raw.length && raw[at] === 255) at++;
      const marker = raw[at++]; if (at + 2 > raw.length || marker === 217 || marker === 218) break;
      const length = data.getUint16(at); if (length < 2 || at + length > raw.length) break;
      if ([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker) && length >= 8) { height = data.getUint16(at + 3); width = data.getUint16(at + 5); break; } at += length;
    }
  }
  if (width <= 0 || height <= 0) throw Error("图片格式无效或不支持，请另存为PNG/JPG后重试");
  if (width * height > 40_000_000) throw Error("图片像素过大，请裁剪至4,000万像素以内后重试");
  return { width, height };
}
async function imageFile(entry: FileEntry): Promise<File> {
  if (!supportedPath(entry.path) || !isImagePath(entry.path)) throw Error("不支持此图片类型");
  const file = await entry.read(); if (!file.size || file.size > IMAGE_LIMIT) throw Error("图片为空或超过10MB，请裁剪或压缩后重试");
  return file;
}
export async function prepareImage(entry: FileEntry): Promise<PreparedImage> {
  const file = await imageFile(entry), bytes = await file.arrayBuffer(), originalSha256 = await digestBytes(bytes);
  imageDimensions(bytes); // Bound pixel allocation before asking the browser decoder to inflate it.
  let image: ImageBitmap;
  try { image = await createImageBitmap(new Blob([bytes])); } catch { throw Error("图片已损坏或浏览器无法解码，请另存为PNG/JPG后重试"); }
  try {
    if (!image.width || !image.height || image.width * image.height > 40_000_000) throw Error("图片像素过大，请裁剪至4,000万像素以内后重试");
    const scale = Math.min(1, IMAGE_DIMENSION / Math.max(image.width, image.height)), width = Math.max(1, Math.round(image.width * scale)), height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
    const context = canvas.getContext("2d"); if (!context) throw Error("浏览器无法准备图片，请使用新版Chrome或Edge");
    context.fillStyle = "#ffffff"; context.fillRect(0, 0, width, height); context.drawImage(image, 0, 0, width, height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(Error("图片转换失败")), "image/png"));
    if (!blob.size || blob.size > RASTER_LIMIT) throw Error("处理后的图片仍过大，请裁剪需要识别的区域后重试");
    const raster = await blob.arrayBuffer(), array = new Uint8Array(raster); let binary = "";
    for (let index = 0; index < array.length; index += 8192) binary += String.fromCharCode(...array.subarray(index, index + 8192));
    const base64 = btoa(binary);
    return { originalSha256, rasterSha256: await digestBytes(raster), base64, preview: "data:image/png;base64," + base64, width, height };
  } finally { image.close(); }
}
export async function imageSource(entry: FileEntry, result?: ImageText): Promise<Source> {
  if (!result) throw Error("请先识别所选图片文字，并对照图片核对");
  const file = await imageFile(entry);
  if (await digestBytes(await file.arrayBuffer()) !== result.originalSha256) throw Error("原图片已变化，请重新识别并核对，尚未发送给AI");
  const content = result.text.trim();
  if (!content || content.length > TEXT_LIMIT || content.includes("\0") || !content.isWellFormed()) throw Error("识别文字为空或超限，请核对修改后重试");
  return { path: entry.path, content, sha256: await digestBytes(new TextEncoder().encode(content).buffer) };
}
