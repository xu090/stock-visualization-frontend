from app.db import get_conn


def ensure_stock_time_sharing_compat_view() -> None:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'stock_time_sharing'
                """
            )
            column_names = {row["column_name"] for row in cur.fetchall()}

            if {"stock_code", "ts", "previous_close"}.issubset(column_names):
                select_sql = """
                    SELECT
                        market_code,
                        category,
                        stock_code,
                        ts,
                        COALESCE(begin_price, open) AS begin_price,
                        open,
                        close,
                        high,
                        low,
                        COALESCE(previous_close, ycp) AS previous_close,
                        vol,
                        amount,
                        tor,
                        ftor,
                        COALESCE(
                            udp,
                            CASE
                                WHEN close IS NOT NULL AND COALESCE(previous_close, ycp) IS NOT NULL
                                THEN close - COALESCE(previous_close, ycp)
                                ELSE NULL
                            END
                        ) AS udp,
                        COALESCE(
                            udf,
                            CASE
                                WHEN close IS NOT NULL
                                 AND COALESCE(previous_close, ycp) IS NOT NULL
                                 AND COALESCE(previous_close, ycp) <> 0
                                THEN ROUND(((close - COALESCE(previous_close, ycp)) / COALESCE(previous_close, ycp) * 100)::numeric, 2)
                                ELSE NULL
                            END
                        ) AS udf,
                        COALESCE(
                            udz,
                            CASE
                                WHEN high IS NOT NULL
                                 AND low IS NOT NULL
                                 AND COALESCE(previous_close, ycp) IS NOT NULL
                                 AND COALESCE(previous_close, ycp) <> 0
                                THEN ROUND(((high - low) / COALESCE(previous_close, ycp) * 100)::numeric, 2)
                                ELSE NULL
                            END
                        ) AS udz
                    FROM stock_time_sharing
                """
            else:
                select_sql = """
                    SELECT
                        market_code,
                        category,
                        code AS stock_code,
                        timestamps AS ts,
                        COALESCE(begin, open) AS begin_price,
                        open,
                        close,
                        high,
                        low,
                        ycp AS previous_close,
                        vol,
                        amount,
                        NULL::numeric AS tor,
                        NULL::numeric AS ftor,
                        CASE
                            WHEN close IS NOT NULL AND ycp IS NOT NULL
                            THEN close - ycp
                            ELSE NULL
                        END AS udp,
                        CASE
                            WHEN close IS NOT NULL AND ycp IS NOT NULL AND ycp <> 0
                            THEN ROUND(((close - ycp) / ycp * 100)::numeric, 2)
                            ELSE NULL
                        END AS udf,
                        CASE
                            WHEN high IS NOT NULL AND low IS NOT NULL AND ycp IS NOT NULL AND ycp <> 0
                            THEN ROUND(((high - low) / ycp * 100)::numeric, 2)
                            ELSE NULL
                        END AS udz
                    FROM stock_time_sharing
                """

            cur.execute("DROP VIEW IF EXISTS stock_time_sharing_compat")
            cur.execute(f"CREATE VIEW stock_time_sharing_compat AS {select_sql}")
        conn.commit()
