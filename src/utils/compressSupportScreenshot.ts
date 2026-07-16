export const MAX_SUPPORT_SCREENSHOT_BYTES = 500 * 1024;
export const MAX_SUPPORT_SCREENSHOT_WIDTH = 1280;

export type CompressedScreenshot = {
  dataUrl: string;
  name: string;
  contentType: string;
};

function replaceExtension(filename: string, extension: string): string {
  const base = filename.replace(/\.[^.]+$/, '');
  return `${base || 'support-screenshot'}.${extension}`;
}

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read screenshot.'));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Could not compress screenshot.'));
          return;
        }
        resolve(blob);
      },
      type,
      quality
    );
  });
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read compressed screenshot.'));
    reader.readAsDataURL(blob);
  });
}

export async function compressSupportScreenshot(file: File): Promise<CompressedScreenshot> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file.');
  }

  const image = await loadImageFromFile(file);
  const scale = Math.min(1, MAX_SUPPORT_SCREENSHOT_WIDTH / image.width);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Could not prepare screenshot.');
  }
  context.drawImage(image, 0, 0, width, height);

  const attempts: Array<{ type: string; extension: string; qualities: number[] }> = [
    { type: 'image/webp', extension: 'webp', qualities: [0.82, 0.72, 0.62, 0.52, 0.42] },
    { type: 'image/jpeg', extension: 'jpg', qualities: [0.82, 0.72, 0.62, 0.52, 0.42] },
  ];

  for (const attempt of attempts) {
    for (const quality of attempt.qualities) {
      const blob = await canvasToBlob(canvas, attempt.type, quality);
      if (blob.size > MAX_SUPPORT_SCREENSHOT_BYTES) continue;

      const dataUrl = await blobToDataUrl(blob);
      return {
        dataUrl,
        name: replaceExtension(file.name, attempt.extension),
        contentType: attempt.type,
      };
    }
  }

  throw new Error('Screenshot is still too large after compression. Try a smaller image.');
}
