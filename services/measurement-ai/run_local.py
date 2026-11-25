"""Local-only test launcher. Run with .venv/bin/python run_local.py."""
import os
import secrets
from pathlib import Path

from dotenv import load_dotenv
import uvicorn

if __name__ == "__main__":
    root = Path(__file__).resolve().parent
    os.chdir(root)
    env = root / ".env.local"
    if not env.exists():
        fd = os.open(env, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "w") as stream:
            stream.write("MEASUREMENT_AI_TOKEN=" + secrets.token_urlsafe(48) + "\n")
    load_dotenv(env)
    os.environ.setdefault("HF_HOME", str(root / ".venv/model-cache"))
    os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")
    os.environ.setdefault("DO_NOT_TRACK", "1")
    uvicorn.run("server:app", host="127.0.0.1", port=8000, workers=1, access_log=False)
