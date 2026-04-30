#!/usr/bin/env python3
"""创建管理员账号的脚本"""

import sys
import os

# 添加项目路径到 sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.auth_service import create_user, ensure_auth_tables, _hash_password, ROLE_ADMIN, _initial_role
from app.db import get_conn


def create_admin_account(username: str = "admin", password: str = "000000"):
    """创建管理员账号"""
    print(f"正在创建管理员账号...")
    print(f"用户名: {username}")
    print(f"密码: {password}")

    # 确保表存在
    ensure_auth_tables()

    # 检查用户是否已存在
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT username, role FROM users WHERE username = %s", (username,))
            existing_user = cur.fetchone()

    if existing_user:
        print(f"\n用户 '{username}' 已存在！")
        print(f"当前角色: {existing_user['role']}")

        if existing_user['role'] != ROLE_ADMIN:
            print(f"\n正在将用户升级为管理员...")
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE users SET role = %s, updated_at = NOW() WHERE username = %s",
                        (ROLE_ADMIN, username)
                    )
                conn.commit()
            print(f"[OK] 用户 '{username}' 已成功升级为管理员")
        else:
            print(f"[OK] 用户 '{username}' 已经是管理员")

        # 直接重置密码
        print(f"\n正在重置密码为 '{password}'...")
        salt, password_hash = _hash_password(password)
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE users SET password_salt = %s, password_hash = %s, updated_at = NOW() WHERE username = %s",
                    (salt, password_hash, username)
                )
            conn.commit()
        print(f"[OK] 密码已重置为: {password}")

        return

    # 创建新用户
    try:
        user = create_user(username, password)
        print(f"\n[OK] 用户创建成功！")
        print(f"  ID: {user['id']}")
        print(f"  用户名: {user['username']}")
        print(f"  角色: {user['role']}")

        if user['role'] != ROLE_ADMIN:
            print(f"\n正在将用户升级为管理员...")
            with get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE users SET role = %s, updated_at = NOW() WHERE id = %s",
                        (ROLE_ADMIN, user['id'])
                    )
                conn.commit()
            print(f"[OK] 用户已升级为管理员")

    except FileExistsError:
        print(f"\n[ERROR] 创建失败：用户名 '{username}' 已存在")
        sys.exit(1)
    except ValueError as e:
        print(f"\n[ERROR] 创建失败：{e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n[ERROR] 创建失败：{e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    print("=" * 50)
    print("创建管理员账号")
    print("=" * 50)
    print()

    # 可以通过命令行参数指定用户名和密码
    username = sys.argv[1] if len(sys.argv) > 1 else "admin"
    password = sys.argv[2] if len(sys.argv) > 2 else "000000"

    create_admin_account(username, password)

    print()
    print("=" * 50)
    print("完成！您现在可以使用以下信息登录：")
    print(f"  用户名: {username}")
    print(f"  密码: {password}")
    print("=" * 50)
