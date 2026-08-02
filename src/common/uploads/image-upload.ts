import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { extname, join } from 'path';
import { diskStorage } from 'multer';

const MIME_EXTENSIONS: Readonly<Record<string, string>> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

function normalizeSubdirectory(subdirectory: string): string {
  const value = subdirectory.trim();
  if (!value) return '';

  if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
    throw new Error('El subdirectorio de imágenes configurado no es válido.');
  }

  return value;
}

export function imageUploadOptions(
  subdirectory = '',
  maxSizeMb = 2,
) {
  const normalizedSubdirectory = normalizeSubdirectory(subdirectory);
  const uploadRoot = process.env.UPLOAD_DIR || 'uploads';
  const destination = join(
    process.cwd(),
    uploadRoot,
    normalizedSubdirectory,
  );

  mkdirSync(destination, { recursive: true });

  return {
    storage: diskStorage({
      destination: (
        _request: unknown,
        _file: Express.Multer.File,
        callback: (error: Error | null, path: string) => void,
      ) => callback(null, destination),
      filename: (
        _request: unknown,
        file: Express.Multer.File,
        callback: (error: Error | null, filename: string) => void,
      ) => {
        const extension =
          MIME_EXTENSIONS[file.mimetype] ||
          extname(file.originalname).toLowerCase();
        callback(null, `${randomUUID()}${extension}`);
      },
    }),
    limits: {
      files: 1,
      fileSize: Math.max(1, maxSizeMb) * 1024 * 1024,
    },
    fileFilter: (
      _request: unknown,
      file: Express.Multer.File,
      callback: (error: Error | null, acceptFile: boolean) => void,
    ) => {
      const normalizedExtension = extname(file.originalname).toLowerCase();
      const validMime = Object.hasOwn(MIME_EXTENSIONS, file.mimetype);
      const validExtension = ['.jpg', '.jpeg', '.png', '.webp'].includes(
        normalizedExtension,
      );

      if (!validMime || !validExtension) {
        callback(
          new BadRequestException(
            'El archivo debe ser una imagen JPG, PNG o WebP.',
          ),
          false,
        );
        return;
      }

      callback(null, true);
    },
  };
}
