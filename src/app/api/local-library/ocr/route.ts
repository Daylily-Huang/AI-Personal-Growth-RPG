import { OCRInputSchema, supportedPath } from "@/lib/local-library/schema";
import { ocrBody, recognizeImage } from "@/lib/local-library/ocr";
import { LibraryError } from "@/lib/local-library/store";
import { libraryFailure, libraryResponse, libraryUser } from "@/lib/local-library/http";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    await libraryUser(request);
    const input = OCRInputSchema.parse(await ocrBody(request));
    if (!supportedPath(input.path)) throw new LibraryError("图片类型或路径不支持");
    const result = await recognizeImage(input.base64, request.signal);
    return libraryResponse(result);
  } catch (error) { return libraryFailure(error); }
}
