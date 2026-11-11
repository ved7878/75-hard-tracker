/**
 * Client-Side Image Compression Utility
 * Prevents mobile camera photos (5-15 MB) from overflowing browser localStorage quota
 * and optimizes upload speed to Supabase Storage.
 */

export interface CompressedImageResult {
  file: File;
  base64: string;
  originalSizeKb: number;
  compressedSizeKb: number;
}

export async function compressImage(
  file: File,
  maxDimension: number = 1200,
  quality: number = 0.8
): Promise<CompressedImageResult> {
  const originalSizeKb = Math.round(file.size / 1024);

  // If file is not an image (e.g. PDF prescription), read as base64 without canvas resizing
  if (!file.type.startsWith('image/')) {
    const base64 = await readFileAsBase64(file);
    return {
      file,
      base64,
      originalSizeKb,
      compressedSizeKb: originalSizeKb,
    };
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate proportional scale
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          const fallbackBase64 = e.target?.result as string;
          return resolve({
            file,
            base64: fallbackBase64,
            originalSizeKb,
            compressedSizeKb: originalSizeKb,
          });
        }

        // Draw image onto canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Export as JPEG with controlled quality
        const compressedBase64 = canvas.toDataURL('image/jpeg', quality);

        canvas.toBlob(
          blob => {
            if (!blob) {
              return resolve({
                file,
                base64: compressedBase64,
                originalSizeKb,
                compressedSizeKb: Math.round(compressedBase64.length / 1024),
              });
            }

            const compressedFile = new File(
              [blob],
              file.name.replace(/\.[^/.]+$/, '') + '.jpg',
              { type: 'image/jpeg' }
            );

            const compressedSizeKb = Math.round(compressedFile.size / 1024);

            resolve({
              file: compressedFile,
              base64: compressedBase64,
              originalSizeKb,
              compressedSizeKb,
            });
          },
          'image/jpeg',
          quality
        );
      };

      img.onerror = () => {
        // Fallback to raw base64 if image decoding fails
        const fallbackBase64 = e.target?.result as string;
        resolve({
          file,
          base64: fallbackBase64,
          originalSizeKb,
          compressedSizeKb: originalSizeKb,
        });
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = err => reject(err);
    reader.readAsDataURL(file);
  });
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = err => reject(err);
    reader.readAsDataURL(file);
  });
}

