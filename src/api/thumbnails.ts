import { getBearerToken, validateJWT } from "../auth";
import { respondWithJSON } from "./json";
import { getVideo, getVideos, updateVideo } from "../db/videos";
import type { ApiConfig } from "../config";
import type { BunRequest } from "bun";
import { BadRequestError, NotFoundError, UserForbiddenError } from "./errors";

type Thumbnail = {
  data: ArrayBuffer;
  mediaType: string;
};




export async function handlerUploadThumbnail(cfg: ApiConfig, req: BunRequest) {
  const { videoId } = req.params as { videoId?: string };
  if (!videoId) {
    throw new BadRequestError("Invalid video ID");
  }

  const token = getBearerToken(req.headers);
  const userID = validateJWT(token, cfg.jwtSecret);

  console.log("uploading thumbnail for video", videoId, "by user", userID);

  const formData = await req.formData();

  const ThumbnailData = formData.get("thumbnail")

  if (!(ThumbnailData instanceof File)) {
    throw new BadRequestError(`Object is not an instance of File`)
  }

  const MAX_UPLOAD_SIZE = 10;

  const file_size = MAX_UPLOAD_SIZE * 1024 * 1024;

  if (ThumbnailData.size > file_size){
    throw new BadRequestError(`File greater than 10MB`)
  }


  const videoMeta = getVideo(cfg.db, videoId)

  if (videoMeta?.userID !== userID) {
    throw new UserForbiddenError(`You didn't upload the video, did you now >.<`)
  }

  const mType = ThumbnailData.type;

  const imageData = await ThumbnailData.arrayBuffer();

  const imgBuffer = Buffer.from(imageData).toString("base64")

  const dataURL = `data:${mType};base64,${imgBuffer}`

    

  videoMeta.thumbnailURL = dataURL

  updateVideo(cfg.db, videoMeta)


  return respondWithJSON(200, videoMeta);
}
