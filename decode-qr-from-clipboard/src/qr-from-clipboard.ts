import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import jsQR from "jsqr";
import { PNG } from "pngjs";

const execFileAsync = promisify(execFile);

const jxaClipboardExportScript = String.raw`
ObjC.import("AppKit");
ObjC.import("Foundation");

function run(argv) {
  const outputPath = argv[0];

  if (!outputPath) {
    throw new Error("MISSING_OUTPUT_PATH");
  }

  const pasteboard = $.NSPasteboard.generalPasteboard;
  const image = $.NSImage.alloc.initWithPasteboard(pasteboard);
  const tiffData = image.TIFFRepresentation;

  if (!tiffData) {
    throw new Error("NO_IMAGE");
  }

  const bitmap = $.NSBitmapImageRep.imageRepWithData(tiffData);

  if (!bitmap) {
    throw new Error("PNG_EXPORT_FAILED");
  }

  const pngData = bitmap.representationUsingTypeProperties($.NSPNGFileType, null);

  if (!pngData) {
    throw new Error("PNG_EXPORT_FAILED");
  }

  const didWrite = pngData.writeToFileAtomically(outputPath, true);

  if (!didWrite) {
    throw new Error("WRITE_FAILED");
  }

  return "OK";
}
`;

export async function decodeFirstQrCodeFromClipboard(): Promise<string> {
  if (process.platform !== "darwin") {
    throw new Error("This command currently supports macOS only.");
  }

  const temporaryDirectory = await mkdtemp(join(tmpdir(), "raycast-qr-"));
  const imagePath = join(temporaryDirectory, "clipboard-image.png");

  try {
    await exportClipboardImageToPng(imagePath);
    return await decodeFirstQrCodeFromPng(imagePath);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

async function exportClipboardImageToPng(outputPath: string): Promise<void> {
  try {
    await execFileAsync("/usr/bin/osascript", ["-l", "JavaScript", "-e", jxaClipboardExportScript, outputPath]);
  } catch (error) {
    const stderr = getExecErrorStderr(error);

    if (stderr.includes("NO_IMAGE")) {
      throw new Error("No image found in the clipboard.");
    }

    throw new Error("Could not read an image from the clipboard.");
  }
}

async function decodeFirstQrCodeFromPng(imagePath: string): Promise<string> {
  const imageBuffer = await readFile(imagePath);
  const image = PNG.sync.read(imageBuffer);
  const pixelData = new Uint8ClampedArray(image.data);
  const decodedCode = jsQR(pixelData, image.width, image.height);

  if (!decodedCode) {
    throw new Error("No QR code found in the clipboard image.");
  }

  if (decodedCode.data.length === 0) {
    throw new Error("Decoded QR code was empty.");
  }

  return decodedCode.data;
}

function getExecErrorStderr(error: unknown): string {
  if (typeof error === "object" && error !== null && "stderr" in error) {
    return String(error.stderr ?? "");
  }

  return "";
}
