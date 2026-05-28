import { respondWithJSON } from "./json";

import { type ApiConfig } from "../config";
import type { BunRequest, S3File } from "bun";
import { BadRequestError, UserForbiddenError } from "./errors";
import { getBearerToken, validateJWT } from "../auth";
import { getVideo, updateVideo } from "../db/videos";
import { getAssetDiskPath, mediaTypeToExt } from "./assets";
import { randomBytes } from "node:crypto";

const MAX_UPLOAD_SIZE = 1; //1 GB


export async function handlerUploadVideo(cfg: ApiConfig, req: BunRequest) {
  const {videoId} = req.params as { videoId? :string};
  if (!videoId) {
    throw new BadRequestError(`Invalid video ID`);
  }
  const token = getBearerToken(req.headers);
  const userID = validateJWT(token, cfg.jwtSecret);

  const videoMeta = getVideo(cfg.db, videoId)

  if (videoMeta?.userID !== userID){
    throw new UserForbiddenError(`User is not the video owner, can't upload video`)
  }

  console.log("uploading video for", videoId, "by user", userID);

  const formData = await req.formData();

  const videoData = formData.get("video")

  if (!(videoData instanceof File)){
    throw new BadRequestError(`Object is not an instance of File`)
  }

  const file_size = MAX_UPLOAD_SIZE * 1024 * 1024 * 1024;

  if (videoData.size > file_size){
    throw new BadRequestError(`File greater than 1 GB`)
  }

  const mType = videoData.type;

  if (mType !== "video/mp4") {
    throw new BadRequestError(`Media type isn't MP4`)
  }



  const filename = `${randomBytes(32).toString("hex")}.mp4`

  const assetDiskPathTmp = getAssetDiskPath(cfg, `tmp/${filename}`)

  await Bun.write(assetDiskPathTmp, videoData)

  console.log(`tmp file saved`)

  const s3file: S3File = cfg.s3Client.file(filename);

  await s3file.write(videoData, {type: "video/mp4"})

  const urlPath = `https://${cfg.s3Bucket}.s3.${cfg.s3Region}.amazonaws.com/${filename}`

  videoMeta.videoURL = urlPath

  updateVideo(cfg.db, videoMeta)


  await Bun.file(assetDiskPathTmp).delete();

  return respondWithJSON(200, videoMeta);
}
