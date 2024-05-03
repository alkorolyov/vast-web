from __future__ import annotations

import gc
from collections import deque
import logging
import traceback
import math
from time import time
import numpy as np
import pandas as pd
from pandas.core.dtypes.common import is_integer_dtype, is_float_dtype, is_numeric_dtype, is_string_dtype




def time_ms(time_sec: float):
    return int(time_sec * 1000)


def time_utc_now() -> pd.Timestamp:
    return pd.Timestamp.utcnow().round(freq='S')


def ts_utc_now() -> int:
    return int(time_utc_now().timestamp())


def next_timeout(period=60) -> float:
    t = time()
    return math.ceil(t / period) * period - t


def round_day(ts: pd.Series):
    return pd.to_datetime(ts*10**9).dt.round(freq='D').values.astype('int64') // 10**9


def round_base(x: pd.Series, base=5):
    return (base * (x.astype(float)/base).round()).astype(int)


def custom_round(x: pd.Series, round_list: list):
    """
    Custom round function to have different rounding bases for each interval.
    Receives ending values and rounding bases for each interval.
    Example:
        round_list = [(400, 10), (1000, 100)]
        rounds values [0 ... 400] by 10
        rounds values [400 ... 1000] by 100
    @param x: input Series
    @param round_list: list of tuples (end_value, round_base)
    @return: rounded series
    """

    res = x.copy()
    end = 0
    for r in round_list:
        start = end
        end = r[0]
        base = r[1]
        mask = x.between(start, end)
        res[mask] = round_base(res[mask], base=base)

    return res


def is_sorted(arr):
    return np.all(arr[:-1] <= arr[1:])


