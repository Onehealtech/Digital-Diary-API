import { Request, Response } from "express";
import { ImageService } from "../service/image.service";


export const uploadImage = async (req: Request, res: Response) => {
  try {
    const { id }: any = req.params;

    const image = await ImageService.uploadImage(id, req.file!);

    return res.status(201).json({
      message: "Image uploaded successfully",
      data: image,
    });

  } catch (error: any) {
    return res.status(400).json({
      message: error.message,
    });
  }
};

export const getImageHistory = async (req: Request, res: Response) => {
  try {
    const { id }: any = req.params;

    const images = await ImageService.getImageHistory(id);

    return res.status(200).json({
      count: images.length,
      data: images,
    });

  } catch (error: any) {
    return res.status(500).json({
      message: error.message,
    });
  }
};
