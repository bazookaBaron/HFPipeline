"""Local-only instagrapi bridge. Accepts one JSON request on stdin; never logs secrets."""

import json
import subprocess
import sys
import tempfile
from pathlib import Path

from instagrapi import Client
from instagrapi.utils.video import read_video_metadata


def main():
    request = json.load(sys.stdin)
    mode = request.get("mode")
    expected = str(request.get("expectedAccount", "")).lower().lstrip("@")
    if mode not in {"preflight", "publish"} or not expected:
        raise ValueError("Invalid Instagram worker request")

    client = Client()
    settings_path = Path(request["settingsPath"])
    if settings_path.is_file():
        client.load_settings(settings_path)
        try:
            account = client.account_info()
        except Exception:
            client = Client()
            account = None
    else:
        account = None

    if account is None:
        session_id = request.get("sessionId")
        if not session_id:
            raise RuntimeError("Instagram private session is unavailable; reconnect locally")
        client.login_by_sessionid(session_id)
        account = client.account_info()

    if account.username.lower() != expected:
        raise RuntimeError("Instagram account does not match the confirmed account")
    settings_path.parent.mkdir(parents=True, exist_ok=True)
    client.dump_settings(settings_path)

    if mode == "preflight":
        return {"ok": True, "username": account.username}

    video = Path(request["videoPath"])
    if not video.is_file() or video.suffix.lower() != ".mp4":
        raise ValueError("Expected a local MP4")
    caption = str(request.get("caption", "")).strip()
    if not caption or len(caption) > 2200:
        raise ValueError("Instagram caption must contain 1–2200 characters")

    # Instagram requires a cover payload; use an unedited frame of the video,
    # never the separate graphic thumbnail prepared for other platforms.
    metadata = read_video_metadata(video)
    with tempfile.TemporaryDirectory(prefix="hf-ig-frame-") as temp_dir:
        frame = Path(temp_dir) / "video-frame.jpg"
        subprocess.run(
            ["ffmpeg", "-v", "error", "-ss", str(metadata.duration / 2), "-i", str(video),
             "-frames:v", "1", "-q:v", "2", str(frame)],
            check=True, capture_output=True, timeout=30,
        )
        if not frame.is_file():
            raise RuntimeError("Could not extract a frame from the video")
        media = client.clip_upload(video, caption, thumbnail=frame, trial=False)
    confirmed = client.media_info(media.pk)
    if confirmed.product_type != "clips" or confirmed.user.username.lower() != expected:
        raise RuntimeError("Upload returned, but the Reel/account could not be verified")
    return {
        "ok": True,
        "username": account.username,
        "mediaId": str(confirmed.pk),
        "code": confirmed.code,
        "url": f"https://www.instagram.com/reel/{confirmed.code}/",
        "productType": confirmed.product_type,
    }


if __name__ == "__main__":
    try:
        print(json.dumps(main()))
    except Exception as error:
        # Exception strings can include HTTP headers/cookies. Emit class only.
        print(json.dumps({"ok": False, "errorClass": type(error).__name__}))
        sys.exit(1)
