#!/usr/bin/env python3
"""测试操作日志功能的脚本"""

import sys
import os

# 添加项目路径到 sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.operation_log_service import (
    ensure_operation_log_table,
    log_operation,
    fetch_operation_logs,
    get_operation_log_stats,
)


def test_operation_logs():
    """测试操作日志功能"""
    print("=" * 60)
    print("测试操作日志功能")
    print("=" * 60)
    print()

    # 1. 确保表存在
    print("1. 检查/创建操作日志表...")
    try:
        ensure_operation_log_table()
        print("   [OK] 操作日志表创建/检查成功")
    except Exception as e:
        print(f"   [ERROR] 操作日志表创建失败: {e}")
        return False

    print()

    # 2. 记录测试日志
    print("2. 记录测试操作日志...")
    test_operations = [
        {
            "user_id": 2,
            "username": "admin",
            "role": "admin",
            "action": "login",
            "resource": "user",
            "details": "用户登录: admin",
            "ip": "127.0.0.1",
            "result": "success"
        },
        {
            "user_id": 2,
            "username": "admin",
            "role": "admin",
            "action": "create",
            "resource": "concept",
            "details": "创建概念'测试概念'",
            "ip": "127.0.0.1",
            "result": "success"
        },
        {
            "user_id": 2,
            "username": "admin",
            "role": "admin",
            "action": "update",
            "resource": "strategy",
            "details": "更新策略'价值投资'参数",
            "ip": "127.0.0.1",
            "result": "success"
        },
        {
            "user_id": None,
            "username": "unknown_user",
            "role": "unknown",
            "action": "login",
            "resource": "user",
            "details": "登录失败: unknown_user (用户名或密码错误)",
            "ip": "192.168.1.100",
            "result": "failed",
            "error_message": "用户名或密码错误"
        }
    ]

    try:
        for i, operation in enumerate(test_operations, 1):
            log_operation(**operation)
            print(f"   [OK] 记录操作 {i}: {operation['action']} - {operation['details']}")
    except Exception as e:
        print(f"   [ERROR] 记录操作日志失败: {e}")
        return False

    print()

    # 3. 查询操作日志
    print("3. 查询操作日志...")
    try:
        logs = fetch_operation_logs(limit=10)
        print(f"   [OK] 成功查询到 {len(logs)} 条操作日志")
        print()
        print("   最新的5条操作日志:")
        for i, log in enumerate(logs[:5], 1):
            status = "[OK]" if log["result"] == "success" else "[FAIL]"
            print(f"   {status} [{log['timestamp']}] {log['username']} - {log['action']} - {log['details']}")
    except Exception as e:
        print(f"   [ERROR] 查询操作日志失败: {e}")
        return False

    print()

    # 4. 获取统计信息
    print("4. 获取统计信息...")
    try:
        stats = get_operation_log_stats()
        print(f"   [OK] 统计信息获取成功:")
        print(f"     - 总操作数: {stats['total']}")
        print(f"     - 今日操作数: {stats['todayCount']}")
        print(f"     - 按操作类型统计: {stats['byAction']}")
        print(f"     - 按资源类型统计: {stats['byResource']}")
        print(f"     - 按结果统计: {stats['byResult']}")
    except Exception as e:
        print(f"   [ERROR] 获取统计信息失败: {e}")
        return False

    print()
    print("=" * 60)
    print("[SUCCESS] 所有测试通过！操作日志功能工作正常。")
    print("=" * 60)
    return True


if __name__ == "__main__":
    success = test_operation_logs()
    sys.exit(0 if success else 1)
