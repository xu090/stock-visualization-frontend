"""
更新股票代码-市值映射文件
使用 akshare 获取所有 A 股股票的总市值，更新 stock_market_cap_mapping.py
"""

from __future__ import annotations

import os
import shutil
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import akshare as ak
import pandas as pd
from app.config import STOCK_MARKET_CAP_MAPPING_FILE


DEFAULT_OUTPUT_FILE = Path(STOCK_MARKET_CAP_MAPPING_FILE or r"e:\data_process\data_collection\stock_market_cap_mapping.py")


def normalize_code(raw: Any) -> str:
    if raw is None:
        return ""
    text = str(raw).strip()
    if not text:
        return ""
    if "." in text:
        text = text.split(".")[0]
    if text[:2].lower() in {"sh", "sz", "bj"}:
        text = text[2:]
    return text.zfill(6) if text.isdigit() and len(text) < 6 else text


def safe_float(value: Any) -> float | None:
    if value is None or pd.isna(value):
        return None
    try:
        text = str(value).strip().replace(",", "")
        if not text or text in {"-", "--", "nan", "None"}:
            return None
        return float(text)
    except (TypeError, ValueError):
        return None


def fetch_stock_market_caps() -> dict[str, float] | None:
    print("正在从 akshare 获取股票实时行情数据...")

    try:
        df = ak.stock_zh_a_spot_em()
        print(f"成功获取 {len(df)} 条股票数据")
        print(f"\n数据列名: {df.columns.tolist()}")

        required_columns = {"代码", "总市值"}
        missing = required_columns - set(df.columns)
        if missing:
            print(f"错误: 数据中缺少必要列: {sorted(missing)}")
            print(f"可用列: {df.columns.tolist()}")
            return None

        market_cap_mapping: dict[str, float] = {}
        for _, row in df.iterrows():
            code = normalize_code(row["代码"])
            market_cap = safe_float(row["总市值"])
            if not code or market_cap is None:
                continue
            market_cap_mapping[code] = market_cap

        print(f"\n成功提取 {len(market_cap_mapping)} 条股票代码-市值映射")
        return market_cap_mapping
    except Exception as exc:
        print(f"获取数据时发生错误: {exc}")
        import traceback

        traceback.print_exc()
        return None


def resolve_output_file() -> Path:
    configured = os.getenv("STOCK_MARKET_CAP_MAPPING_FILE")
    return Path(configured) if configured else DEFAULT_OUTPUT_FILE


def generate_mapping_file(market_cap_mapping: dict[str, float]) -> None:
    if not market_cap_mapping:
        print("没有数据可生成")
        return

    sorted_data = dict(sorted(market_cap_mapping.items()))
    file_content = f'''# 自动生成的股票代码-市值映射
# 生成时间: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
# 数据来源: akshare.stock_zh_a_spot_em()
# 市值单位: 元

STOCK_MARKET_CAP_MAPPING = {{
'''

    for code, market_cap in sorted_data.items():
        file_content += f'    "{code}": {market_cap:.2f},\n'

    file_content += "}\n"

    output_file = resolve_output_file()
    output_file.parent.mkdir(parents=True, exist_ok=True)

    if output_file.exists():
        backup_file = output_file.with_suffix(".py.bak")
        shutil.copy2(output_file, backup_file)
        print(f"已备份原文件到: {backup_file}")

    output_file.write_text(file_content, encoding="utf-8")
    print(f"\n股票市值映射文件已更新: {output_file}")
    print(f"共 {len(market_cap_mapping)} 条记录")


def main() -> None:
    print(
        """
============================================================
          股票市值映射文件更新工具
============================================================
"""
    )

    market_cap_mapping = fetch_stock_market_caps()
    if market_cap_mapping:
        generate_mapping_file(market_cap_mapping)
        print("\n更新完成")
    else:
        print("\n未能获取数据，请检查网络连接和 akshare 库")


if __name__ == "__main__":
    main()
