import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import jsQR from "jsqr";
import { PNG } from "pngjs";

const execFileAsync = promisify(execFile);

const swiftClipboardExportScript = String.raw`
import AppKit
import Foundation

let arguments = CommandLine.arguments

guard arguments.count > 1 else {
  fputs("MISSING_OUTPUT_PATH\n", stderr)
  exit(2)
}

let outputPath = arguments[1]
let pasteboard = NSPasteboard.general

guard let image = NSImage(pasteboard: pasteboard) else {
  fputs("NO_IMAGE\n", stderr)
  exit(3)
}

guard let tiffData = image.tiffRepresentation,
      let bitmap = NSBitmapImageRep(data: tiffData),
      let pngData = bitmap.representation(using: .png, properties: [:]) else {
  fputs("PNG_EXPORT_FAILED\n", stderr)
  exit(4)
}

do {
  try pngData.write(to: URL(fileURLWithPath: outputPath))
} catch {
  fputs("WRITE_FAILED\n", stderr)
  exit(5)
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
    await execFileAsync("/usr/bin/swift", ["-e", swiftClipboardExportScript, outputPath]);
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
