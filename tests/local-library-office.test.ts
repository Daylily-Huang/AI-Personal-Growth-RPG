// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Blob as NativeBlob, File as NativeFile } from "node:buffer";
import { DecompressionStream as NativeDecompressionStream } from "node:stream/web";
import { deflateRawSync } from "node:zlib";
import { createHash, webcrypto } from "node:crypto";
import { extractOffice } from "@/lib/local-library/office";
import { readSource, scanDirectory, type Directory } from "@/lib/local-library/files";
import { fileLimit, FILE_LIMIT, OFFICE_LIMIT, supportedPath } from "@/lib/local-library/schema";

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main", A = "http://schemas.openxmlformats.org/drawingml/2006/main", P = "http://schemas.openxmlformats.org/presentationml/2006/main", R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships", PACKAGE = "http://schemas.openxmlformats.org/package/2006/relationships";
const word = (body: string) => `<w:document xmlns:w="${W}"><w:body>${body}</w:body></w:document>`;
const para = (text: string) => `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
const drawing = (text: string) => `<a:p><a:r><a:t>${text}</a:t></a:r></a:p>`;
const slide = (text: string) => `<p:sld xmlns:p="${P}" xmlns:a="${A}"><p:cSld><p:spTree><p:sp><p:txBody>${drawing(text)}</p:txBody></p:sp></p:spTree></p:cSld></p:sld>`;
const rels = (items: [string, string, string, string?][]) => `<Relationships xmlns="${PACKAGE}">${items.map(([id, type, target, mode]) => `<Relationship Id="${id}" Type="${R}/${type}" Target="${target}"${mode ? ` TargetMode="${mode}"` : ""}/>`).join("")}</Relationships>`;
function crc(bytes: Buffer) { let value = 0xffffffff; for (const byte of bytes) { value ^= byte; for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1; } return (value ^ 0xffffffff) >>> 0; }
function zip(entries: Record<string, string>, compressed = true): Buffer {
  const locals: Buffer[] = [], centrals: Buffer[] = []; let offset = 0;
  for (const [name, text] of Object.entries(entries)) {
    const raw = Buffer.from(text), packed = compressed ? deflateRawSync(raw) : raw, filename = Buffer.from(name), local = Buffer.alloc(30), central = Buffer.alloc(46);
    local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt16LE(compressed ? 8 : 0, 8); local.writeUInt32LE(crc(raw), 14); local.writeUInt32LE(packed.length, 18); local.writeUInt32LE(raw.length, 22); local.writeUInt16LE(filename.length, 26);
    central.writeUInt32LE(0x02014b50); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(compressed ? 8 : 0, 10); central.writeUInt32LE(crc(raw), 16); central.writeUInt32LE(packed.length, 20); central.writeUInt32LE(raw.length, 24); central.writeUInt16LE(filename.length, 28); central.writeUInt32LE(offset, 42);
    locals.push(local, filename, packed); centrals.push(central, filename); offset += local.length + filename.length + packed.length;
  }
  const directory = Buffer.concat(centrals), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(Object.keys(entries).length, 8); end.writeUInt16LE(Object.keys(entries).length, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}
const entries = () => ({
  "ppt/presentation.xml": `<p:presentation xmlns:p="${P}" xmlns:r="${R}"><p:sldIdLst><p:sldId id="257" r:id="second"/><p:sldId id="256" r:id="first"/></p:sldIdLst></p:presentation>`,
  "ppt/_rels/presentation.xml.rels": rels([["first", "slide", "slides/slide1.xml"], ["second", "slide", "slides/slide20.xml"]]),
  "ppt/slides/slide1.xml": slide("后显示的第一页文件"),
  "ppt/slides/slide20.xml": slide("先显示的第二十页文件"),
  "ppt/slides/_rels/slide20.xml.rels": rels([["note", "notesSlide", "../notesSlides/notesSlide4.xml"], ["link", "hyperlink", "https://example.invalid/", "External"]]),
  "ppt/notesSlides/notesSlide4.xml": `<p:notes xmlns:p="${P}" xmlns:a="${A}"><p:cSld><p:spTree><p:sp><p:nvSpPr><p:nvPr><p:ph type="body"/></p:nvPr></p:nvSpPr><p:txBody>${drawing("演示方法，结果待核实")}</p:txBody></p:sp><p:sp><p:nvSpPr><p:nvPr><p:ph type="sldNum"/></p:nvPr></p:nvSpPr><p:txBody>${drawing("999")}</p:txBody></p:sp></p:spTree></p:cSld></p:notes>`,
  "ppt/media/image1.png": "unsupported image bytes are never decoded",
});
beforeEach(() => { vi.stubGlobal("Blob", NativeBlob); vi.stubGlobal("DecompressionStream", NativeDecompressionStream); vi.stubGlobal("crypto", webcrypto); });
afterEach(() => { vi.unstubAllGlobals(); });
describe("local Office extraction", () => {
  it.each([true, false])("extracts DOCX paragraphs, table cells and entities; compressed=%s", async compressed => {
    const bytes = zip({ "word/document.xml": word(para("学习 &amp; 比较") + `<w:tbl><w:tr><w:tc>${para("方法甲")}</w:tc><w:tc>${para("待核实")}</w:tc></w:tr></w:tbl>`) }, compressed);
    expect(await extractOffice(bytes, "note.docx")).toBe("学习 & 比较\n方法甲\n待核实");
  });
  it("preserves PPTX presentation order and body notes without slide-number placeholders or external fetch", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    expect(await extractOffice(zip(entries()), "report.PPTX")).toBe("【第1页】\n先显示的第二十页文件\n演讲备注：\n演示方法，结果待核实\n【第2页】\n后显示的第一页文件");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("does not duplicate nested textbox paragraphs or include deleted revisions", async () => {
    const body = `<w:del>${para("删除的段落")}</w:del><w:p><w:r><w:t>正文</w:t></w:r><w:del><w:r><w:t>删除文字</w:t></w:r></w:del><w:txbxContent>${para("文本框")}</w:txbxContent></w:p>`;
    expect(await extractOffice(zip({ "word/document.xml": word(body) }), "a.docx")).toBe("正文\n文本框");
  });
  it("accepts strict OOXML Word namespaces", async () => {
    expect(await extractOffice(zip({ "word/document.xml": word(para("严格格式")).replaceAll(W, "http://purl.oclc.org/ooxml/wordprocessingml/main") }), "a.docx")).toBe("严格格式");
  });
  it("rejects image-only files rather than manufacturing evidence", async () => {
    await expect(extractOffice(zip({ "word/document.xml": word("<w:p/>") }), "a.docx")).rejects.toThrow("没有可提取文字");
  });
  it.each(["not a zip", "", "PK"])('rejects invalid archive %j', async text => {
    await expect(extractOffice(Buffer.from(text), "a.docx")).rejects.toThrow();
  });
  it.each(["<!DOCTYPE document [<!ENTITY x SYSTEM 'file:///private'>]>", "<!ENTITY x 'private'>", "<broken>"])("rejects entities and malformed XML %s", async payload => {
    await expect(extractOffice(zip({ "word/document.xml": payload + word(para("正文")) }), "a.docx")).rejects.toThrow();
  });
  it("rejects CRC corruption", async () => {
    const bytes = zip({ "word/document.xml": word(para("正文")) }, false); bytes[30 + Buffer.byteLength("word/document.xml") + 10] ^= 1;
    await expect(extractOffice(bytes, "a.docx")).rejects.toThrow();
  });
  it("rejects declared huge XML before any decompression", async () => {
    const bytes = zip({ "word/document.xml": word(para("正文")) }); const central = bytes.readUInt32LE(bytes.length - 6); bytes.writeUInt32LE(5 * 1024 * 1024, central + 24);
    const decompressor = vi.fn(); vi.stubGlobal("DecompressionStream", decompressor);
    await expect(extractOffice(bytes, "a.docx")).rejects.toThrow("结构过大"); expect(decompressor).not.toHaveBeenCalled();
  });
  it("stops decompression when actual XML exceeds its declared size", async () => {
    const bytes = zip({ "word/document.xml": word(para("内容".repeat(10000))) }); const central = bytes.readUInt32LE(bytes.length - 6); bytes.writeUInt32LE(10, central + 24);
    await expect(extractOffice(bytes, "a.docx")).rejects.toThrow();
  });
  it("rejects encrypted entries", async () => {
    const bytes = zip({ "word/document.xml": word(para("正文")) }); const central = bytes.readUInt32LE(bytes.length - 6); bytes.writeUInt16LE(1, central + 8); bytes.writeUInt16LE(1, 6);
    await expect(extractOffice(bytes, "a.docx")).rejects.toThrow();
  });
  it("never truncates a long document or accepts oversized input", async () => {
    await expect(extractOffice(zip({ "word/document.xml": word(para("字".repeat(64001))) }), "a.docx")).rejects.toThrow("不会自动截断");
    await expect(extractOffice(new Uint8Array(OFFICE_LIMIT + 1), "a.docx")).rejects.toThrow("20MB");
  });
  it("rejects outside slide relationships without following paths", async () => {
    const input = entries(); input["ppt/_rels/presentation.xml.rels"] = rels([["second", "slide", "../../../outside.xml"]]);
    await expect(extractOffice(zip(input), "a.pptx")).rejects.toThrow();
  });
  it("offers an actionable error for browsers missing raw deflate", async () => {
    vi.stubGlobal("DecompressionStream", undefined);
    await expect(extractOffice(zip({ "word/document.xml": word(para("正文")) }), "a.docx")).rejects.toThrow("新版Chrome或Edge");
  });
  it("hashes exactly the extracted source text sent to AI", async () => {
    const bytes = zip({ "word/document.xml": word(para("原始学习记录")) }), file = new NativeFile([new Uint8Array(bytes)], "note.docx") as unknown as File;
    const source = await readSource({ path: "资料/note.docx", size: file.size, modifiedAt: 1, read: async () => file });
    expect(source.content).toBe("原始学习记录"); expect(source.sha256).toBe(createHash("sha256").update(source.content).digest("hex"));
  });
  it("scans office files above the text limit without decompressing or reading their bodies", async () => {
    const readBody = vi.fn(), directory = { name: "资料", async *values() {
      for (const [name, size] of [["a.pptx", 200000], ["b.docx", 300000], ["big.pptx", OFFICE_LIMIT + 1], ["big.txt", FILE_LIMIT + 1], ["old.doc", 100]]) yield { name, kind: "file", getFile: async () => ({ size, lastModified: 1, arrayBuffer: readBody }) };
    } } as unknown as Directory;
    const result = await scanDirectory(directory); expect(result.files.map(f => f.path)).toEqual(["资料/a.pptx", "资料/b.docx"]); expect(result.skipped).toBe(3); expect(readBody).not.toHaveBeenCalled();
    expect(supportedPath("资料/密码.docx")).toBe(false); expect(fileLimit("a.PPTX")).toBe(OFFICE_LIMIT);
  });
});
