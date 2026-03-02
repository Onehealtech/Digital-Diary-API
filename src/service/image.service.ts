import ImageHistory from "../models/ImageHistory.model";

export class ImageService {

  static async uploadImage(diaryId: string, file: Express.Multer.File) {

    if (!file) {
      throw new Error("No file uploaded");
    }

    const baseUrl = (process.env.BASE_URL || '').replace(/\/$/, '');
    const image = await ImageHistory.create({
      diaryId,
      imagePath: baseUrl ? `${baseUrl}/uploads/${file.filename}` : `/uploads/${file.filename}`,
      fileName: file.filename,
    });

    return image;
  }

  static async getImageHistory(diaryId: string) {

    const images = await ImageHistory.findAll({
      where: { diaryId },
      order: [["createdAt", "DESC"]],
    });

    return images;
  }
}
