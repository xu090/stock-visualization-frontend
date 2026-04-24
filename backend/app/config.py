import os
from pathlib import Path


def load_dotenv() -> None:
    # 启动时自动读取 backend/.env，避免本地开发每次手动设置环境变量。
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


load_dotenv()


def get_env(name: str, default: str | None = None) -> str | None:
    # 把空字符串也视为“未配置”，这样默认值行为更稳定。
    value = os.getenv(name)
    if value is None or value == "":
        return default
    return value


POSTGRES_DSN = get_env("POSTGRES_DSN", "postgresql://postgres:postgres@127.0.0.1:5432/stock_app")
STOCK_NAME_MAPPING_FILE = get_env("STOCK_NAME_MAPPING_FILE", r"e:\data_process\data_collection\stock_name_mapping.py")
AUTO_BOOTSTRAP_CONCEPTS = str(get_env("AUTO_BOOTSTRAP_CONCEPTS", "true")).lower() in {"1", "true", "yes", "on"}
