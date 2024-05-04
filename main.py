from __future__ import annotations

import sys

import pandas as pd
from time import time


import http.server
import socketserver
import threading
import signal
import sqlite3
import argparse
import logging
from logging.handlers import RotatingFileHandler

import gzip
from urllib.parse import urlparse, parse_qs
from http import HTTPStatus

from src.utils import time_ms, datetime_to_ts, get_error_info
from src import const
from src.vastdb import VastDB


def parse_params(params: dict) -> tuple:
    machine_id = params.get('machine_id', [None])[0]
    from_date, to_date = params.get('from', [None])[0], params.get('to', [None])[0]

    if machine_id is None:
        raise ValueError('machine_id is required')

    try:
        machine_id = int(machine_id)
    except ValueError:
        raise ValueError(f'machine_id should be an integer: {machine_id}')

    from_timestamp = None
    if from_date:
        from_timestamp = datetime_to_ts(from_date)

    to_timestamp = None
    if to_date:
        to_timestamp = datetime_to_ts(to_date)

    return machine_id, from_timestamp, to_timestamp


def get_dbrequest_sql(params: dict, db_table: str) -> str:
    # unpack parameters
    machine_ids, from_ts, to_ts = parse_params(params)

    sql_query = f"SELECT * FROM {db_table} WHERE"

    # add machine_id
    sql_query += f" machine_id IN ({','.join(machine_ids)})"

    # add 'from' and 'to' constraints
    if from_ts:
        sql_query += f" AND timestamp >= '{from_ts}'"
    if to_ts:
        sql_query += f" AND timestamp <= '{to_ts}'"

    return sql_query


def get_last_value_sql(params: dict, db_table: str) -> str:
    machine_ids, _, _ = parse_params(params)
    return f"SELECT * FROM {db_table} WHERE machine_id={machine_ids[0]} ORDER BY timestamp DESC LIMIT 1"


def compress_data(json_data):
    start = time()
    compressed = gzip.compress(json_data, compresslevel=1)
    logging.debug(f"compress json:     {time_ms(time() - start)} ms")
    logging.debug(f"compression ratio: {len(compressed) / len(json_data) * 100:.1f}%")
    logging.debug(f"data size:         {len(compressed)} bytes")
    return compressed


class RequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs) -> None:
        super().__init__(*args, directory=const.STATIC_PATH, **kwargs)

    def do_GET(self):
        logging.debug(f"Received request: {self.request}")
        if self.request.getpeername()[0] not in const.IP_LIST:
            self.send_error(HTTPStatus.BAD_REQUEST)

        parsed_url = urlparse(self.path)
        logging.debug(f"parsed_url: {parsed_url.path}")
        query_params = parse_qs(parsed_url.query)
        logging.debug(f"query_params: {query_params}")

        if parsed_url.path == '/stats':
            self.handle_stats_request(query_params)
        elif parsed_url.path == '/test':
            self.handle_test_request()
        else:
            super().do_GET()

    def handle_test_request(self) -> None:
        logging.getLogger().setLevel(logging.INFO)
        logging.info(f"Testing request 2 weeks data")

        with self.server.vastdb as vastdb:
            machines_list = vastdb.table_to_df('machine_host_map').machine_id.sample(10)

        times = []
        for machine_id in machines_list:
            start = time()
            with self.server.vastdb as vastdb:
                # json_data = vastdb.get_machine_stats(machine_id, datetime_to_ts('2024-03-06'), None)
                # json_data = vastdb.get_machine_stats(machine_id, datetime_to_ts('2024'), None)
                json_data = vastdb.get_machine_stats(machine_id)
            times.append(time_ms(time() - start))
            logging.info(f"machine_id: {machine_id} {times[-1]}ms")

        logging.getLogger().setLevel(logging.DEBUG)
        times = pd.Series(times)
        msg = f"Request finished in {int(times.mean())} ± {int(times.std())}ms"
        logging.debug(msg)

        html_content = f'<html><body>{msg}</body></html>'
        self.send_html(html_content.encode('utf-8'))

    def handle_stats_request(self, query_params: dict) -> dict | None:
        # with VastDB(self.server.db_path) as vastdb:
        with self.server.vastdb as vastdb:
            try:
                machine_id, from_ts, to_ts = parse_params(query_params)
            except ValueError as e:
                self.send_error(HTTPStatus.BAD_REQUEST, f'Error parsing params {query_params} {e}', str(e))

            try:
                json_data = vastdb.get_machine_stats(machine_id, from_ts, to_ts)
            except pd.errors.DatabaseError as e:
                self.send_error(HTTPStatus.INTERNAL_SERVER_ERROR,
                                f'Pandas DatabaseError {e}', str(e))

            try:
                compressed = compress_data(json_data)
                self.send_compressed_json(compressed)
            except Exception as e:
                self.send_error(HTTPStatus.INTERNAL_SERVER_ERROR, f'Error compressing json {query_params}', str(e))

    def handle_db_request(self, query_params: dict, db_table: str) -> None:
        try:
            with sqlite3.connect(self.server.db_path) as conn:
                sql_query = get_dbrequest_sql(query_params, db_table)

                start = time()
                df = pd.read_sql_query(sql_query, conn)
                logging.debug(f"sql request: {time_ms(time() - start)} ms")

            json_data = df.to_json(orient='records').encode('utf-8')
            compressed = compress_data(json_data)
            self.send_compressed_json(compressed)

        except sqlite3.DatabaseError as e:
            self.send_error(HTTPStatus.INTERNAL_SERVER_ERROR, f'SQLite DatabaseError {query_params} {db_table}', str(e))
        except pd.errors.DatabaseError as e:
            self.send_error(HTTPStatus.INTERNAL_SERVER_ERROR, f'Pandas DatabaseError {query_params} {sql_query} {db_table}', str(e))
        except ValueError as e:
            self.send_error(HTTPStatus.BAD_REQUEST, f'ValueError during Parsing {query_params}', str(e))
        except TypeError as e:
            self.send_error(HTTPStatus.INTERNAL_SERVER_ERROR, f'GET TypeError', str(e))
        except OSError as e:
            self.send_error(HTTPStatus.INTERNAL_SERVER_ERROR, f"GET OSError", str(e))
        except Exception as e:
            self.send_error(HTTPStatus.INTERNAL_SERVER_ERROR, 'GET General exception', str(e))

    def send_html(self, html_content):
        # Send HTML response to client
        self.send_response(HTTPStatus.OK)
        self.send_header('Content-type', 'text/html; charset=utf-8')
        self.end_headers()
        self.wfile.write(html_content)

    def send_compressed_json(self, compressed_data):
        self.send_response(HTTPStatus.OK)
        self.send_header('Content-type', 'application/json')
        self.send_header('Content-Encoding', 'gzip')
        self.end_headers()
        self.wfile.write(compressed_data)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Vast Stats WebServer')
    parser.add_argument('-p', '--port', type=int, default=3000, help='port to listen on')
    parser.add_argument('--db_path', type=str, default='./vast.db', help='path to database')
    parser.add_argument('--log_path', type=str, default='./server.log', help='path to log file')

    args = vars(parser.parse_args())
    db_path = args.get('db_path')
    log_path = args.get('log_path')
    port = args.get('port')

    # logging
    log_handler = None
    rotating = RotatingFileHandler(log_path,
                                   maxBytes=const.MAX_LOGSIZE,
                                   backupCount=const.LOG_COUNT)
    log_handler = [rotating]

    log_level = logging.DEBUG
    logging.basicConfig(format=const.LOG_FORMAT,
                        handlers=log_handler,
                        level=log_level,
                        datefmt='%d-%m-%Y %I:%M:%S')

    with socketserver.TCPServer(("", port), RequestHandler) as httpd:
        httpd.allow_reuse_address = True

        def sigterm_handler(signum, frame):
            logging.warning("[SIGTERM] Stopping server ...")

            httpd.vastdb.close()

            # shutdown in separate thread
            threading.Thread(target=httpd.shutdown).start()

            logging.info("[SIGTERM] Server stopped")
            sys.exit(0)

        signal.signal(signal.SIGTERM, sigterm_handler)

        httpd.vastdb = VastDB(db_path)
        logging.debug(f"Database path: {db_path}")
        logging.debug(f"Server listening on port {port}")

        try:
            httpd.serve_forever()

        except KeyboardInterrupt:
            logging.debug("Keyboard interrupt received, stopping server ...")
            httpd.vastdb.close()
            threading.Thread(target=httpd.shutdown).start()
            logging.debug("Server stopped")
            sys.exit(0)  # Optional, to exit the script after cleanup

        except Exception as e:
            logging.debug(get_error_info(e))
            httpd.vastdb.close()
            threading.Thread(target=httpd.shutdown).start()
            sys.exit(1)
