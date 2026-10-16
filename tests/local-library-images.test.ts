// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { webcrypto, createHash } from "node:crypto";
import { File as NativeFile, Blob as NativeBlob } from "node:buffer";
import { digestBytes, imageDimensions, imageSource, prepareImage, type ImageText } from "@/lib/local-library/image";
import { IMAGE_LIMIT, RASTER_LIMIT, fileLimit, isImagePath, supportedPath } from "@/lib/local-library/schema";
import { readSource, scanDirectory, type Directory, type FileEntry } from "@/lib/local-library/files";

const png = (width = 100, height = 80) => { const b = Buffer.alloc(33); Buffer.from([137,80,78,71,13,10,26,10]).copy(b); b.writeUInt32BE(13,8); b.write("IHDR",12); b.writeUInt32BE(width,16); b.writeUInt32BE(height,20); return b; };
const buffer = (bytes: Uint8Array) => Uint8Array.from(bytes).buffer;
const hash = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");
const entry = (bytes = png(), path = "notes/image.png"): FileEntry => { const file = new NativeFile([Uint8Array.from(bytes)], path.split("/").at(-1)!) as unknown as File; return { path, size:file.size, modifiedAt:1, read:async()=>file }; };
beforeEach(() => { vi.stubGlobal("crypto", webcrypto); vi.stubGlobal("Blob", NativeBlob); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe("local image boundaries", () => {
  it.each(["a.png","a.JPG","a.jpeg","a.webp","a.bmp"])("accepts static image %s", name => { expect(isImagePath(name)).toBe(true); expect(supportedPath(name)).toBe(true); expect(fileLimit(name)).toBe(IMAGE_LIMIT); });
  it.each(["a.svg","a.gif","a.heic","a.tiff","password.png",".private/a.png"])("refuses unsupported or sensitive file %s", name => expect(supportedPath(name)).toBe(false));
  it("bounds image pixels before decoding", () => { expect(imageDimensions(buffer(png()))).toEqual({width:100,height:80}); expect(()=>imageDimensions(buffer(png(100000,100000)))).toThrow("像素过大"); expect(()=>imageDimensions(buffer(Buffer.from('<svg width="100">')))).toThrow("格式无效"); });
  it("reads JPEG dimensions from its frame header", () => { const b=Buffer.from([255,216,255,224,0,4,0,0,255,192,0,8,8,0,80,0,100,3,255,217]);expect(imageDimensions(buffer(b))).toEqual({width:100,height:80}); });
  it("reads BMP dimensions and refuses malformed headers", () => { const b=Buffer.alloc(54);b.write('BM');b.writeUInt32LE(40,14);b.writeInt32LE(100,18);b.writeInt32LE(-80,22);expect(imageDimensions(buffer(b))).toEqual({width:100,height:80});expect(()=>imageDimensions(buffer(Buffer.from([255,216,255,224,255,255])))).toThrow(); });
  it("reads WebP extended dimensions and refuses animation", () => { const b=Buffer.alloc(30);b.write('RIFF');b.write('WEBP',8);b.write('VP8X',12);b[24]=99;b[27]=79;expect(imageDimensions(buffer(b))).toEqual({width:100,height:80});b[20]=2;expect(()=>imageDimensions(buffer(b))).toThrow("动态图片"); });
  it("scans images without reading body or calling OCR", async () => {
    const body=vi.fn(),dir={name:'notes',async *values(){for(const [name,size]of [['photo.png',200000],['too-large.jpg',IMAGE_LIMIT+1],['unsafe.svg',100]])yield {name,kind:'file',getFile:async()=>({size,lastModified:1,arrayBuffer:body})};}} as unknown as Directory;
    const result=await scanDirectory(dir);expect(result.files.map(f=>f.path)).toEqual(['notes/photo.png']);expect(result.skipped).toBe(2);expect(body).not.toHaveBeenCalled();
  });
  it("does not decode image bytes as UTF8 text", async () => { await expect(readSource(entry())).rejects.toThrow('先在本机识别'); });
  it("requires OCR preview before producing a text source", async () => { await expect(imageSource(entry())).rejects.toThrow('先识别'); });
  it("hashes user-corrected OCR text and checks actual original bytes", async () => {
    const bytes=png(),result={originalSha256:hash(bytes),rasterSha256:hash(bytes),text:'  Sample 15，待核实。  ',preview:'data:image/png;base64,',width:100,height:80,engine:'Windows OCR',language:'zh-Hans-CN'} as ImageText;
    const source=await imageSource(entry(bytes),result);expect(source).toEqual({path:'notes/image.png',content:'Sample 15，待核实。',sha256:hash('Sample 15，待核实。')});expect(JSON.stringify(source)).not.toContain('base64');
    const changed=png();changed[32]=1;await expect(imageSource(entry(changed),result)).rejects.toThrow('原图片已变化');
  });
  it("rejects empty or overflowing corrected OCR text", async () => {
    const bytes=png(),result={originalSha256:hash(bytes),text:'',preview:'',width:100,height:80,engine:'Windows OCR',language:'zh-Hans-CN',rasterSha256:hash(bytes)} as ImageText;
    await expect(imageSource(entry(bytes),result)).rejects.toThrow('为空或超限');await expect(imageSource(entry(bytes),{...result,text:'a'.repeat(64001)})).rejects.toThrow('为空或超限');
  });
  it("normalizes pixels to a bounded white PNG and closes its bitmap", async () => {
    const close=vi.fn(),context={fillStyle:'',fillRect:vi.fn(),drawImage:vi.fn()},bitmap={width:5200,height:2600,close};vi.stubGlobal('createImageBitmap',vi.fn(async()=>bitmap));
    vi.spyOn(document,'createElement').mockReturnValue({width:0,height:0,getContext:()=>context,toBlob:(callback:(blob:Blob)=>void)=>callback(new NativeBlob([Uint8Array.from(png(2600,1300))]) as unknown as Blob)} as unknown as HTMLCanvasElement);
    const result=await prepareImage(entry(png(5200,2600)));expect(result.width).toBe(2600);expect(result.height).toBe(1300);expect(result.originalSha256).toBe(hash(png(5200,2600)));expect(context.fillStyle).toBe('#ffffff');expect(context.drawImage).toHaveBeenCalledWith(bitmap,0,0,2600,1300);expect(close).toHaveBeenCalledOnce();expect(result.preview).toBe('data:image/png;base64,'+result.base64);
  });
  it("rejects excessive original pixels before invoking the browser decoder", async () => { const decode=vi.fn();vi.stubGlobal('createImageBitmap',decode);await expect(prepareImage(entry(png(100000,100000)))).rejects.toThrow('像素过大');expect(decode).not.toHaveBeenCalled(); });
  it("rejects oversized normalized PNG instead of shipping it", async () => {
    const close=vi.fn();vi.stubGlobal('createImageBitmap',vi.fn(async()=>({width:10,height:10,close})));vi.spyOn(document,'createElement').mockReturnValue({getContext:()=>({fillRect(){},drawImage(){}}),toBlob:(cb:(b:unknown)=>void)=>cb({size:RASTER_LIMIT+1})} as unknown as HTMLCanvasElement);
    await expect(prepareImage(entry())).rejects.toThrow('裁剪');expect(close).toHaveBeenCalledOnce();
  });
  it("uses SHA256 of precisely the bytes supplied", async () => expect(await digestBytes(buffer(png()))).toBe(hash(png())));
});
