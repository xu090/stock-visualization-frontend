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

KAFKA_BOOTSTRAP_SERVERS = get_env(
    "KAFKA_BOOTSTRAP_SERVERS",
    "172.29.34.31:9092,172.29.34.32:9092,172.29.34.33:9092",
)
KAFKA_STOCK_TIME_SHARING_TOPIC = get_env("KAFKA_STOCK_TIME_SHARING_TOPIC", "stock-time-sharing-topic")
KAFKA_GROUP_ID = get_env("KAFKA_GROUP_ID", "stock-visualization-stock-time-sharing")
KAFKA_AUTO_OFFSET_RESET = get_env("KAFKA_AUTO_OFFSET_RESET", "latest")
ENABLE_KAFKA_CONSUMER = str(get_env("ENABLE_KAFKA_CONSUMER", "true")).lower() in {"1", "true", "yes", "on"}
