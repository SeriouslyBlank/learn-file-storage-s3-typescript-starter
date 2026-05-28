import { getBearerToken, validateJWT } from "../auth";
import { respondWithJSON } from "./json";
import { getVideo, getVideos, updateVideo } from "../db/videos";
import type { ApiConfig } from "../config";
import type { BunRequest } from "bun";
import { BadRequestError, NotFoundError, UserForbiddenError } from "./errors";
import path from "node:path"
import { getAssetDiskPath, getAssetURL, mediaTypeToExt } from "./assets";
import { randomBytes } from "node:crypto";

type Thumbnail = {
  data: ArrayBuffer;
  mediaType: string;
};

const MAX_UPLOAD_SIZE = 10; //10MB


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


  const file_size = MAX_UPLOAD_SIZE * 1024 * 1024;

  if (ThumbnailData.size > file_size){
    throw new BadRequestError(`File greater than 10MB`)
  }


  const videoMeta = getVideo(cfg.db, videoId)

  if (videoMeta?.userID !== userID) {
    throw new UserForbiddenError(`You didn't upload the video, did you now >.<`)
  }

  const mType = ThumbnailData.type;

  if (!mType){
    throw new BadRequestError(`Missing Content-Type for thumbnail`)
  } else if (mType != "image/jpeg" && mType != "image/png") {
    throw new BadRequestError(`Media type isnt JPEG or PNG`)
  }


  const ext = mediaTypeToExt(mType)

  const filename = `${randomBytes(32).toString("base64")}${ext}`

  const assetDiskPath = getAssetDiskPath(cfg, filename);


  await Bun.write(assetDiskPath, ThumbnailData)

  const urlPath = getAssetURL(cfg, filename)

  

  videoMeta.thumbnailURL = urlPath

  updateVideo(cfg.db, videoMeta)


  return respondWithJSON(200, videoMeta);
}