def df_na_vals(df, return_empty=True):
    columns = df.columns
    N = max(len(c) for c in columns) + 5
    empty = []
    for col in columns:
        na_vals = df[col].isna()
        print(col.ljust(N), '->', ' '*(N//3), f'Missing values: {na_vals.sum()} ({na_vals.mean():.2%})')

        if na_vals.mean() > .99:
            empty.append(col)

    if return_empty:
        return empty


def np_argmax_reduceat(vals, slice_idx):
    n = vals.max() + 1
    idx_arr = np.zeros(vals.size, dtype=np.uint8)
    idx_arr[slice_idx] = 1
    offset = n * idx_arr.cumsum()
    argidx = np.argsort(vals + offset)
    last_grp_idx = np.append(slice_idx[1:], vals.size) - 1
    return argidx[last_grp_idx]


def np_group_by(raw: pd.DataFrame, value_col: str, ufunc):
    """
    Group by machine_id using numpy ufunc (np.maximum, np.add etc.)
    :param raw: dataframe containing multiple offers per machine_id
    :param value_col: target column name
    :param ufunc: numpy ufunc to apply after groupby
    :return: arrays of corresponding machine_id, ufunc values
    """

    machine_ids = raw.machine_id.values
    vals = raw[value_col].values
    if not is_sorted(machine_ids):
        idx = np.argsort(machine_ids)
        machine_ids = machine_ids[idx]
        vals = vals[idx]

    # slice_idx = np.r_[0, np.flatnonzero(np.diff(machine_ids)) + 1]
    slice_idx = np.diff(machine_ids).nonzero()[0] + 1
    slice_idx = np.hstack([0, slice_idx])    # insert zero at the beginning of arr
    # return machine_ids[slice_idx], ufunc.reduceat(vals, slice_idx)
    return ufunc.reduceat(vals, slice_idx)


def _is_close_to_int(arr) -> bool:
    return np.all(np.isclose(arr, np.round(arr)))


def check_if_integer(arr) -> bool:
    if is_float_dtype(arr):
        return _is_close_to_int(arr)
    return False


def reduce_mem_usage(df, subset=None, int_cast=True, obj_to_category=False, verbose=False):
    """
    Iterate through all the columns of a dataframe and modify the data type to reduce memory usage.
    :param df: dataframe to reduce (pd.DataFrame)
    :param int_cast: indicate if columns should be tried to be casted to int (bool)
    :param obj_to_category: convert non-datetime related objects to category dtype (bool)
    :param subset: subset of columns to analyse (list)
    :param verbose: print statistics (bool)
    :return: dataset with the column dtypes adjusted (pd.DataFrame)
    """
    if verbose:
        start_mem = df.memory_usage().sum() / 1024 ** 2
        gc.collect()
        print('Memory usage of dataframe is {:.2f} MB'.format(start_mem))

    cols = subset if subset is not None else df.columns.tolist()

    for col in cols:
        col_type = df[col].dtype

        if is_numeric_dtype(col_type):
            c_min = df[col].min()
            c_max = df[col].max()

            # test if column can be converted to an integer
            treat_as_int = is_integer_dtype(col_type)
            if int_cast and not treat_as_int:
                treat_as_int = check_if_integer(df[col])

            if treat_as_int:
                if c_min > np.iinfo(np.int8).min and c_max < np.iinfo(np.int8).max:
                    df[col] = df[col].astype(np.int8)
                elif c_min > np.iinfo(np.uint8).min and c_max < np.iinfo(np.uint8).max:
                    df[col] = df[col].astype(np.uint8)
                elif c_min > np.iinfo(np.int16).min and c_max < np.iinfo(np.int16).max:
                    df[col] = df[col].astype(np.int16)
                elif c_min > np.iinfo(np.uint16).min and c_max < np.iinfo(np.uint16).max:
                    df[col] = df[col].astype(np.uint16)
                elif c_min > np.iinfo(np.int32).min and c_max < np.iinfo(np.int32).max:
                    df[col] = df[col].astype(np.int32)
                elif c_min > np.iinfo(np.uint32).min and c_max < np.iinfo(np.uint32).max:
                    df[col] = df[col].astype(np.uint32)
                elif c_min > np.iinfo(np.int64).min and c_max < np.iinfo(np.int64).max:
                    df[col] = df[col].astype(np.int64)
                elif c_min > np.iinfo(np.uint64).min and c_max < np.iinfo(np.uint64).max:
                    df[col] = df[col].astype(np.uint64)
            else:
                if c_min > np.finfo(np.float16).min and c_max < np.finfo(np.float16).max:
                    df[col] = df[col].astype(np.float16)
                elif c_min > np.finfo(np.float32).min and c_max < np.finfo(np.float32).max:
                    df[col] = df[col].astype(np.float32)
                else:
                    df[col] = df[col].astype(np.float64)
        elif is_string_dtype(col_type) and obj_to_category:
            df[col] = df[col].astype('category')

    if verbose:
        gc.collect()
        end_mem = df.memory_usage().sum() / 1024 ** 2
        print('Memory usage after optimization is: {:.2f} MB'.format(end_mem))
        print('Decreased by {:.1f}%'.format(100 * (start_mem - end_mem) / start_mem))

    return df


def get_error_info(e: Exception):
    err_msg = '\n'.join(traceback.format_exception(type(e), e, e.__traceback__))
    return err_msg


def read_last_n_lines(filename, n):
    try:
        with open(filename, 'r') as file:
            lines = file.readlines()
            return '\n'.join(lines[-n:])
    except Exception as e:
        logging.warning(f"Error reading file: {e}")
        return None


class setqueue(object):
    def __init__(self, values=None, maxlen=None):
        queue: deque
        unique_set: set

        if isinstance(values, (int, float, str)):
            self.queue = deque([values])
            self.unique_set = {values}
        elif values:
            self.queue = deque(values)
            self.unique_set = set(values)
        else:
            self.queue = deque()
            self.unique_set = {}

        self.maxlen = maxlen

    def put(self, item):
        if item not in self.unique_set:
            self.queue.append(item)
            self.unique_set.add(item)
        if self.maxlen and len(self) > self.maxlen:
            self.pop()

    def __add__(self, other):
        self.put(other)
        return self

    def pop(self):
        if len(self.queue) > 0:
            item = self.queue.popleft()
            self.unique_set.remove(item)
            return item

    def __len__(self):
        return len(self.queue)

    def __str__(self):
        return str(list(self.queue))

    def __repr__(self):
        return str(list(self.queue))


def datetime_to_ts(date: str):
    return int(pd.to_datetime(date).timestamp())
