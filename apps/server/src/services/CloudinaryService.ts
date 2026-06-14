import { v2 as cloudinary } from 'cloudinary';
import { ApiResponse } from '../types/index';

// Validate Cloudinary configuration
if (
  !process.env.CLOUDINARY_CLOUD_NAME ||
  !process.env.CLOUDINARY_API_KEY ||
  !process.env.CLOUDINARY_API_SECRET
) {
  console.warn('⚠️  Cloudinary credentials not configured. Please set:');
  console.warn('   CLOUDINARY_CLOUD_NAME');
  console.warn('   CLOUDINARY_API_KEY');
  console.warn('   CLOUDINARY_API_SECRET');
  console.warn('   at https://cloudinary.com');
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export class CloudinaryService {
  /**
   * Upload image to Cloudinary and return the URL
   * @param fileBuffer - File buffer from request
   * @param folder - Folder path in Cloudinary (e.g., 'gallery', 'stories')
   * @returns URL of uploaded image
   */
  static async uploadImage(
    fileBuffer: Buffer,
    folder: string = 'united-hatzalah'
  ): Promise<ApiResponse<{ url: string; publicId: string }>> {
    try {
      // Check if credentials are configured
      if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY) {
        return {
          success: false,
          error:
            'Cloudinary not configured. Please set CLOUDINARY_CLOUD_NAME and CLOUDINARY_API_KEY in .env',
          timestamp: new Date(),
        };
      }

      return new Promise(resolve => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: `united-hatzalah/${folder}`,
            resource_type: 'auto',
            quality: 'auto',
            eager: [{ width: 400, height: 300, crop: 'fill', quality: 'auto' }],
          },
          (error, result) => {
            if (error) {
              resolve({
                success: false,
                error: `Upload failed: ${error.message}`,
                timestamp: new Date(),
              });
              return;
            }

            if (!result) {
              resolve({
                success: false,
                error: 'Upload failed: No result returned',
                timestamp: new Date(),
              });
              return;
            }

            // Generate responsive URL with multiple transformations
            // Using Cloudinary's image optimization for web:
            // - c_fill: fill the container
            // - w_1000: max width
            // - q_auto: auto quality
            // - f_auto: auto format (webp, avif, etc.)
            const publicId = result.public_id;
            const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
            const optimizedUrl = `https://res.cloudinary.com/${cloudName}/image/upload/c_fill,w_1000,q_auto,f_auto/${publicId}`;

            resolve({
              success: true,
              data: {
                url: optimizedUrl,
                publicId: result.public_id,
              },
              timestamp: new Date(),
            });
          }
        );

        uploadStream.end(fileBuffer);
      });
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
        timestamp: new Date(),
      };
    }
  }

  /**
   * Delete image from Cloudinary
   */
  static async deleteImage(publicId: string): Promise<ApiResponse<null>> {
    try {
      await cloudinary.uploader.destroy(publicId);
      return {
        success: true,
        data: null,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Delete failed',
        timestamp: new Date(),
      };
    }
  }
}
