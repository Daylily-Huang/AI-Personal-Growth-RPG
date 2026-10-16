import { OFFICE_LIMIT, TEXT_LIMIT } from "./schema";

// Read only the required XML parts. Embedded images, links and objects are never opened.
const XML_LIMIT = 4 * 1024 * 1024, TOTAL_XML_LIMIT = 12 * 1024 * 1024;
const W = ["http://schemas.openxmlformats.org/wordprocessingml/2006/main", "http://purl.oclc.org/ooxml/wordprocessingml/main"];
const A = ["http://schemas.openxmlformats.org/drawingml/2006/main", "http://purl.oclc.org/ooxml/drawingml/main"];
const P = ["http://schemas.openxmlformats.org/presentationml/2006/main", "http://purl.oclc.org/ooxml/presentationml/main"];
const R = ["http://schemas.openxmlformats.org/officeDocument/2006/relationships", "http://purl.oclc.org/ooxml/officeDocument/relationships"];
const PACKAGE = "http://schemas.openxmlformats.org/package/2006/relationships";
const fail = () => new Error("文档已损坏、已加密或使用了不支持的格式，请另存为标准PPTX/DOCX后重试");
type Part = { name: string; offset: number; compressed: number; size: number; method: number; flags: number; crc: number };
const is = (element: Element, names: string[], local: string) => names.includes(element.namespaceURI ?? "") && element.localName === local;
const elements = (root: Document | Element) => Array.from(root.getElementsByTagName("*"));
function parseXml(bytes: Uint8Array): Document {
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw fail();
  const xml = new DOMParser().parseFromString(text, "application/xml");
  if (xml.getElementsByTagName("parsererror").length || !xml.documentElement) throw fail();
  return xml;
}
function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}
function archive(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = (n: number) => view.getUint16(n, true), u32 = (n: number) => view.getUint32(n, true);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) if (u32(i) === 0x06054b50 && i + 22 + u16(i + 20) === bytes.length) { end = i; break; }
  if (end < 0 || u16(end + 4) || u16(end + 6) || u16(end + 8) !== u16(end + 10)) throw fail();
  const count = u16(end + 10), centralSize = u32(end + 12), central = u32(end + 16);
  if (!count || count > 5000 || central + centralSize !== end) throw fail();
  const parts = new Map<string, Part>(); let at = central, total = 0;
  for (let i = 0; i < count; i++) {
    if (at + 46 > end || u32(at) !== 0x02014b50) throw fail();
    const nameLength = u16(at + 28), extra = u16(at + 30), comment = u16(at + 32), next = at + 46 + nameLength + extra + comment;
    if (next > end || u16(at + 34)) throw fail();
    const name = new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(at + 46, at + 46 + nameLength));
    const part = { name, offset: u32(at + 42), compressed: u32(at + 20), size: u32(at + 24), method: u16(at + 10), flags: u16(at + 8), crc: u32(at + 16) };
    if (!name || parts.has(name) || part.offset >= central || [part.offset, part.size, part.compressed].includes(0xffffffff)) throw fail();
    parts.set(name, part); at = next;
  }
  if (at !== end) throw fail();
  async function xml(name: string): Promise<Document> {
    const part = parts.get(name); if (!part) throw fail();
    if (!part.size || part.size > XML_LIMIT || (total += part.size) > TOTAL_XML_LIMIT) throw Error("文档文字结构过大，请按章节或幻灯片拆分后重试");
    const at = part.offset;
    if (at + 30 > central || u32(at) !== 0x04034b50 || (part.flags & 0x2041) || u16(at + 6) !== part.flags || u16(at + 8) !== part.method) throw fail();
    const nameLength = u16(at + 26), start = at + 30 + nameLength + u16(at + 28);
    if (start + part.compressed > central || new TextDecoder().decode(bytes.subarray(at + 30, at + 30 + nameLength)) !== name) throw fail();
    const packed = bytes.slice(start, start + part.compressed); let output: Uint8Array;
    if (part.method === 0) output = packed;
    else if (part.method === 8) {
      if (typeof DecompressionStream === "undefined") throw Error("此浏览器不支持本地文档解压，请使用新版Chrome或Edge");
      let stream: DecompressionStream;
      try { stream = new DecompressionStream("deflate-raw"); } catch { throw Error("此浏览器不支持本地文档解压，请使用新版Chrome或Edge"); }
      const reader = new Blob([packed]).stream().pipeThrough(stream).getReader();
      const chunks: Uint8Array[] = []; let length = 0;
      try {
        while (true) { const chunk = await reader.read(); if (chunk.done) break; length += chunk.value.length; if (length > part.size || length > XML_LIMIT) throw fail(); chunks.push(chunk.value); }
      } catch (error) { await reader.cancel().catch(() => undefined); throw error; }
      finally { reader.releaseLock(); }
      output = new Uint8Array(length); let offset = 0; for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; }
    } else throw fail();
    if (output.length !== part.size || crc32(output) !== part.crc) throw fail();
    return parseXml(output);
  }
  return { xml, has: (name: string) => parts.has(name) };
}
function paragraphs(root: Element, namespaces: string[]): string[] {
  return elements(root).filter(el => is(el, namespaces, "p")).map(paragraph => {
    let ancestor: Element | null = paragraph;
    while (ancestor) { if (is(ancestor, W, "del")) return ""; ancestor = ancestor.parentElement; }
    return elements(paragraph).filter(el => is(el, namespaces, "t") || is(el, namespaces, "tab") || is(el, namespaces, "br"))
      .filter(el => { let parent: Element | null = el.parentElement; while (parent && parent !== paragraph) { if (is(parent, W, "del") || is(parent, namespaces, "p")) return false; parent = parent.parentElement; } return true; })
      .map(el => el.localName === "tab" ? "\t" : el.localName === "br" ? "\n" : el.textContent ?? "").join("").trim();
  }).filter(Boolean);
}
function relationshipPath(part: string, target: string): string {
  if (!target || /[\\:%?#\0]/.test(target)) throw fail();
  const bits = target.startsWith("/") ? [] : part.split("/").slice(0, -1);
  for (const bit of target.split("/")) { if (!bit || bit === ".") continue; if (bit === "..") { if (!bits.length) throw fail(); bits.pop(); } else bits.push(bit); }
  return bits.join("/");
}
function relationships(xml: Document, part: string) {
  if (xml.documentElement.namespaceURI !== PACKAGE || xml.documentElement.localName !== "Relationships") throw fail();
  const result = new Map<string, { path: string; type: string }>();
  for (const el of Array.from(xml.documentElement.children)) {
    if (el.localName !== "Relationship" || el.namespaceURI !== PACKAGE) throw fail();
    const id = el.getAttribute("Id"), type = el.getAttribute("Type") ?? "";
    if (!id || result.has(id)) throw fail();
    if (el.getAttribute("TargetMode") === "External" || !/\/(?:slide|notesSlide)$/.test(type)) continue;
    result.set(id, { path: relationshipPath(part, el.getAttribute("Target") ?? ""), type });
  }
  return result;
}
export async function extractOffice(bytes: Uint8Array, name: string): Promise<string> {
  if (!bytes.length || bytes.length > OFFICE_LIMIT) throw Error("PPTX/DOCX最高20MB，请拆分文档后重试");
  const zip = archive(bytes), blocks: string[] = [];
  if (name.toLowerCase().endsWith(".docx")) {
    const document = await zip.xml("word/document.xml"), body = elements(document).find(el => is(el, W, "body"));
    if (!body) throw fail();
    blocks.push(...paragraphs(body, W));
  } else if (name.toLowerCase().endsWith(".pptx")) {
    const main = "ppt/presentation.xml", presentation = await zip.xml(main), rels = relationships(await zip.xml("ppt/_rels/presentation.xml.rels"), main);
    const list = elements(presentation).find(el => is(el, P, "sldIdLst")); if (!list) throw fail();
    const slides = Array.from(list.children); if (slides.length > 500) throw Error("幻灯片超过500页，请拆分后重试");
    for (const [index, slide] of slides.entries()) {
      if (!is(slide, P, "sldId")) throw fail();
      const id = R.map(ns => slide.getAttributeNS(ns, "id")).find(Boolean), relation = id ? rels.get(id) : undefined;
      if (!relation || !/\/slide$/.test(relation.type) || !/^ppt\/slides\/[^/]+\.xml$/.test(relation.path)) throw fail();
      const content = paragraphs((await zip.xml(relation.path)).documentElement, A);
      const relPath = relation.path.replace(/\/([^/]+)$/, "/_rels/$1.rels");
      if (zip.has(relPath)) {
        const notes = [...relationships(await zip.xml(relPath), relation.path).values()].find(rel => /\/notesSlide$/.test(rel.type));
        if (notes) {
          if (!/^ppt\/notesSlides\/[^/]+\.xml$/.test(notes.path)) throw fail();
          const noteXml = await zip.xml(notes.path);
          const shapes = elements(noteXml).filter(el => is(el, P, "sp") && elements(el).some(ph => is(ph, P, "ph") && ph.getAttribute("type") === "body"));
          const text = shapes.flatMap(shape => paragraphs(shape, A)); if (text.length) content.push("演讲备注：", ...text);
        }
      }
      if (content.length) blocks.push(`【第${index + 1}页】`, ...content);
      if (blocks.join("\n").length > TEXT_LIMIT) throw Error("提取文字超过64,000字符，请拆分文档后重试；不会自动截断");
    }
  } else throw fail();
  const text = blocks.join("\n").trim();
  if (!text) throw Error("文档中没有可提取文字；图片或扫描件暂不识别，请另选文字版文件");
  if (text.length > TEXT_LIMIT) throw Error("提取文字超过64,000字符，请拆分文档后重试；不会自动截断");
  return text;
}
