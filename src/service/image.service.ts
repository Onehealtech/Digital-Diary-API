import ImageHistory from "../models/ImageHistory.model";

export class ImageService {

  static async uploadImage(diaryId: string, file: Express.Multer.File) {

    if (!file) {
      throw new Error("No file uploaded");
    }

    const image = await ImageHistory.create({
      diaryId,
      imagePath: file.path,
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
