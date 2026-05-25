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

const videoThumbnails: Map<string, Thumbnail> = new Map();

export async function handlerGetThumbnail(cfg: ApiConfig, req: BunRequest) {
  const { videoId } = req.params as { videoId?: string };
  if (!videoId) {
    throw new BadRequestError("Invalid video ID");
  }

  const video = getVideo(cfg.db, videoId);
  if (!video) {
    throw new NotFoundError("Couldn't find video");
  }

  const thumbnail = videoThumbnails.get(videoId);
  if (!thumbnail) {
    throw new NotFoundError("Thumbnail not found");
  }

  return new Response(thumbnail.data, {
    headers: {
      "Content-Type": thumbnail.mediaType,
      "Cache-Control": "no-store",
    },
  });
}

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

  const thumb:Thumbnail = {data: imageData, mediaType: mType}


  videoThumbnails.set(videoId, thumb)

  videoMeta.thumbnailURL = `http://localhost:${cfg.port}/api/thumbnails/${videoId}`

  updateVideo(cfg.db, videoMeta)


  return respondWithJSON(200, videoMeta);
}
