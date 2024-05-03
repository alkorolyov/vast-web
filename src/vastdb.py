import signal
import sqlite3
import pandas as pd
from time import time
import logging
from src.utils import time_ms, get_error_info


def _get_sql_query(machine_id, tbl_name, from_ts=None, to_ts=None) -> str:
    sql_query = f"SELECT * FROM {tbl_name} WHERE machine_id={machine_id}"
    if from_ts:
        sql_query += f" AND timestamp >= {from_ts}"
    if to_ts:
        sql_query += f" AND timestamp <= {to_ts}"
    return sql_query


class VastDB:
    def __init__(self, db_path: str):
        self.db_path = db_path
        self.conn = None

    def __enter__(self):
        try:
            self.conn = sqlite3.connect(self.db_path)
            return self
        except Exception as e:
            msg = f"[DB] Connection error: {get_error_info(e)}"
            logging.error(msg)
            raise

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
        if exc_type:
            msg = f"[DB] {exc_type} during Database Operations:{exc_val}\n{exc_tb}"
            logging.error(msg)
            raise

    def close(self):
        if self.conn:
            self.conn.close()

    def execute(self, sql_query):
        try:
            return self.conn.execute(sql_query)
        except sqlite3.Error as e:
            logging.error(f"Error executing sql command: {sql_query}\n{e}")
            raise

    def request_to_json(self, machine_id, tbl_name, from_ts=None, to_ts=None):
        sql_query = _get_sql_query(machine_id, tbl_name, from_ts, to_ts)

        start = time()
        df = pd.read_sql(sql_query, con=self.conn)
        logging.debug(f'[{tbl_name.upper()}] read sql {len(df)} records {time_ms(time() - start)}ms')

        # start = time()
        json_data = df.to_json(orient='records')
        # logging.debug(f'[{tbl_name.upper()}] convert to json {time_ms(time() - start)}ms')
        return json_data

    def table_to_df(self, tbl_name: str):
        df = pd.read_sql_query(f"SELECT * FROM {tbl_name}", con=self.conn)
        return df

    def get_machine_stats(self, machine_id: int, from_ts, to_ts):
        result = {}
        ts_cols = ['rent_ts', 'reliability_ts', 'cost_ts', 'hardware_ts', 'avg_ts']
        snp_cols = ['eod_snp', 'disk_snp', 'cpu_ram_snp']

        for tbl_name in ts_cols:
            result[tbl_name] = self.request_to_json(machine_id, tbl_name, from_ts, to_ts)
        for tbl_name in snp_cols:
            result[tbl_name] = self.request_to_json(machine_id, tbl_name)

        json_data = ('{' + ','.join([f'"{k}": {v}' for (k, v) in result.items()]) + '}').encode('utf-8')

        return json_data

